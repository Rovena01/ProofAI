import json
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd
from fastapi import HTTPException
from api.analysis import analyze_counterfactual
from models.analysis import CounterfactualRequest, CounterfactualResponse
from services.analysis import (
    load_dataset_dataframe,
    perform_counterfactual_analysis,
    verify_analysis_proof,
)


class TestCounterfactualProofEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sales_path = PROJECT_ROOT / "datasets" / "sales.csv"
        cls.original_sales_content = cls.sales_path.read_text(encoding="utf-8")

    def tearDown(self):
        # Guarantee dataset on disk is never altered
        current_content = self.sales_path.read_text(encoding="utf-8")
        self.assertEqual(
            current_content,
            self.original_sales_content,
            "CRITICAL: sales.csv on disk was modified during test execution!",
        )

    def test_01_scalar_sum_category_exclusion(self):
        """1. Scalar sum with category exclusion: 695000 -> 500000 when Phone is excluded."""
        res = perform_counterfactual_analysis(
            dataset_id="sales",
            operation="sum",
            column="revenue",
            exclude_column="product",
            exclude_value="Phone",
        )

        self.assertEqual(res["original_rows"], 6)
        self.assertEqual(res["counterfactual_rows"], 4)
        self.assertEqual(res["rows_excluded_by_condition"], 2)
        self.assertEqual(res["original_result"], 695000)
        self.assertEqual(res["counterfactual_result"], 500000)
        self.assertEqual(res["difference"], -195000)
        # (500000 - 695000) / 695000 * 100 = -28.05755... -> -28.06%
        self.assertAlmostEqual(res["percentage_change"], -28.06, places=2)

    def test_02_groupby_sum_category_exclusion(self):
        """2. Group-by sum with category exclusion preserves other groups and calculates differences."""
        res = perform_counterfactual_analysis(
            dataset_id="sales",
            operation="group_by_sum",
            column="revenue",
            group_by="product",
            exclude_column="product",
            exclude_value="Phone",
        )

        self.assertEqual(res["original_rows"], 6)
        self.assertEqual(res["counterfactual_rows"], 4)
        self.assertEqual(res["rows_excluded_by_condition"], 2)

        # Baseline groups
        orig_map = {item["group"]: item["value"] for item in res["original_result"]}
        self.assertEqual(orig_map["Laptop"], 420000)
        self.assertEqual(orig_map["Phone"], 195000)
        self.assertEqual(orig_map["Tablet"], 80000)

        # Counterfactual groups
        cf_map = {item["group"]: item["value"] for item in res["counterfactual_result"]}
        self.assertEqual(cf_map["Laptop"], 420000)
        self.assertEqual(cf_map["Tablet"], 80000)
        self.assertNotIn("Phone", cf_map)

        # Group differences
        group_diffs = {g["group"]: g for g in res["group_differences"]}
        self.assertIn("Phone", group_diffs)
        self.assertEqual(group_diffs["Phone"]["status"], "excluded")
        self.assertEqual(group_diffs["Phone"]["counterfactual"], 0)
        self.assertEqual(group_diffs["Phone"]["difference"], -195000)

        self.assertEqual(group_diffs["Laptop"]["status"], "recalculated")
        self.assertEqual(group_diffs["Laptop"]["difference"], 0)

        self.assertEqual(res["difference"], -195000)
        self.assertAlmostEqual(res["percentage_change"], -28.06, places=2)

    def test_03_counterfactual_proof_is_valid_and_verified(self):
        """3. Counterfactual proof satisfies all formal verification invariants."""
        res = perform_counterfactual_analysis(
            dataset_id="sales",
            operation="sum",
            column="revenue",
            exclude_column="product",
            exclude_value="Phone",
        )

        orig_proof = res["original_proof"]
        cf_proof = res["counterfactual_proof"]

        # Baseline proof verification
        orig_verif = verify_analysis_proof(orig_proof)
        self.assertTrue(orig_verif["verified"])
        self.assertEqual(orig_verif["verification_status"], "passed")

        # Counterfactual proof verification
        cf_verif = verify_analysis_proof(cf_proof)
        self.assertTrue(cf_verif["verified"])
        self.assertEqual(cf_verif["verification_status"], "passed")

        # Verify counterfactual context metadata
        ctx = cf_proof.get("counterfactual_context")
        self.assertIsNotNone(ctx)
        self.assertEqual(ctx["type"], "categorical_exclusion")
        self.assertEqual(ctx["column"], "product")
        self.assertEqual(ctx["excluded_value"], "Phone")
        self.assertEqual(ctx["rows_excluded_by_condition"], 2)
        self.assertEqual(ctx["original_rows"], 6)
        self.assertEqual(ctx["counterfactual_rows"], 4)

        # Row accounting invariant
        self.assertEqual(cf_proof["dataset_rows"], 4)
        self.assertEqual(cf_proof["rows_considered"], 4)
        self.assertEqual(cf_proof["valid_rows_count"], 4)
        self.assertEqual(cf_proof["rows_excluded"], 0)
        self.assertEqual(cf_proof["result"], 500000)

    def test_04_source_data_and_original_dataframe_immutability(self):
        """4. Source data and original dataframe remain strictly immutable."""
        original_df = load_dataset_dataframe("sales")
        initial_row_count = len(original_df)
        initial_phone_count = (original_df["product"] == "Phone").sum()

        res = perform_counterfactual_analysis(
            dataset_id="sales",
            operation="sum",
            column="revenue",
            exclude_column="product",
            exclude_value="Phone",
        )

        reloaded_df = load_dataset_dataframe("sales")
        self.assertEqual(len(reloaded_df), initial_row_count)
        self.assertEqual((reloaded_df["product"] == "Phone").sum(), initial_phone_count)

    def test_05_non_existent_exclusion_column_rejected(self):
        """5. Non-existent exclusion column is safely rejected."""
        with self.assertRaises(ValueError) as ctx:
            perform_counterfactual_analysis(
                dataset_id="sales",
                operation="sum",
                column="revenue",
                exclude_column="non_existent_category_column",
                exclude_value="Phone",
            )
        self.assertIn("does not exist in dataset", str(ctx.exception).lower())

    def test_06_non_existent_exclusion_value_rejected(self):
        """6. Non-existent exclusion value is safely rejected."""
        with self.assertRaises(ValueError) as ctx:
            perform_counterfactual_analysis(
                dataset_id="sales",
                operation="sum",
                column="revenue",
                exclude_column="product",
                exclude_value="QuantumSupercomputer",
            )
        self.assertIn("not found in column", str(ctx.exception).lower())

    def test_07_exclusion_resulting_in_zero_rows_rejected(self):
        """7. Exclusion removing 100% of rows is safely rejected."""
        from services.storage import generate_dataset_id, save_uploaded_csv, remove_uploaded_dataset
        df_single_cat = pd.DataFrame({
            "category": ["Alpha", "Alpha", "Alpha"],
            "amount": [10, 20, 30],
        })
        ds_id = generate_dataset_id()
        try:
            save_uploaded_csv(
                dataset_id=ds_id,
                original_filename="all_alpha.csv",
                content=df_single_cat.to_csv(index=False).encode("utf-8"),
            )

            with self.assertRaises(ValueError) as ctx:
                perform_counterfactual_analysis(
                    dataset_id=ds_id,
                    operation="sum",
                    column="amount",
                    exclude_column="category",
                    exclude_value="Alpha",
                )
            self.assertIn("removes all", str(ctx.exception).lower())
        finally:
            remove_uploaded_dataset(ds_id)

    def test_08_api_endpoint_integration(self):
        """8. POST /analyze/counterfactual integration test via analyze_counterfactual router."""
        req = CounterfactualRequest(
            dataset_id="sales",
            operation="sum",
            column="revenue",
            exclude_column="product",
            exclude_value="Phone",
        )

        resp = analyze_counterfactual(req)
        self.assertIsInstance(resp, CounterfactualResponse)
        self.assertEqual(resp.original_result, 695000)
        self.assertEqual(resp.counterfactual_result, 500000)
        self.assertEqual(resp.difference, -195000)
        self.assertAlmostEqual(resp.percentage_change, -28.06, places=2)
        self.assertEqual(resp.original_rows, 6)
        self.assertEqual(resp.counterfactual_rows, 4)
        self.assertEqual(resp.rows_excluded_by_condition, 2)
        self.assertEqual(resp.condition["excluded_value"], "Phone")

        # Test 400 when invalid column passed to endpoint
        bad_req = CounterfactualRequest(
            dataset_id="sales",
            operation="sum",
            column="revenue",
            exclude_column="invalid_col",
            exclude_value="Phone",
        )
        with self.assertRaises(HTTPException) as ctx:
            analyze_counterfactual(bad_req)
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
