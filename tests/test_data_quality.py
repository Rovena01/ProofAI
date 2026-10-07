import json
import math
import os
import sys
import unittest
from pathlib import Path

# Add backend directory to sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import pandas as pd
from services.data_quality import assess_data_quality
from services.profiler import profile_dataframe


class TestDataQualityReport(unittest.TestCase):
    def test_sales_csv_quality_report(self):
        """Test on the standard sales.csv dataset (expected clean pass)."""
        sales_path = PROJECT_ROOT / "datasets" / "sales.csv"
        self.assertTrue(sales_path.exists(), "sales.csv must exist")

        df = pd.read_csv(sales_path)
        df_copy = df.copy()

        profile = profile_dataframe(df)
        report = assess_data_quality(df, profile)

        # 1. Required top-level keys
        required_keys = [
            "overall_status",
            "quality_score",
            "row_count",
            "column_count",
            "duplicate_rows",
            "duplicate_percentage",
            "missing_values",
            "missing_percentage",
            "warnings",
            "issues",
            "columns",
            "column_quality",
        ]
        for key in required_keys:
            self.assertIn(key, report, f"Required key '{key}' missing from quality report")

        # 2. Existing backward-compatibility keys
        self.assertIn("rows", report)
        self.assertIn("quality_summary", report)
        self.assertEqual(report["row_count"], 6)
        self.assertEqual(report["column_count"], 5)
        self.assertEqual(report["rows"], 6)

        # 3. Quality score and status
        self.assertEqual(report["overall_status"], "pass")
        self.assertEqual(report["quality_score"], 100)
        self.assertEqual(report["duplicate_rows"], 0)
        self.assertEqual(report["missing_values"], 0)
        self.assertEqual(len(report["issues"]), 0)

        # 4. JSON safe check
        json_str = json.dumps(report)
        self.assertNotIn("NaN", json_str)
        self.assertNotIn("Infinity", json_str)

        # 5. Immutability check: df was not modified
        pd.testing.assert_frame_equal(df, df_copy)

    def test_messy_quality_report(self):
        """Test on messy dataset with missing values, infinite values, invalid dates, duplicate rows, negative values."""
        messy_path = PROJECT_ROOT / "datasets" / "uploads" / "0e1bb2e0-a712-4f42-ae89-686b9e9a7990" / "messy_quality_test.csv"
        self.assertTrue(messy_path.exists(), "messy_quality_test.csv must exist")

        df = pd.read_csv(messy_path)
        profile = profile_dataframe(df)
        report = assess_data_quality(df, profile)

        # Required fields present and types correct
        self.assertIn(report["overall_status"], ["pass", "review", "fail"])
        self.assertEqual(report["overall_status"], "review")
        self.assertIsInstance(report["quality_score"], int)
        self.assertTrue(0 <= report["quality_score"] <= 100)
        self.assertEqual(report["row_count"], 5)
        self.assertEqual(report["column_count"], 4)
        self.assertEqual(report["duplicate_rows"], 1)
        self.assertEqual(report["duplicate_percentage"], 20.0)
        self.assertEqual(report["missing_values"], 1)

        # Check detected issues
        issue_types = [item["type"] for item in report["issues"]]
        self.assertIn("duplicate_rows", issue_types)
        self.assertIn("missing_values", issue_types)
        self.assertIn("invalid_dates", issue_types)
        self.assertIn("infinite_values", issue_types)

        # Negative values must be 'info', NOT an issue/error
        self.assertNotIn("negative_values", issue_types)
        warning_types = [item["type"] for item in report["warnings"]]
        self.assertIn("negative_values", warning_types)
        neg_warning = next(w for w in report["warnings"] if w["type"] == "negative_values")
        self.assertEqual(neg_warning["severity"], "info")

        # JSON safety
        json_str = json.dumps(report)
        self.assertNotIn("NaN", json_str)
        self.assertNotIn("Infinity", json_str)

    def test_empty_dataset(self):
        """Empty dataset (0 rows) must be flagged deterministically as 'review'."""
        df = pd.DataFrame(columns=["name", "amount", "date"])
        profile = profile_dataframe(df)
        report = assess_data_quality(df, profile)

        self.assertEqual(report["row_count"], 0)
        self.assertEqual(report["column_count"], 3)
        self.assertEqual(report["overall_status"], "review")
        self.assertTrue(0 <= report["quality_score"] <= 100)
        json.dumps(report)

    def test_critical_empty_column(self):
        """Dataset with an empty column (100% missing) must produce critical issue and 'fail' status."""
        df = pd.DataFrame({
            "valid_col": [1, 2, 3],
            "empty_col": [None, None, None],
        })
        profile = profile_dataframe(df)
        report = assess_data_quality(df, profile)

        self.assertEqual(report["overall_status"], "fail")
        issue_types = [i["type"] for i in report["issues"]]
        self.assertIn("empty_column", issue_types)
        empty_issues = [i for i in report["issues"] if i["type"] == "empty_column"]
        self.assertEqual(empty_issues[0]["severity"], "critical")

    def test_critical_invalid_dates(self):
        """Dataset with low date parse success (< 50%) must produce critical invalid_dates and 'fail' status."""
        df = pd.DataFrame({
            "date": ["2025-01-01", "not-a-date-1", "not-a-date-2"],
            "val": [10, 20, 30],
        })
        profile = profile_dataframe(df)
        report = assess_data_quality(df, profile)

        self.assertEqual(report["overall_status"], "fail")
        invalid_date_issues = [i for i in report["issues"] if i["type"] == "invalid_dates"]
        self.assertTrue(len(invalid_date_issues) > 0)
        self.assertEqual(invalid_date_issues[0]["severity"], "critical")

    def test_json_safe_with_pandas_na_and_inf(self):
        """Ensure report never contains NaN, Inf, or unhandled pd.NA/pd.NaT in API response."""
        df = pd.DataFrame({
            "num": [1.0, float("nan"), float("inf"), float("-inf")],
            "text": ["a", pd.NA, "c", pd.NA],
        })
        profile = profile_dataframe(df)
        report = assess_data_quality(df, profile)

        # Serialization to JSON must succeed without errors or raw NaN/Infinity tokens
        serialized = json.dumps(report)
        deserialized = json.loads(serialized)
        self.assertIsInstance(deserialized, dict)
        self.assertNotIn("NaN", serialized)
        self.assertNotIn("Infinity", serialized)


    def test_upload_api_integration(self):
        """Test full integration with api.upload.upload_dataset."""
        import asyncio
        import io
        from fastapi import UploadFile
        from api.upload import upload_dataset

        async def _run():
            sales_path = PROJECT_ROOT / "datasets" / "sales.csv"
            with open(sales_path, "rb") as f:
                content = f.read()

            upload_file = UploadFile(
                file=io.BytesIO(content),
                filename="sales.csv",
                headers={"content-type": "text/csv"}
            )
            response = await upload_dataset(upload_file)
            self.assertIn("dataset_id", response)
            self.assertIn("data_quality", response)
            self.assertIn("profile", response)
            dq = response["data_quality"]
            self.assertEqual(dq["overall_status"], "pass")
            self.assertEqual(dq["quality_score"], 100)
            self.assertEqual(dq["row_count"], 6)
            self.assertEqual(dq["column_count"], 5)
            self.assertIsInstance(dq["columns"], list)
            self.assertIsInstance(dq["column_quality"], list)

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
