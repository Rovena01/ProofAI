"""
Deterministic data-quality assessment.

This module only inspects a dataframe/profile. It never modifies values.

overall_status rules:
- "fail" if critical_issues > 0 or quality_score < 50
- "review" if the dataset has 0 rows, warning_count > 0, or quality_score < 80
- "pass" otherwise

These replace earlier status labels with pass / review / fail.
All existing response fields remain intact for backward compatibility.

Severity rules:
- empty_column: critical (every value is missing)
- missing_values: critical if missing_percentage >= 50, else warning
- duplicate_rows: critical if duplicate_percentage >= 50, else warning
- invalid_dates: critical if parse_success_percentage < 50, else warning
- infinite_values: warning (breaks numeric analysis, but not deleted)
- negative_values: info only (not an error; often legitimate)
- constant_column: info (often legitimate)

Quality score starts at 100 and is reduced using deterministic penalties,
clamped to 0–100. Values never use NaN or Infinity.
"""

import math
import numpy as np
import pandas as pd

MISSING_CRITICAL_PCT = 50.0
DUPLICATE_CRITICAL_PCT = 50.0
DATE_PARSE_CRITICAL_PCT = 50.0

MISSING_PENALTY_WEIGHT = 0.8
MISSING_PENALTY_CAP = 40.0
DUPLICATE_PENALTY_WEIGHT = 0.5
DUPLICATE_PENALTY_CAP = 25.0
EMPTY_COLUMN_PENALTY = 15.0
EMPTY_COLUMN_PENALTY_CAP = 30.0
INF_COLUMN_PENALTY = 10.0
INF_COLUMN_PENALTY_CAP = 20.0
INVALID_DATE_PENALTY = 10.0
INVALID_DATE_PENALTY_CAP = 20.0
EMPTY_DATASET_SCORE_CAP = 40


def _is_na(value):
    """Deterministic check for missing values including pandas/numpy sentinels."""
    if value is None or value is pd.NA or value is pd.NaT:
        return True
    if isinstance(value, (list, tuple, dict, set)):
        return False
    try:
        return bool(pd.isna(value))
    except (ValueError, TypeError):
        return False


def _json_number(value, digits=None):
    """Return a JSON-safe Python float/int-compatible number, or None."""
    try:
        if _is_na(value):
            return None
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return None
        if digits is not None:
            number = round(number, digits)
        return number
    except (TypeError, ValueError):
        return None


def _jsonify(value):
    """Coerce numpy/pandas scalars into JSON-safe Python values."""
    if _is_na(value):
        return None
    if isinstance(value, (str, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _jsonify(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonify(item) for item in value]
    if isinstance(value, (int, np.integer)) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, (float, np.floating)):
        return _json_number(value)
    try:
        if hasattr(value, "item"):
            return _jsonify(value.item())
    except (ValueError, AttributeError):
        pass
    return value


def _pct(part, whole, digits=2):
    if not whole:
        return 0.0
    value = _json_number((part / whole) * 100, digits=digits)
    return 0.0 if value is None else value


def _warning(warning_type, column, severity, message, **extra):
    payload = {
        "type": warning_type,
        "column": column,
        "severity": severity,
        "message": message,
    }
    for key, item in extra.items():
        if isinstance(item, float):
            payload[key] = _json_number(item, digits=2)
        else:
            payload[key] = item
    return payload


def _duplicate_non_null_count(series) -> int:
    """Extra copies among non-null values (inspection only)."""
    try:
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        non_null_count = int(series.notna().sum())
        unique_count = int(series.nunique(dropna=True))
        extras = non_null_count - unique_count
        return extras if extras > 0 else 0
    except Exception:
        return 0


def _inspect_date_quality(name: str, series: pd.Series, column_profile: dict) -> dict:
    """Ensure date quality metrics are computed even if profiler semantic_type wasn't 'date'."""
    date_quality = column_profile.get("date_quality") or {}
    if date_quality and (
        date_quality.get("parseable_values", 0) + date_quality.get("unparseable_values", 0) > 0
    ):
        return date_quality

    if series is None or pd.api.types.is_numeric_dtype(series) or pd.api.types.is_bool_dtype(series):
        return date_quality

    try:
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        non_null = series.dropna().astype(str)
        non_null_count = len(non_null)
        if non_null_count == 0:
            return date_quality

        name_lower = str(name).lower()
        is_date_named = any(k in name_lower for k in ("date", "time", "timestamp", "dob", "day"))

        parsed = pd.to_datetime(non_null, errors="coerce", format="mixed")
        parseable = int(parsed.notna().sum())
        unparseable = int(parsed.isna().sum())

        if parseable > 0 and (is_date_named or (parseable / non_null_count) >= 0.2):
            success_pct = round((parseable / non_null_count) * 100, 2)
            return {
                "parseable_values": parseable,
                "unparseable_values": unparseable,
                "parse_success_percentage": success_pct,
                "has_inconsistent_values": unparseable > 0,
            }
    except Exception:
        pass

    return date_quality


def _inspect_numeric_quality(name: str, series: pd.Series, column_profile: dict) -> dict:
    """Ensure infinite and negative checks are present even if not pre-populated in statistics."""
    statistics = dict(column_profile.get("statistics") or {})
    if series is None:
        return statistics

    try:
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]

        if not statistics.get("infinite_count"):
            num = pd.to_numeric(series, errors="coerce")
            inf_count = int(np.isinf(num).sum())
            if inf_count > 0:
                statistics["infinite_count"] = inf_count

        if "has_negative" not in statistics:
            num = pd.to_numeric(series, errors="coerce")
            finite = num[np.isfinite(num)]
            statistics["has_negative"] = bool((finite < 0).any()) if len(finite) else False
    except Exception:
        pass

    return statistics


