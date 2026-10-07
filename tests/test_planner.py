import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd
from fastapi import HTTPException

from api.analysis import analyze
from api.planner import plan
from models.analysis import AnalysisRequest
from models.planner import PlanRequest, AnalysisPlan
from services.planner import plan_question


class TestNaturalLanguagePlanner(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sales_path = PROJECT_ROOT / "datasets" / "sales.csv"
        cls.sales_df = pd.read_csv(cls.sales_path)

    def test_01_total_revenue(self):
        """'what is the total revenue?' -> sum(revenue)"""
        plan_res = plan_question("sales", "what is the total revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertFalse(plan_res.clarification_required)
        self.assertEqual(plan_res.operation, "sum")
        self.assertEqual(plan_res.column, "revenue")
        self.assertIsNone(plan_res.group_by)
        self.assertIsNotNone(plan_res.analysis_request)
        self.assertEqual(plan_res.analysis_request.operation, "sum")
        self.assertEqual(plan_res.analysis_request.column, "revenue")

    def test_02_sum_revenue(self):
        """'what is the sum of revenue?' -> sum(revenue)"""
        plan_res = plan_question("sales", "what is the sum of revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "sum")
        self.assertEqual(plan_res.column, "revenue")

    def test_03_average_revenue(self):
        """'what is the average revenue?' -> average(revenue)"""
        plan_res = plan_question("sales", "what is the average revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "average")
        self.assertEqual(plan_res.column, "revenue")

    def test_04_mean_revenue(self):
        """'what is the mean revenue?' -> average(revenue)"""
        plan_res = plan_question("sales", "what is the mean revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "average")
        self.assertEqual(plan_res.column, "revenue")

    def test_05_minimum_revenue(self):
        """'what is the minimum revenue?' -> min(revenue)"""
        plan_res = plan_question("sales", "what is the minimum revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "min")
        self.assertEqual(plan_res.column, "revenue")

    def test_06_maximum_revenue(self):
        """'what is the maximum revenue?' -> max(revenue)"""
        plan_res = plan_question("sales", "what is the maximum revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "max")
        self.assertEqual(plan_res.column, "revenue")

    def test_07_highest_revenue(self):
        """'what is the highest revenue?' -> max(revenue)"""
        plan_res = plan_question("sales", "what is the highest revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "max")
        self.assertEqual(plan_res.column, "revenue")

    def test_08_lowest_revenue(self):
        """'what is the lowest revenue?' -> min(revenue)"""
        plan_res = plan_question("sales", "what is the lowest revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "min")
        self.assertEqual(plan_res.column, "revenue")

    def test_09_median_revenue(self):
        """'what is the median revenue?' -> median(revenue)"""
        plan_res = plan_question("sales", "what is the median revenue?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "median")
        self.assertEqual(plan_res.column, "revenue")

    def test_10_revenue_by_product(self):
        """'what is the total revenue by product?' & 'show revenue by product' -> group_by_sum(revenue, product)"""
        p1 = plan_question("sales", "what is the total revenue by product?")
        self.assertEqual(p1.status, "ready")
        self.assertEqual(p1.operation, "group_by_sum")
        self.assertEqual(p1.column, "revenue")
        self.assertEqual(p1.group_by, "product")

        p2 = plan_question("sales", "show revenue by product")
        self.assertEqual(p2.status, "ready")
        self.assertEqual(p2.operation, "group_by_sum")
        self.assertEqual(p2.column, "revenue")
        self.assertEqual(p2.group_by, "product")

    def test_11_average_revenue_by_product(self):
        """'what is the average revenue by product?' -> group_by_average(revenue, product)"""
        plan_res = plan_question("sales", "what is the average revenue by product?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "group_by_average")
        self.assertEqual(plan_res.column, "revenue")
        self.assertEqual(plan_res.group_by, "product")

    def test_12_count_by_product(self):
        """'what is the count of sales by product?' -> group_by_count(..., product)"""
        plan_res = plan_question("sales", "what is the count of sales by product?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.operation, "group_by_count")
        self.assertEqual(plan_res.group_by, "product")
        self.assertIsNotNone(plan_res.column)

    def test_13_case_insensitive_matching(self):
        """Verify case-insensitive column matching works reliably."""
        plan_res = plan_question("sales", "WHAT IS THE TOTAL REVENUE?")
        self.assertEqual(plan_res.status, "ready")
        self.assertEqual(plan_res.column, "revenue")
        self.assertEqual(plan_res.operation, "sum")

    def test_14_normalized_matching(self):
        """Verify normalized matching handles underscores, hyphens, and whitespace variations."""
        from services.planner import find_matching_column

        cols = ["Unit Price", "Total_Amount", "sales-tax"]
        self.assertEqual(find_matching_column("unit_price", cols), "Unit Price")
        self.assertEqual(find_matching_column("unit-price", cols), "Unit Price")
        self.assertEqual(find_matching_column("Unit Price", cols), "Unit Price")
        self.assertEqual(find_matching_column("total amount", cols), "Total_Amount")
        self.assertEqual(find_matching_column("sales_tax", cols), "sales-tax")

    def test_15_unknown_column(self):
        """'what is the sum of profit?' -> clarification required (column not found)"""
        plan_res = plan_question("sales", "what is the sum of profit?")
        self.assertEqual(plan_res.status, "clarification_required")
        self.assertTrue(plan_res.clarification_required)
        self.assertIn("profit", plan_res.clarification_message)
        self.assertIn("Available columns", plan_res.clarification_message)
        self.assertIsNone(plan_res.analysis_request)

    def test_16_ambiguous_question(self):
        """'show the total' when multiple numeric columns exist -> clarification required"""
        plan_res = plan_question("sales", "show the total")
        self.assertEqual(plan_res.status, "clarification_required")
        self.assertTrue(plan_res.clarification_required)
        self.assertIn("Ambiguous request", plan_res.clarification_message)
        self.assertIn("quantity", plan_res.candidate_columns)
        self.assertIn("revenue", plan_res.candidate_columns)
        self.assertIsNone(plan_res.analysis_request)

    def test_17_unsupported_question(self):
        """'compare products' or 'forecast sales' -> unsupported intent"""
        p1 = plan_question("sales", "compare products")
        self.assertEqual(p1.status, "unsupported")
        self.assertTrue(p1.clarification_required)
        self.assertIn("Unsupported", p1.clarification_message)

        p2 = plan_question("sales", "forecast revenue for next month")
        self.assertEqual(p2.status, "unsupported")
        self.assertTrue(p2.clarification_required)

    def test_18_unknown_dataset(self):
        """Unknown dataset returns FileNotFoundError / 404"""
        with self.assertRaises(FileNotFoundError):
            plan_question("nonexistent_dataset_9999", "what is the total revenue?")

        # Via API function
        with self.assertRaises(HTTPException) as ctx:
            plan(PlanRequest(
                dataset_id="nonexistent_dataset_9999",
                question="what is the total revenue?"
            ))
        self.assertEqual(ctx.exception.status_code, 404)

    def test_19_empty_question(self):
        """Empty or whitespace-only question raises ValueError / 400"""
        with self.assertRaises(ValueError):
            plan_question("sales", "")

        with self.assertRaises(ValueError):
            plan_question("sales", "   ")

        with self.assertRaises(ValueError):
            PlanRequest(dataset_id="sales", question="   ")

    def test_20_deterministic_repeatability(self):
        """Repeated identical queries must produce byte-for-byte identical plans."""
        plans = [plan_question("sales", "what is the average revenue by product?").model_dump() for _ in range(25)]
        first_json = json.dumps(plans[0], sort_keys=True)
        for i, p in enumerate(plans[1:], 1):
            self.assertEqual(json.dumps(p, sort_keys=True), first_json)

    def test_21_strict_zero_calculation_guarantee(self):
        """
        Verify that plan_question NEVER performs calculations, never imports or invokes
        perform_analysis, and outputs an AnalysisPlan without any calculated results or proofs.
        """
        with patch("services.analysis.perform_analysis") as mock_calc:
            plan_res = plan_question("sales", "what is the total revenue by product?")
            # Ensure analysis engine calculation was NOT called
            mock_calc.assert_not_called()

        plan_dict = plan_res.model_dump()
        # Verify no calculation output fields exist in AnalysisPlan
        self.assertNotIn("result", plan_dict)
        self.assertNotIn("proof", plan_dict)
        self.assertNotIn("evidence", plan_dict)
        self.assertNotIn("groups", plan_dict)

    def test_22_dataframe_immutability(self):
        """Verify the underlying dataset is never modified during planning."""
        df_before = pd.read_csv(self.sales_path)
        plan_question("sales", "what is the total revenue by product?")
        plan_question("sales", "what is the average revenue?")
        df_after = pd.read_csv(self.sales_path)
        pd.testing.assert_frame_equal(df_before, df_after)

    def test_23_natural_grouping_phrases(self):
        """Verify support for 'by', 'per', 'for each', and 'grouped by'."""
        phrases = [
            "total revenue by product",
            "total revenue per product",
            "total revenue for each product",
            "total revenue grouped by product",
        ]
        for phrase in phrases:
            p = plan_question("sales", phrase)
            self.assertEqual(p.status, "ready", f"Failed for phrase: {phrase}")
            self.assertEqual(p.operation, "group_by_sum", f"Failed for phrase: {phrase}")
            self.assertEqual(p.column, "revenue", f"Failed for phrase: {phrase}")
            self.assertEqual(p.group_by, "product", f"Failed for phrase: {phrase}")

    def test_24_type_compatibility_check(self):
        """Verify requesting a numeric calculation on a text column is flagged."""
        plan_res = plan_question("sales", "what is the sum of product?")
        self.assertEqual(plan_res.status, "clarification_required")
        self.assertTrue(plan_res.clarification_required)
        self.assertIn("requires a numeric column", plan_res.clarification_message)
        self.assertIn("non-numeric", plan_res.clarification_message)
        self.assertIn("revenue", plan_res.candidate_columns)

    def test_25_two_stage_decoupled_flow(self):
        """
        Verify the decoupled two-stage architecture:
        Stage A: POST /plan produces strictly an AnalysisPlan blueprint (no calculation).
        Stage B: Caller takes AnalysisRequest and calls POST /analyze to perform calculation & proof.
        """
        # Stage A: Planning only via plan endpoint function
        req_plan = PlanRequest(
            dataset_id="sales",
            question="what is the total revenue by product?"
        )
        plan_resp = plan(req_plan)

        self.assertEqual(plan_resp.status, "ready")
        self.assertFalse(plan_resp.clarification_required)
        plan_dict = plan_resp.model_dump()
        self.assertNotIn("result", plan_dict)
        self.assertNotIn("proof", plan_dict)
        self.assertIsNotNone(plan_resp.analysis_request)

        # Stage B: Execution only via separate analyze call
        exec_request = plan_resp.to_analysis_request()
        self.assertIsInstance(exec_request, AnalysisRequest)
        analysis_resp = analyze(exec_request)

        # Calculation, evidence, and formal proof are present ONLY in Stage B
        self.assertIsNotNone(analysis_resp.result)
        self.assertIsNotNone(analysis_resp.proof)
        self.assertIsNotNone(analysis_resp.evidence)
        self.assertEqual(analysis_resp.groups["Laptop"], 420000)
        self.assertEqual(analysis_resp.proof.verification.verification_status, "passed")

    def test_26_strict_group_by_no_first_word_guessing(self):
        """
        Verify that an unresolved multi-word grouping phrase such as 'by product monthly'
        does NOT silently match the first word 'product'.
        """
        plan_res = plan_question("sales", "what is the total revenue by product monthly?")
        self.assertEqual(plan_res.status, "clarification_required")
        self.assertTrue(plan_res.clarification_required)
        self.assertIsNone(plan_res.group_by)
        self.assertIsNone(plan_res.analysis_request)
        self.assertIn("product monthly", plan_res.clarification_message)

    def test_27_conflicting_operation_detection(self):
        """
        Verify that multiple distinct operations (e.g. 'average total revenue') trigger
        a clarification requirement rather than silently choosing the first keyword.
        Also verifies synonymous keywords for the same operation do not trigger a conflict.
        """
        # 1. Distinct conflicting operations: average vs sum
        conflict_res = plan_question("sales", "what is the average total revenue?")
        self.assertEqual(conflict_res.status, "clarification_required")
        self.assertTrue(conflict_res.clarification_required)
        self.assertIsNone(conflict_res.analysis_request)
        self.assertIn("multiple analysis operations", conflict_res.clarification_message)
        self.assertIn("average, sum", conflict_res.clarification_message)

        # 2. Synonyms mapping to the same canonical operation (e.g. 'total sum') do not conflict
        synonym_res = plan_question("sales", "what is the total sum of revenue?")
        self.assertEqual(synonym_res.status, "ready")
        self.assertFalse(synonym_res.clarification_required)
        self.assertEqual(synonym_res.operation, "sum")
        self.assertEqual(synonym_res.column, "revenue")


if __name__ == "__main__":
    unittest.main()
