import math

import numpy as np
import pandas as pd


def detect_column_type(series: pd.Series) -> str:
    """
    Detect a useful semantic type for a dataframe column.
    """

    if pd.api.types.is_numeric_dtype(series):
        return "numeric"

    if pd.api.types.is_datetime64_any_dtype(series):
        return "date"

    # Try detecting date-like string columns
    if series.dtype == "object" or str(series.dtype) in {"string", "str"}:
        sample = series.dropna().astype(str)

        if len(sample) > 0:
            parsed = pd.to_datetime(
                sample,
                errors="coerce",
                format="mixed",
            )

            if parsed.notna().mean() >= 0.8:
                return "date"

    if series.nunique(dropna=True) <= 20:
        return "categorical"

    return "text"


def _json_number(value):
    """Convert a numeric value to JSON-safe float, or None if undefined."""
    try:
        if value is None or pd.isna(value):
            return None
        number = float(value)
        if math.isnan(number) or math.isinf(number):
            return None
        return number
    except (TypeError, ValueError):
        return None


def _numeric_quality(series: pd.Series) -> dict:
    """Inspect numeric values without changing the original series."""
    values = series.to_numpy()
    nan_count = int(series.isna().sum())

    infinite_count = 0
    if np.issubdtype(values.dtype, np.floating):
        infinite_count = int(np.isinf(values).sum())

    finite = series[np.isfinite(pd.to_numeric(series, errors="coerce"))]
    has_negative = bool((finite < 0).any()) if len(finite) else False
    mean_value = _json_number(finite.mean()) if len(finite) else None

    statistics = {
        "min": _json_number(finite.min() if len(finite) else None),
        "max": _json_number(finite.max() if len(finite) else None),
        "mean": round(mean_value, 2) if mean_value is not None else None,
        "nan_count": nan_count,
        "infinite_count": infinite_count,
        "has_negative": has_negative,
    }
    return statistics


def _date_quality(series: pd.Series) -> dict:
    """
    Parse a copy of date-like values for reporting only.
    Original values are never rewritten.
    """
    non_null = series.dropna()
    non_null_count = int(len(non_null))

    if pd.api.types.is_datetime64_any_dtype(series):
        parseable = non_null_count
        unparseable = 0
    else:
        parsed = pd.to_datetime(
            non_null.astype(str),
            errors="coerce",
            format="mixed",
        )
        parseable = int(parsed.notna().sum())
        unparseable = int(parsed.isna().sum())

    success_pct = (
        round((parseable / non_null_count) * 100, 2)
        if non_null_count
        else 100.0
    )

    return {
        "parseable_values": parseable,
        "unparseable_values": unparseable,
        "parse_success_percentage": success_pct,
        "has_inconsistent_values": unparseable > 0,
    }


def profile_dataframe(df: pd.DataFrame) -> dict:
    """
    Create a detailed structural and quality profile
    of a dataset. Inspection only: values are not cleaned.
    """

    columns = []

    for column in df.columns:
        series = df[column]
        semantic_type = detect_column_type(series)
        unique_values = int(series.nunique(dropna=True))
        missing_values = int(series.isna().sum())
        row_count = int(len(series))
        missing_percentage = (
            round(float(missing_values / row_count * 100), 2)
            if row_count
            else 0.0
        )

        column_info = {
            "name": column,
            "dtype": str(series.dtype),
            "semantic_type": semantic_type,
            "missing_values": missing_values,
            "missing_percentage": missing_percentage,
            "unique_values": unique_values,
            "is_constant": unique_values == 1,
            "is_empty": row_count > 0 and missing_values == row_count,
        }

        if semantic_type == "numeric" or pd.api.types.is_numeric_dtype(series):
            try:
                column_info["statistics"] = _numeric_quality(series)
            except Exception:
                column_info["statistics"] = {
                    "min": None,
                    "max": None,
                    "mean": None,
                    "nan_count": missing_values,
                    "infinite_count": 0,
                    "has_negative": False,
                }

        if semantic_type == "date":
            try:
                column_info["date_quality"] = _date_quality(series)
            except Exception:
                column_info["date_quality"] = {
                    "parseable_values": 0,
                    "unparseable_values": 0,
                    "parse_success_percentage": 0.0,
                    "has_inconsistent_values": False,
                }

        columns.append(column_info)

    row_count = int(len(df))
    duplicate_rows = int(df.duplicated().sum()) if row_count else 0
    duplicate_percentage = (
        round(float(duplicate_rows / row_count * 100), 2)
        if row_count
        else 0.0
    )

    return {
        "rows": row_count,
        "columns": int(len(df.columns)),
        "duplicate_rows": duplicate_rows,
        "duplicate_percentage": duplicate_percentage,
        "column_details": columns
    }
