import asyncio
import io
import json
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import pandas as pd
from fastapi import HTTPException, UploadFile

from api.upload import upload_dataset
from models.analysis import AnalysisRequest
from services.analysis import (
    load_dataset_dataframe,
    perform_analysis,
    verify_analysis_proof,
)
from services.planner import extract_columns_from_text, plan_question
from services.storage import UPLOAD_DIR, validate_dataset_id


class TestPhase9Hardening(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sales_path = PROJECT_ROOT / "datasets" / "sales.csv"
        cls.sales_df = pd.read_csv(cls.sales_path)

    # -------------------------------------------------------------------------
    # 1. Path Traversal & Security
    # -------------------------------------------------------------------------
    def test_01_path_traversal_dataset_id_rejected(self):
        """Path traversal patterns in dataset_id must be strictly rejected."""
        traversal_attempts = [
            "../../etc/passwd",
            "../main",
            "uploads/../../secret",
            "foo/bar",
            "foo\\bar",
            "..",
            "",
            "   ",
        ]
        for attempt in traversal_attempts:
            with self.subTest(attempt=attempt):
                with self.assertRaises(ValueError):
                    validate_dataset_id(attempt)

                with self.assertRaises(ValueError):
                    load_dataset_dataframe(attempt)

    def test_02_valid_dataset_ids_accepted(self):
        """Valid dataset_id formats (slugs, UUIDs) must pass validation."""
        valid_ids = [
            "sales",
            "sales_2026",
            "dataset-123",
            "bf68f3e1-a24d-4306-a103-5cc95ea4999a",
        ]
        for valid_id in valid_ids:
            with self.subTest(valid_id=valid_id):
                self.assertEqual(validate_dataset_id(valid_id), valid_id)

    # -------------------------------------------------------------------------
    # 2. File Upload Hardening: Empty, Malformed, Non-UTF8 & Size Limits
    # -------------------------------------------------------------------------
    def test_03_upload_empty_csv_rejected(self):
        """Uploading a 0-byte CSV must be rejected with HTTP 400."""
        async def _run():
            upload_file = UploadFile(
                file=io.BytesIO(b""),
                filename="empty.csv",
                headers={"content-type": "text/csv"}
            )
            with self.assertRaises(HTTPException) as ctx:
                await upload_dataset(upload_file)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("empty", ctx.exception.detail.lower())

        asyncio.run(_run())

    def test_04_upload_non_utf8_latin1_supported(self):
        """Uploading a CSV encoded in Latin-1 with accented characters must succeed."""
        latin1_content = "product,revenue\nCafé,1200\nThé,800\n".encode("latin-1")
        async def _run():
            upload_file = UploadFile(
                file=io.BytesIO(latin1_content),
                filename="latin1_sales.csv",
                headers={"content-type": "text/csv"}
            )
            res = await upload_dataset(upload_file)
            self.assertIn("dataset_id", res)
            self.assertEqual(res["profile"]["rows"], 2)
            self.assertEqual(res["profile"]["columns"], 2)
            col_names = [c["name"] for c in res["profile"]["column_details"]]
            self.assertIn("product", col_names)

        asyncio.run(_run())

    def test_05_upload_oversized_file_rejected(self):
        """Uploading a file exceeding 50MB must be rejected with HTTP 413."""
        # Generate 51MB of test data
        oversized_content = b"col1,col2\n" + (b"1,2\n" * (13 * 1024 * 1024))
        async def _run():
            upload_file = UploadFile(
                file=io.BytesIO(oversized_content),
                filename="huge.csv",
                headers={"content-type": "text/csv"}
            )
            with self.assertRaises(HTTPException) as ctx:
                await upload_dataset(upload_file)
            self.assertEqual(ctx.exception.status_code, 413)
            self.assertIn("exceeds maximum", ctx.exception.detail)

        asyncio.run(_run())

    # -------------------------------------------------------------------------
    # 3. Proof Integrity: Overlapping Union Exclusions & Accounting Identity
    # -------------------------------------------------------------------------
    def test_06_group_by_overlapping_null_exclusions_exact_identity(self):
        """
        Verify group-by exclusion accounting uses union semantics:
        Rows with multiple exclusion reasons are counted exactly once in rows_excluded.
        """
        # Row 0: Valid ('Laptop', 100)
        # Row 1: Missing group (None, 200) -> Excluded
        # Row 2: Missing target ('Phone', NaN) -> Excluded
        # Row 3: BOTH missing group & target (None, NaN) -> Excluded ONCE
        df = pd.DataFrame({
            "product": ["Laptop", None, "Phone", None],
            "revenue": [100.0, 200.0, float("nan"), float("nan")],
        })

        res = perform_analysis(
            df,
            operation="group_by_sum",
            column="revenue",
            group_by="product",
            dataset_id="test_union",
        )
        proof = res["proof"]

        self.assertEqual(proof["dataset_rows"], 4)
        self.assertEqual(proof["rows_considered"], 4)
        self.assertEqual(proof["valid_rows_count"], 1)
        # Total excluded rows must be 3 under union semantics, NOT 4
        self.assertEqual(proof["rows_excluded"], 3)
        self.assertEqual(proof["valid_rows_count"] + proof["rows_excluded"], proof["rows_considered"])

        # Verification must pass without inconsistency
        verif = verify_analysis_proof(res)
        self.assertTrue(verif["verified"])
        self.assertEqual(verif["verification_status"], "passed")

    def test_07_group_by_tracks_non_finite_values_in_evidence(self):
        """Verify group-by operations correctly track and report non-finite Inf values."""
        df = pd.DataFrame({
            "product": ["Laptop", "Laptop", "Phone"],
            "revenue": [100.0, float("inf"), 200.0],
        })

        res = perform_analysis(
            df,
            operation="group_by_sum",
            column="revenue",
            group_by="product",
            dataset_id="test_inf",
        )
        proof = res["proof"]

        self.assertEqual(proof["dataset_rows"], 3)
        self.assertEqual(proof["valid_rows_count"], 2)
        self.assertEqual(proof["non_finite_values_excluded"], 1)
        self.assertEqual(proof["rows_excluded"], 1)
        self.assertEqual(proof["valid_rows_count"] + proof["rows_excluded"], proof["rows_considered"])

        verif = verify_analysis_proof(res)
        self.assertTrue(verif["verified"])

    # -------------------------------------------------------------------------
    # 4. Proof Integrity: Formula & Calculation Tampering Rejection
    # -------------------------------------------------------------------------
    def test_08_tampered_formula_trace_rejected(self):
        """Tampering with the formula string must be caught and rejected by verification."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")

        tampered = json.loads(json.dumps(res))
        tampered["proof"]["formula"] = "fabricated external calculation of revenue"

        with self.assertRaises(ValueError) as ctx:
            verify_analysis_proof(tampered)
        self.assertIn("Tampered formula trace", str(ctx.exception))

    def test_09_tampered_calculation_trace_rejected(self):
        """Tampering with the calculation string must be caught and rejected by verification."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="average", column="revenue", dataset_id="sales")

        tampered = json.loads(json.dumps(res))
        tampered["proof"]["calculation"] = "sum(revenue)"  # Op was average

        with self.assertRaises(ValueError) as ctx:
            verify_analysis_proof(tampered)
        self.assertIn("Tampered calculation trace", str(ctx.exception))

    def test_10_tampered_valid_rows_identity_rejected(self):
        """Tampering with valid_rows_count breaking the row accounting identity must be rejected."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")

        tampered = json.loads(json.dumps(res))
        # sales.csv has 6 valid rows, 0 excluded. Tamper to 5 valid rows without updating excluded.
        tampered["proof"]["valid_rows_count"] = 5

        with self.assertRaises(ValueError) as ctx:
            verify_analysis_proof(tampered)
        self.assertIn("Inconsistent row accounting", str(ctx.exception))

    # -------------------------------------------------------------------------
    # 5. Planner Robustness: Columns with Punctuation & Symbols
    # -------------------------------------------------------------------------
    def test_11_planner_matches_column_with_symbols(self):
        """Planner must correctly recognize column names containing parentheses or currency symbols."""
        columns = ["product", "Revenue ($)", "Quantity Sold", "sale_date"]
        matched = extract_columns_from_text("what is the total Revenue ($)?", columns)
        self.assertIn("Revenue ($)", matched)

    def test_12_planner_whitespace_only_question_handled(self):
        """Planner must reject empty or whitespace-only questions with ValueError."""
        with self.assertRaises(ValueError) as ctx:
            plan_question("sales", "   \t\n  ")
        self.assertIn("empty", str(ctx.exception).lower())

    # -------------------------------------------------------------------------
    # 6. Extreme Edge Case: All-Null / 100% Excluded Data
    # -------------------------------------------------------------------------
    def test_13_all_null_column_scalar_analysis_proof_consistency(self):
        """A column with 100% missing values must return 0 valid rows, 100% exclusions, and verified proof."""
        df = pd.DataFrame({
            "empty_num": [float("nan"), float("nan"), float("nan")],
        })
        res = perform_analysis(df, operation="sum", column="empty_num", dataset_id="null_test")
        proof = res["proof"]

        self.assertEqual(proof["dataset_rows"], 3)
        self.assertEqual(proof["valid_rows_count"], 0)
        self.assertEqual(proof["rows_excluded"], 3)
        self.assertEqual(proof["valid_rows_count"] + proof["rows_excluded"], proof["rows_considered"])

        verif = verify_analysis_proof(res)
        self.assertTrue(verif["verified"])


if __name__ == "__main__":
    unittest.main()
