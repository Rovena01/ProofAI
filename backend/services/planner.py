"""
Deterministic Natural Language Planner Service.

Interprets natural language queries into strictly validated AnalysisPlan
objects without calculating results, mutating dataframes, or calling LLM APIs.
"""

import re
from typing import List, Optional, Tuple

import pandas as pd

from models.analysis import (
    ALL_SUPPORTED_OPERATIONS,
    NUMERIC_OPERATIONS,
    SUPPORTED_GROUP_BY_OPERATIONS,
    AnalysisRequest,
)
from models.planner import AnalysisPlan
from services.analysis import is_numeric_column, load_dataset_dataframe

# Regular expressions for natural grouping phrases
GROUP_BY_PATTERN = re.compile(
    r"\b(?:grouped\s+by|group\s+by|for\s+each|per|by)\s+([a-zA-Z0-9_\-\s]+)$",
    re.IGNORECASE,
)

# Common stopwords to strip when extracting column intent
QUESTION_STOPWORDS = {
    "what", "is", "the", "of", "in", "for", "a", "an", "are", "there",
    "show", "me", "find", "give", "tell", "get", "calculate", "please",
    "all", "from", "on", "sales", "records", "rows", "data", "dataset",
}

# Supported operation keyword mapping
OPERATION_KEYWORDS = [
    # (regex pattern, operation name)
    (re.compile(r"\b(?:average|mean|avg)\b", re.IGNORECASE), "average"),
    (re.compile(r"\b(?:median|50th\s+percentile)\b", re.IGNORECASE), "median"),
    (re.compile(r"\b(?:minimum|min|lowest|least|smallest)\b", re.IGNORECASE), "min"),
    (re.compile(r"\b(?:maximum|max|highest|greatest|largest)\b", re.IGNORECASE), "max"),
    (re.compile(r"\b(?:count|number\s+of|how\s+many)\b", re.IGNORECASE), "count"),
    (re.compile(r"\b(?:total|sum|add\s+up)\b", re.IGNORECASE), "sum"),
]


def normalize_token(s: str) -> str:
    """Normalize a string by replacing hyphens and underscores with spaces and lowercasing."""
    return re.sub(r"[\s_\-]+", " ", s).strip().lower()


def find_matching_column(name: str, available_columns: List[str]) -> Optional[str]:
    """
    Deterministically match a candidate column name against available dataset columns.
    Order of preference:
    1. Exact match
    2. Case-insensitive match
    3. Normalized match (spaces, underscores, hyphens)
    """
    clean_name = name.strip()
    if not clean_name:
        return None

    # 1. Exact match
    for col in available_columns:
        if clean_name == col:
            return col

    # 2. Case-insensitive match
    lower_name = clean_name.lower()
    for col in available_columns:
        if lower_name == col.lower():
            return col

    # 3. Normalized match (spaces, underscores, hyphens)
    norm_name = normalize_token(clean_name)
    for col in available_columns:
        if norm_name == normalize_token(col):
            return col

    return None


def _match_column_in_text(col: str, text: str, norm_text: str) -> bool:
    clean_col = col.strip()
    if not clean_col:
        return False

    # Lookaround assertions ensure boundary without consuming characters or failing on trailing question marks/punctuation
    pattern = r"(?<!\w)" + re.escape(clean_col) + r"(?!\w)"
    if re.search(pattern, text, re.IGNORECASE):
        return True

    norm_col = normalize_token(clean_col)
    if norm_col:
        norm_pattern = r"(?<!\w)" + re.escape(norm_col) + r"(?!\w)"
        if re.search(norm_pattern, norm_text):
            return True

    return False


def extract_columns_from_text(text: str, available_columns: List[str]) -> List[str]:
    """
    Find which dataset columns are mentioned in the text using exact,
    case-insensitive, or normalized matching, supporting columns with symbols.
    """
    matched: List[str] = []
    norm_text = normalize_token(text)

    # Sort columns by length descending to match longer names first
    sorted_cols = sorted(available_columns, key=lambda c: len(c), reverse=True)

    for col in sorted_cols:
        if _match_column_in_text(col, text, norm_text):
            if col not in matched:
                matched.append(col)

    return matched


