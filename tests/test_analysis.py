import json
import math
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import numpy as np
import pandas as pd
from api.analysis import analyze
from models.analysis import AnalysisRequest
from services.analysis import analyze_dataset, perform_analysis


class TestDeterministicAnalysisEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sales_path = PROJECT_ROOT / "datasets" / "sales.csv"
        cls.sales_df = pd.read_csv(cls.sales_path)

    def test_01_sum_operation(self):
        """Verify sum calculates correct total and outputs rigorous evidence."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue")

        self.assertEqual(res["operation"], "sum")
        self.assertEqual(res["column"], "revenue")
        self.assertEqual(res["result"], 695000)

        ev = res["evidence"]
        self.assertEqual(ev["rows_considered"], 6)
        self.assertEqual(ev["valid_rows_count"], 6)
        self.assertEqual(ev["missing_values_excluded"], 0)
        self.assertEqual(ev["result"], 695000)
        self.assertIn("sum", ev["calculation"].lower())

    def test_02_average_operation(self):
        """Verify average calculates arithmetic mean and includes evidence."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="average", column="revenue")

        self.assertEqual(res["operation"], "average")
        self.assertEqual(res["column"], "revenue")
        expected_avg = round(695000 / 6, 4)
        self.assertEqual(res["result"], expected_avg)

        ev = res["evidence"]
        self.assertEqual(ev["rows_considered"], 6)
        self.assertEqual(ev["valid_rows_count"], 6)
        self.assertEqual(ev["result"], expected_avg)

    def test_03_count_operation(self):
        """Verify count returns exact count of non-null values."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="count", column="revenue")

        self.assertEqual(res["operation"], "count")
        self.assertEqual(res["column"], "revenue")
        self.assertEqual(res["result"], 6)

        ev = res["evidence"]
        self.assertEqual(ev["rows_considered"], 6)
        self.assertEqual(ev["valid_rows_count"], 6)
        self.assertEqual(ev["missing_values_excluded"], 0)
        self.assertIn("definition", ev)

    def test_04_min_operation(self):
        """Verify min calculates the minimum non-null value."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="min", column="revenue")

        self.assertEqual(res["operation"], "min")
        self.assertEqual(res["column"], "revenue")
        self.assertEqual(res["result"], 75000)

        ev = res["evidence"]
        self.assertEqual(ev["rows_considered"], 6)
        self.assertEqual(ev["result"], 75000)

    def test_05_max_operation(self):
        """Verify max calculates the maximum non-null value."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="max", column="revenue")

        self.assertEqual(res["operation"], "max")
        self.assertEqual(res["column"], "revenue")
        self.assertEqual(res["result"], 180000)

        ev = res["evidence"]
        self.assertEqual(ev["rows_considered"], 6)
        self.assertEqual(ev["result"], 180000)

    def test_06_median_operation(self):
        """Verify median calculates the 50th percentile."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="median", column="revenue")

        self.assertEqual(res["operation"], "median")
        self.assertEqual(res["column"], "revenue")
        self.assertEqual(res["result"], 120000)

        ev = res["evidence"]
        self.assertEqual(ev["rows_considered"], 6)
        self.assertEqual(ev["result"], 120000)

    def test_07_group_by_sum(self):
        """Verify group_by_sum aggregates per group with stable sorting."""
        df = self.sales_df.copy()
        res = perform_analysis(
            df,
            operation="group_by_sum",
            column="revenue",
            group_by="product",
        )

        self.assertEqual(res["operation"], "group_by_sum")
        self.assertEqual(res["column"], "revenue")
        self.assertEqual(res["group_by"], "product")

        # Stable alphabetical order: Laptop, Phone, Tablet
        expected_groups = ["Laptop", "Phone", "Tablet"]
        result_list = res["result"]
        self.assertEqual([item["group"] for item in result_list], expected_groups)

        self.assertEqual(result_list["Laptop"], 420000)
        self.assertEqual(result_list["Phone"], 195000)
        self.assertEqual(result_list["Tablet"], 80000)

        self.assertEqual(res["groups"]["Laptop"], 420000)
        self.assertEqual(res["groups"]["Phone"], 195000)
        self.assertEqual(res["groups"]["Tablet"], 80000)

        ev = res["evidence"]
        self.assertEqual(ev["total_groups"], 3)
        self.assertEqual(len(ev["group_details"]), 3)

    def test_08_group_by_average(self):
        """Verify group_by_average calculates correct group averages."""
        df = self.sales_df.copy()
        res = perform_analysis(
            df,
            operation="group_by_average",
            column="revenue",
            group_by="product",
        )

        result_list = res["result"]
        self.assertEqual(result_list["Laptop"], 140000.0)
        self.assertEqual(result_list["Phone"], 97500.0)
        self.assertEqual(result_list["Tablet"], 80000.0)

    def test_09_group_by_count(self):
        """Verify group_by_count counts occurrences per group."""
        df = self.sales_df.copy()
        res = perform_analysis(
            df,
            operation="group_by_count",
            column="revenue",
            group_by="product",
        )

        result_list = res["result"]
        self.assertEqual(result_list["Laptop"], 3)
        self.assertEqual(result_list["Phone"], 2)
        self.assertEqual(result_list["Tablet"], 1)

    def test_10_missing_column_error(self):
        """Verify clear deterministic error for non-existent columns."""
        df = self.sales_df.copy()
        with self.assertRaises(ValueError) as ctx:
            perform_analysis(df, operation="sum", column="non_existent_col")
        self.assertIn("non_existent_col", str(ctx.exception))
        self.assertIn("does not exist", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx2:
            perform_analysis(
                df,
                operation="group_by_sum",
                column="revenue",
                group_by="missing_group_col",
            )
        self.assertIn("missing_group_col", str(ctx2.exception))

    def test_11_invalid_operation_error(self):
        """Verify clear deterministic error for unsupported operations."""
        df = self.sales_df.copy()
        with self.assertRaises(ValueError) as ctx:
            perform_analysis(df, operation="unsupported_op", column="revenue")
        self.assertIn("Unsupported operation", str(ctx.exception))

    def test_12_non_numeric_rejection(self):
        """Verify non-numeric columns are strictly rejected for numeric operations."""
        df = self.sales_df.copy()
        numeric_ops = ["sum", "average", "min", "max", "median", "group_by_sum", "group_by_average"]
        for op in numeric_ops:
            with self.assertRaises(ValueError) as ctx:
                perform_analysis(
                    df,
                    operation=op,
                    column="product",  # text column
                    group_by="category" if "group_by" in op else None,
                )
            self.assertIn("non-numeric", str(ctx.exception).lower())

        # Boolean columns must also be rejected
        df_bool = pd.DataFrame({"flag": [True, False, True]})
        with self.assertRaises(ValueError):
            perform_analysis(df_bool, operation="sum", column="flag")

    def test_13_json_safety(self):
        """Ensure report never contains NaN, Inf, -Inf, or unhandled pandas NA."""
        df_messy = pd.DataFrame({
            "group": ["A", "B", "A", None],
            "val": [10.0, float("nan"), float("inf"), float("-inf")],
            "text": ["x", pd.NA, "z", None],
        })

        for op in ["sum", "average", "count", "min", "max", "median"]:
            res = perform_analysis(df_messy, operation=op, column="val")
            json_str = json.dumps(res)
            self.assertNotIn("NaN", json_str)
            self.assertNotIn("Infinity", json_str)

        gb_res = perform_analysis(df_messy, operation="group_by_sum", column="val", group_by="group")
        gb_json = json.dumps(gb_res)
        self.assertNotIn("NaN", gb_json)
        self.assertNotIn("Infinity", gb_json)

    def test_14_dataframe_immutability(self):
        """Verify dataframe is not mutated during analysis operations."""
        df = self.sales_df.copy()
        df_original = self.sales_df.copy()

        perform_analysis(df, operation="sum", column="revenue")
        perform_analysis(df, operation="average", column="revenue")
        perform_analysis(df, operation="group_by_sum", column="revenue", group_by="product")

        pd.testing.assert_frame_equal(df, df_original)

    def test_15_deterministic_group_ordering(self):
        """Verify groups maintain identical stable ordering even if dataset rows are shuffled."""
        df1 = self.sales_df.copy()
        df2 = self.sales_df.sample(frac=1.0, random_state=42).reset_index(drop=True)

        res1 = perform_analysis(df1, operation="group_by_sum", column="revenue", group_by="product")
        res2 = perform_analysis(df2, operation="group_by_sum", column="revenue", group_by="product")

        keys1 = [item["group"] for item in res1["result"]]
        keys2 = [item["group"] for item in res2["result"]]
        self.assertEqual(keys1, keys2)
        self.assertEqual(keys1, ["Laptop", "Phone", "Tablet"])

    def test_16_missing_value_behavior(self):
        """Verify missing values are handled explicitly and recorded in evidence."""
        df = pd.DataFrame({
            "category": ["A", "A", "B", None],
            "revenue": [100.0, None, 200.0, 50.0],
        })

        # Scalar with missing
        res = perform_analysis(df, operation="sum", column="revenue")
        self.assertEqual(res["result"], 350)
        self.assertEqual(res["evidence"]["missing_values_excluded"], 1)

        # Count with missing: counts non-null only
        res_count = perform_analysis(df, operation="count", column="revenue")
        self.assertEqual(res_count["result"], 3)
        self.assertEqual(res_count["evidence"]["missing_values_excluded"], 1)

        # Group-by with missing group values
        res_gb = perform_analysis(df, operation="group_by_sum", column="revenue", group_by="category")
        self.assertEqual(res_gb["result"]["A"], 100)
        self.assertEqual(res_gb["result"]["B"], 200)
        self.assertNotIn("None", res_gb["groups"])
        self.assertEqual(res_gb["evidence"]["missing_group_rows_excluded"], 1)

    def test_17_empty_dataset_behavior(self):
        """Verify empty datasets produce safe deterministic results without errors or NaN."""
        df_empty = pd.DataFrame(columns=["name", "amount"])
        df_empty["amount"] = pd.to_numeric(df_empty["amount"])

        res_sum = perform_analysis(df_empty, operation="sum", column="amount")
        self.assertEqual(res_sum["result"], 0)
        self.assertEqual(res_sum["evidence"]["rows_considered"], 0)

        res_avg = perform_analysis(df_empty, operation="average", column="amount")
        self.assertIsNone(res_avg["result"])

        res_gb = perform_analysis(df_empty, operation="group_by_sum", column="amount", group_by="name")
        self.assertEqual(len(res_gb["result"]), 0)

    def test_18_api_endpoint_integration(self):
        """Verify POST /analyze via analyze API endpoint with stored datasets."""
        # 1. Test sales.csv direct loading
        req = AnalysisRequest(
            dataset_id="sales",
            operation="sum",
            column="revenue",
        )
        resp = analyze(req)
        self.assertEqual(resp.result, 695000)
        self.assertEqual(resp.operation, "sum")
        self.assertEqual(resp.evidence["rows_considered"], 6)

        # 2. Test group-by via API
        req_gb = AnalysisRequest(
            dataset_id="sales",
            operation="group_by_sum",
            column="revenue",
            group_by="product",
        )
        resp_gb = analyze(req_gb)
        self.assertEqual(resp_gb.result["Laptop"], 420000)
        self.assertEqual(resp_gb.groups["Laptop"], 420000)

        # 3. Test 404 for unknown dataset_id
        from fastapi import HTTPException
        req_missing = AnalysisRequest(
            dataset_id="non_existent_dataset_12345",
            operation="sum",
            column="revenue",
        )
        with self.assertRaises(HTTPException) as ctx:
            analyze(req_missing)
        self.assertEqual(ctx.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
