import json
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd
from api.analysis import analyze, verify_proof
from models.analysis import AnalysisRequest, VerificationRequest
from services.analysis import analyze_dataset, perform_analysis, verify_analysis_proof
from services.profiler import profile_dataframe


class TestFormalProofLayer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sales_path = PROJECT_ROOT / "datasets" / "sales.csv"
        cls.sales_df = pd.read_csv(cls.sales_path)

    def test_01_sum_produces_valid_proof(self):
        """Verify SUM operation produces a valid proof object with all required fields."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")

        self.assertIn("proof", res)
        proof = res["proof"]

        self.assertEqual(proof["proof_version"], "1.0.0")
        self.assertEqual(proof["operation"], "sum")
        self.assertEqual(proof["target_column"], "revenue")
        self.assertEqual(proof["result"], 695000)
        self.assertIn("calculation", proof)
        self.assertIn("formula", proof)
        self.assertIn("verification", proof)

    def test_02_average_produces_valid_proof(self):
        """Verify AVERAGE operation produces a valid proof object."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="average", column="revenue", dataset_id="sales")

        self.assertIn("proof", res)
        proof = res["proof"]

        self.assertEqual(proof["operation"], "average")
        self.assertEqual(proof["target_column"], "revenue")
        expected_avg = round(695000 / 6, 4)
        self.assertEqual(proof["result"], expected_avg)
        self.assertIn("arithmetic mean", proof["formula"].lower())

    def test_03_group_by_sum_produces_per_group_proof_details(self):
        """Verify GROUP_BY_SUM produces deterministic per-group proof details."""
        df = self.sales_df.copy()
        res = perform_analysis(
            df,
            operation="group_by_sum",
            column="revenue",
            group_by="product",
            dataset_id="sales",
        )

        self.assertIn("proof", res)
        proof = res["proof"]

        self.assertEqual(proof["operation"], "group_by_sum")
        self.assertEqual(proof["target_column"], "revenue")
        self.assertEqual(proof["group_by_column"], "product")

        group_details = proof["group_details"]
        self.assertIsNotNone(group_details)
        self.assertEqual(len(group_details), 3)

        group_names = [g["group"] for g in group_details]
        self.assertEqual(group_names, ["Laptop", "Phone", "Tablet"])

        laptop_detail = next(g for g in group_details if g["group"] == "Laptop")
        self.assertEqual(laptop_detail["rows_considered"], 3)
        self.assertEqual(laptop_detail["result"], 420000)

    def test_04_proof_contains_correct_dataset_id(self):
        """Verify proof accurately includes the target dataset_id."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales_dataset_99")
        proof = res["proof"]
        self.assertEqual(proof["dataset_id"], "sales_dataset_99")

    def test_05_proof_contains_correct_source_columns(self):
        """Verify proof contains the exact list of source columns from the dataset."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")
        proof = res["proof"]
        self.assertEqual(
            proof["source_columns"],
            ["date", "product", "category", "quantity", "revenue"],
        )

    def test_06_proof_contains_correct_row_counts(self):
        """Verify proof includes dataset_rows, rows_considered, and valid_rows_count."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")
        proof = res["proof"]

        self.assertEqual(proof["dataset_rows"], 6)
        self.assertEqual(proof["rows_considered"], 6)
        self.assertEqual(proof["valid_rows_count"], 6)
        self.assertEqual(proof["rows_excluded"], 0)

    def test_07_proof_records_exclusions_correctly(self):
        """Verify proof accurately logs row exclusions and non-empty reasons when missing/inf values exist."""
        df = pd.DataFrame({
            "group": ["A", "A", "B", None],
            "val": [100.0, float("nan"), float("inf"), 50.0],
        })
        res = perform_analysis(df, operation="sum", column="val", dataset_id="messy_id")
        proof = res["proof"]

        self.assertEqual(proof["dataset_rows"], 4)
        self.assertEqual(proof["rows_considered"], 4)
        self.assertEqual(proof["missing_values_excluded"], 1)
        self.assertEqual(proof["non_finite_values_excluded"], 1)
        self.assertEqual(proof["rows_excluded"], 2)
        self.assertTrue(len(proof["exclusion_reasons"]) >= 2)

    def test_08_clean_dataset_quality_status_link(self):
        """Verify proof links to data quality report and records status/score."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")
        proof = res["proof"]

        self.assertEqual(proof["data_quality_status"], "pass")
        self.assertEqual(proof["data_quality_score"], 100)
        self.assertEqual(proof["data_quality_critical_issues_count"], 0)

    def test_09_proof_is_json_serializable(self):
        """Verify proof is JSON serializable and contains no NaN or Infinity tokens."""
        df = pd.DataFrame({
            "num": [1.0, float("nan"), float("inf"), float("-inf")],
            "str_col": ["a", pd.NA, "c", None],
        })
        res = perform_analysis(df, operation="sum", column="num", dataset_id="json_test")
        proof = res["proof"]

        serialized = json.dumps(proof)
        deserialized = json.loads(serialized)
        self.assertIsInstance(deserialized, dict)
        self.assertNotIn("NaN", serialized)
        self.assertNotIn("Infinity", serialized)

    def test_10_proof_is_deterministic(self):
        """Verify identical inputs produce identical proof objects."""
        df = self.sales_df.copy()
        res1 = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")
        res2 = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")

        json1 = json.dumps(res1["proof"])
        json2 = json.dumps(res2["proof"])
        self.assertEqual(json1, json2)

    def test_11_verification_accepts_valid_proof_and_rejects_tampered_proof(self):
        """Verify proof verification passes valid proofs and rejects tampered ones."""
        df = self.sales_df.copy()
        res = perform_analysis(df, operation="sum", column="revenue", dataset_id="sales")

        # 1. Valid verification
        verif_res = verify_analysis_proof(res)
        self.assertTrue(verif_res["verified"])
        self.assertEqual(verif_res["verification_status"], "passed")
        self.assertEqual(verif_res["verified_result"], 695000)

        # 2. Tampered result mismatch
        tampered = json.loads(json.dumps(res))
        tampered["result"] = 999999
        with self.assertRaises(ValueError) as ctx:
            verify_analysis_proof(tampered)
        self.assertIn("does not match", str(ctx.exception))

        # 3. Tampered row accounting
        tampered_rows = json.loads(json.dumps(res))
        tampered_rows["proof"]["dataset_rows"] = 999
        with self.assertRaises(ValueError) as ctx2:
            verify_analysis_proof(tampered_rows)
        self.assertIn("rows_considered", str(ctx2.exception))

        # 4. Missing target column in source_columns
        tampered_cols = json.loads(json.dumps(res))
        tampered_cols["proof"]["source_columns"] = ["other_col"]
        with self.assertRaises(ValueError) as ctx3:
            verify_analysis_proof(tampered_cols)
        self.assertIn("Target column", str(ctx3.exception))

    def test_12_verify_api_endpoint(self):
        """Verify POST /verify endpoint verifies proof payloads."""
        req_analysis = AnalysisRequest(dataset_id="sales", operation="sum", column="revenue")
        analysis_resp = analyze(req_analysis)

        # Send to /verify endpoint
        req_verify = VerificationRequest(response=analysis_resp.model_dump())
        verify_resp = verify_proof(req_verify)

        self.assertTrue(verify_resp.verified)
        self.assertEqual(verify_resp.verification_status, "passed")
        self.assertEqual(verify_resp.verified_result, 695000)


if __name__ == "__main__":
    unittest.main()