def _build_column_quality(df, column_profile: dict) -> dict:
    name = column_profile["name"]
    series = None
    if df is not None and name in df.columns:
        series = df[name]
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]

    date_quality = _inspect_date_quality(name, series, column_profile)
    statistics = _inspect_numeric_quality(name, series, column_profile)

    missing_values = int(column_profile.get("missing_values") or 0)
    missing_percentage = _json_number(
        column_profile.get("missing_percentage"), digits=2
    ) or 0.0
    infinite_count = int(statistics.get("infinite_count") or 0)
    invalid_dates = int(date_quality.get("unparseable_values") or 0)
    is_empty = bool(column_profile.get("is_empty"))
    duplicate_values = _duplicate_non_null_count(series) if series is not None else 0

    issue_types = []
    if is_empty:
        issue_types.append("empty_column")
    elif missing_values > 0:
        issue_types.append("missing_values")
    if invalid_dates > 0:
        issue_types.append("invalid_dates")
    if infinite_count > 0:
        issue_types.append("non_finite_values")

    return {
        "name": str(name),
        "column_name": str(name),
        "semantic_type": column_profile.get("semantic_type"),
        "missing_values": missing_values,
        "missing_percentage": missing_percentage,
        "duplicate_values": duplicate_values,
        "invalid_dates": invalid_dates,
        "non_finite_values": infinite_count,
        "infinite_values": infinite_count,
        "is_empty": is_empty,
        "is_constant": bool(column_profile.get("is_constant")),
        "issue_types": issue_types,
    }


def _quality_score(
    *,
    row_count: int,
    missing_percentage: float,
    duplicate_percentage: float,
    empty_column_count: int,
    inf_column_count: int,
    invalid_date_column_count: int,
) -> int:
    score = 100.0
    score -= min(MISSING_PENALTY_CAP, missing_percentage * MISSING_PENALTY_WEIGHT)
    score -= min(
        DUPLICATE_PENALTY_CAP,
        duplicate_percentage * DUPLICATE_PENALTY_WEIGHT,
    )
    score -= min(
        EMPTY_COLUMN_PENALTY_CAP,
        empty_column_count * EMPTY_COLUMN_PENALTY,
    )
    score -= min(INF_COLUMN_PENALTY_CAP, inf_column_count * INF_COLUMN_PENALTY)
    score -= min(
        INVALID_DATE_PENALTY_CAP,
        invalid_date_column_count * INVALID_DATE_PENALTY,
    )
    if row_count == 0:
        score = min(score, EMPTY_DATASET_SCORE_CAP)

    safe = _json_number(score)
    if safe is None:
        return 0
    return int(max(0, min(100, round(safe))))