def parse_group_by_clause(question: str, available_columns: List[str]) -> Tuple[Optional[str], str, Optional[str]]:
    """
    Parse natural grouping clauses ('by product', 'per category', etc.).
    Returns (resolved_group_column, remaining_question_text, raw_unresolved_group_token).
    """
    # Clean trailing punctuation
    clean_q = question.strip().rstrip("?.!")

    match = GROUP_BY_PATTERN.search(clean_q)
    if not match:
        return None, clean_q, None

    raw_phrase = match.group(1).strip()
    start_pos = match.start()
    remaining_q = clean_q[:start_pos].strip()

    # Check if raw_phrase resolves to a dataset column
    resolved_col = find_matching_column(raw_phrase, available_columns)
    if resolved_col:
        return resolved_col, remaining_q, None

    # Unresolved group phrase: do not guess by matching only the first word
    return None, remaining_q, raw_phrase


def plan_question(dataset_id: str, question: str) -> AnalysisPlan:
    """
    Deterministically plan a natural language question for a dataset.
    Validates against the target dataset schema, detects ambiguity, and produces
    an AnalysisPlan without executing any calculations.
    """
    if not dataset_id or not str(dataset_id).strip():
        raise ValueError("dataset_id must be provided.")

    if not question or not str(question).strip():
        raise ValueError("question must not be empty.")

    clean_question = str(question).strip()
    dataset_id_clean = str(dataset_id).strip()

    # 1. Load dataset metadata (columns and types) via existing storage helper
    # Raises FileNotFoundError if dataset does not exist
    df = load_dataset_dataframe(dataset_id_clean)
    available_columns = [str(c) for c in df.columns]

    numeric_cols = [c for c in available_columns if is_numeric_column(df[c])]

    # 2. Parse grouping clause
    group_col, remaining_text, unresolved_group = parse_group_by_clause(
        clean_question,
        available_columns,
    )

    if unresolved_group is not None:
        return AnalysisPlan(
            dataset_id=dataset_id_clean,
            question=clean_question,
            status="clarification_required",
            clarification_required=True,
            clarification_message=(
                f"Group-by column '{unresolved_group}' does not exist in dataset '{dataset_id_clean}'. "
                f"Available columns are: {available_columns}."
            ),
            candidate_columns=available_columns,
        )

    # 3. Detect all requested operations to prevent conflicting intents
    detected_ops: List[str] = []
    for pattern, op_name in OPERATION_KEYWORDS:
        if pattern.search(remaining_text):
            if op_name not in detected_ops:
                detected_ops.append(op_name)

    if len(detected_ops) > 1:
        sorted_ops = sorted(detected_ops)
        ops_str = ", ".join(sorted_ops)
        return AnalysisPlan(
            dataset_id=dataset_id_clean,
            question=clean_question,
            status="clarification_required",
            clarification_required=True,
            clarification_message=(
                f"I detected multiple analysis operations ({ops_str}). "
                "Please specify which calculation you want."
            ),
            candidate_columns=available_columns,
        )

    detected_op: Optional[str] = detected_ops[0] if detected_ops else None

    # 4. Extract target column(s) from remaining question text
    target_cols = extract_columns_from_text(remaining_text, available_columns)

    # If count is requested with generic entity (e.g. "count of sales", "how many sales"),
    # and no explicit column was identified:
    is_count_intent = (detected_op == "count")
    if is_count_intent and not target_cols:
        # Default count column is first column in dataset
        if available_columns:
            target_cols = [available_columns[0]]

    # If no explicit op but group_by is present and a target column exists: default to sum
    # e.g., "show revenue by product" -> group_by_sum
    if not detected_op and group_col and target_cols:
        detected_op = "sum"

    # If still no operation detected:
    if not detected_op:
        return AnalysisPlan(
            dataset_id=dataset_id_clean,
            question=clean_question,
            status="unsupported",
            clarification_required=True,
            clarification_message=(
                "Unsupported analysis intent. The deterministic analyst supports: "
                "sum, average, count, min, max, median, group_by_sum, group_by_average, and group_by_count."
            ),
        )

    # 5. Handle Target Column Resolution & Ambiguity
    if not target_cols:
        # Check if an unknown column name was mentioned in question
        words = re.findall(r"\b[a-zA-Z0-9_\-]+\b", remaining_text.lower())
        meaningful_words = [w for w in words if w not in QUESTION_STOPWORDS]

        # Check if an operation keyword consumed all meaningful tokens (e.g. "show the total")
        if not meaningful_words or all(
            any(pat.search(w) for pat, _ in OPERATION_KEYWORDS) for w in meaningful_words
        ):
            # "show the total" -> ambiguous if multiple numeric columns exist
            if detected_op in NUMERIC_OPERATIONS:
                if len(numeric_cols) > 1:
                    return AnalysisPlan(
                        dataset_id=dataset_id_clean,
                        question=clean_question,
                        operation=f"group_by_{detected_op}" if group_col else detected_op,
                        group_by=group_col,
                        status="clarification_required",
                        clarification_required=True,
                        clarification_message=(
                            f"Ambiguous request: multiple numeric columns found for '{detected_op}' "
                            f"({numeric_cols}). Please specify which column to analyze."
                        ),
                        candidate_columns=numeric_cols,
                    )
                elif len(numeric_cols) == 1:
                    target_cols = [numeric_cols[0]]
                else:
                    return AnalysisPlan(
                        dataset_id=dataset_id_clean,
                        question=clean_question,
                        operation=detected_op,
                        status="clarification_required",
                        clarification_required=True,
                        clarification_message=f"Dataset contains no numeric columns for operation '{detected_op}'.",
                        candidate_columns=available_columns,
                    )
        else:
            # User named a specific target that does not exist in dataset (e.g. "sum of profit")
            unknown_candidate = " ".join(meaningful_words)
            return AnalysisPlan(
                dataset_id=dataset_id_clean,
                question=clean_question,
                operation=f"group_by_{detected_op}" if group_col else detected_op,
                group_by=group_col,
                status="clarification_required",
                clarification_required=True,
                clarification_message=(
                    f"Column '{unknown_candidate}' does not exist in dataset '{dataset_id_clean}'. "
                    f"Available columns are: {available_columns}."
                ),
                candidate_columns=available_columns,
            )

    if len(target_cols) > 1:
        # Ambiguous multiple target columns matched in question
        return AnalysisPlan(
            dataset_id=dataset_id_clean,
            question=clean_question,
            operation=f"group_by_{detected_op}" if group_col else detected_op,
            group_by=group_col,
            status="clarification_required",
            clarification_required=True,
            clarification_message=(
                f"Ambiguous request: multiple columns matched in question ({target_cols}). "
                "Please specify a single target column."
            ),
            candidate_columns=target_cols,
        )

    resolved_target_col = target_cols[0]

    # 6. Resolve final operation name (scalar vs group-by)
    if group_col:
        final_op = f"group_by_{detected_op}"
        if final_op not in SUPPORTED_GROUP_BY_OPERATIONS:
            return AnalysisPlan(
                dataset_id=dataset_id_clean,
                question=clean_question,
                operation=final_op,
                column=resolved_target_col,
                group_by=group_col,
                status="unsupported",
                clarification_required=True,
                clarification_message=(
                    f"Operation '{final_op}' is not supported by the analysis engine. "
                    f"Supported group-by operations are: {sorted(list(SUPPORTED_GROUP_BY_OPERATIONS))}."
                ),
            )
    else:
        final_op = detected_op

    # 7. Type-compatibility validation: numeric operations require numeric columns
    if final_op in NUMERIC_OPERATIONS and not is_numeric_column(df[resolved_target_col]):
        return AnalysisPlan(
            dataset_id=dataset_id_clean,
            question=clean_question,
            operation=final_op,
            column=resolved_target_col,
            group_by=group_col,
            status="clarification_required",
            clarification_required=True,
            clarification_message=(
                f"Operation '{final_op}' requires a numeric column, but column '{resolved_target_col}' "
                f"is non-numeric ({df[resolved_target_col].dtype}). "
                f"Available numeric columns: {numeric_cols}."
            ),
            candidate_columns=numeric_cols,
        )

    # 8. Construct validated executable plan
    analysis_req = AnalysisRequest(
        dataset_id=dataset_id_clean,
        operation=final_op,
        column=resolved_target_col,
        group_by=group_col,
    )

    return AnalysisPlan(
        dataset_id=dataset_id_clean,
        question=clean_question,
        operation=final_op,
        column=resolved_target_col,
        group_by=group_col,
        status="ready",
        clarification_required=False,
        clarification_message=None,
        candidate_columns=[],
        analysis_request=analysis_req,
    )