def assess_data_quality(df, profile: dict = None) -> dict:
    """Build a structured quality report from an existing structural profile."""
    if profile is None and df is not None:
        from services.profiler import profile_dataframe
        profile = profile_dataframe(df)
    elif profile is None:
        profile = {}

    warnings = []
    row_count = int(profile.get("rows", len(df) if df is not None else 0))
    column_count = int(
        profile.get(
            "columns",
            len(df.columns) if df is not None else len(profile.get("column_details", []))
        )
    )
    duplicate_rows = int(profile.get("duplicate_rows", 0))
    duplicate_percentage = _json_number(
        profile.get("duplicate_percentage"), digits=2
    ) or 0.0

    if duplicate_rows > 0:
        severity = (
            "critical"
            if duplicate_percentage >= DUPLICATE_CRITICAL_PCT
            else "warning"
        )
        warnings.append(
            _warning(
                "duplicate_rows",
                None,
                severity,
                (
                    f"Dataset contains {duplicate_rows} duplicate row(s) "
                    f"({duplicate_percentage}%)."
                ),
                count=duplicate_rows,
                percentage=duplicate_percentage,
            )
        )

    for column in profile.get("column_details", []):
        name = column["name"]
        series = None
        if df is not None and name in df.columns:
            series = df[name]
            if isinstance(series, pd.DataFrame):
                series = series.iloc[:, 0]

        missing_values = int(column.get("missing_values") or 0)
        missing_percentage = _json_number(
            column.get("missing_percentage"), digits=2
        ) or 0.0
        is_empty = bool(column.get("is_empty") or (row_count > 0 and missing_values == row_count))

        if is_empty:
            warnings.append(
                _warning(
                    "empty_column",
                    name,
                    "critical",
                    f"Column '{name}' is empty: every value is missing.",
                    count=missing_values,
                    percentage=missing_percentage,
                )
            )
        elif missing_values > 0:
            severity = (
                "critical"
                if missing_percentage >= MISSING_CRITICAL_PCT
                else "warning"
            )
            warnings.append(
                _warning(
                    "missing_values",
                    name,
                    severity,
                    (
                        f"Column '{name}' contains {missing_values} missing "
                        f"value(s) ({missing_percentage}%)."
                    ),
                    count=missing_values,
                    percentage=missing_percentage,
                )
            )

        if column.get("is_constant") and not is_empty and row_count > 0:
            warnings.append(
                _warning(
                    "constant_column",
                    name,
                    "info",
                    (
                        f"Column '{name}' is constant: it has only one unique "
                        "non-null value."
                    ),
                    unique_values=column.get("unique_values"),
                )
            )

        statistics = _inspect_numeric_quality(name, series, column)
        infinite_count = int(statistics.get("infinite_count") or 0)
        if infinite_count > 0:
            warnings.append(
                _warning(
                    "infinite_values",
                    name,
                    "warning",
                    (
                        f"Column '{name}' contains {infinite_count} infinite "
                        "value(s)."
                    ),
                    count=infinite_count,
                )
            )

        if statistics.get("has_negative"):
            warnings.append(
                _warning(
                    "negative_values",
                    name,
                    "info",
                    (
                        f"Column '{name}' contains negative values. This may "
                        "be legitimate depending on the dataset."
                    ),
                    min=_json_number(statistics.get("min"), digits=2),
                )
            )

        date_quality = _inspect_date_quality(name, series, column)
        unparseable = int(date_quality.get("unparseable_values") or 0)
        if unparseable > 0:
            success_pct = _json_number(
                date_quality.get("parse_success_percentage"), digits=2
            ) or 0.0
            severity = (
                "critical"
                if success_pct < DATE_PARSE_CRITICAL_PCT
                else "warning"
            )
            warnings.append(
                _warning(
                    "invalid_dates",
                    name,
                    severity,
                    (
                        f"Column '{name}' has {unparseable} value(s) that "
                        "cannot be parsed as dates "
                        f"({success_pct}% parse success)."
                    ),
                    unparseable_values=unparseable,
                    parseable_values=date_quality.get("parseable_values"),
                    parse_success_percentage=success_pct,
                )
            )

    issues = [
        item for item in warnings if item["severity"] in {"warning", "critical"}
    ]

    column_quality = [
        _build_column_quality(df, column)
        for column in profile.get("column_details", [])
    ]

    total_cells = row_count * column_count
    missing_values_total = int(
        sum(int(col.get("missing_values") or 0) for col in column_quality)
    )
    missing_percentage = _pct(missing_values_total, total_cells)

    empty_column_count = sum(1 for col in column_quality if col["is_empty"])
    inf_column_count = sum(
        1 for col in column_quality if col["non_finite_values"] > 0
    )
    invalid_date_column_count = sum(
        1 for col in column_quality if col["invalid_dates"] > 0
    )

    quality_score = _quality_score(
        row_count=row_count,
        missing_percentage=missing_percentage,
        duplicate_percentage=duplicate_percentage,
        empty_column_count=empty_column_count,
        inf_column_count=inf_column_count,
        invalid_date_column_count=invalid_date_column_count,
    )

    critical_issues = sum(1 for item in warnings if item["severity"] == "critical")
    warning_count = sum(1 for item in warnings if item["severity"] == "warning")
    info_count = sum(1 for item in warnings if item["severity"] == "info")

    if critical_issues > 0:
        overall_status = "fail"
    elif row_count == 0:
        overall_status = "review"
    elif quality_score < 50:
        overall_status = "fail"
    elif warning_count > 0 or quality_score < 80:
        overall_status = "review"
    else:
        overall_status = "pass"

    quality_summary = {
        "total_warnings": len(warnings),
        "critical_issues": critical_issues,
        "warning_count": warning_count,
        "info_count": info_count,
        "total_issues": len(issues),
        "issues_count": len(issues),
        "overall_status": overall_status,
        "quality_score": quality_score,
        "row_count": row_count,
        "column_count": column_count,
        "rows": row_count,
        "columns": column_count,
        "duplicate_rows": duplicate_rows,
        "duplicate_percentage": duplicate_percentage,
        "missing_values": missing_values_total,
        "missing_percentage": missing_percentage,
    }

    return _jsonify({
        "overall_status": overall_status,
        "quality_score": quality_score,
        "row_count": row_count,
        "column_count": column_count,
        "rows": row_count,
        "duplicate_rows": duplicate_rows,
        "duplicate_percentage": duplicate_percentage,
        "missing_values": missing_values_total,
        "missing_percentage": missing_percentage,
        "quality_summary": quality_summary,
        "warnings": warnings,
        "issues": issues,
        "columns": column_quality,
        "column_quality": column_quality,
        "column_details": column_quality,
    })
