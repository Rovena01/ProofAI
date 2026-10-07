from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator

SUPPORTED_SCALAR_OPERATIONS = {
    "sum",
    "average",
    "count",
    "min",
    "max",
    "median",
}

SUPPORTED_GROUP_BY_OPERATIONS = {
    "group_by_sum",
    "group_by_average",
    "group_by_count",
}

ALL_SUPPORTED_OPERATIONS = SUPPORTED_SCALAR_OPERATIONS | SUPPORTED_GROUP_BY_OPERATIONS

NUMERIC_OPERATIONS = {
    "sum",
    "average",
    "min",
    "max",
    "median",
    "group_by_sum",
    "group_by_average",
}


class AnalysisRequest(BaseModel):
    """Schema for explicit deterministic analysis requests."""
    dataset_id: str = Field(..., description="Unique dataset identifier or standard dataset name")
    operation: str = Field(..., description="Deterministic operation to perform")
    column: str = Field(..., description="Target column name")
    group_by: Optional[str] = Field(None, description="Grouping column for group-by operations")

    @field_validator("operation")
    @classmethod
    def validate_operation(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("Operation must be a non-empty string.")
        op = v.strip().lower()
        if op == "mean":
            op = "average"
        if op not in ALL_SUPPORTED_OPERATIONS:
            sorted_ops = sorted(list(ALL_SUPPORTED_OPERATIONS))
            raise ValueError(
                f"Unsupported operation '{v}'. Supported operations are: {sorted_ops}"
            )
        return op


class ProofVerification(BaseModel):
    """Schema for deterministic internal consistency verification metadata."""
    verification_status: str = Field("passed", description="Status of internal consistency verification ('passed' or 'failed')")
    verification_method: str = Field("deterministic_internal_consistency", description="Method used to verify consistency")
    verified_result: Any = Field(..., description="Result value verified against internal constraints")
    checks: List[str] = Field(default_factory=list, description="List of deterministic checks executed")


class AnalysisProof(BaseModel):
    """Schema for machine-readable formal proof accompanying analysis results."""
    proof_version: str = Field("1.0.0", description="Version of the proof schema")
    dataset_id: str = Field(..., description="Dataset identifier")
    operation: str = Field(..., description="Deterministic operation performed")
    target_column: str = Field(..., description="Target column name")
    group_by_column: Optional[str] = Field(None, description="Grouping column name if applicable")
    source_columns: List[str] = Field(..., description="All source column names in the dataset")
    dataset_rows: int = Field(..., description="Total row count in source dataset")
    rows_considered: int = Field(..., description="Total row count evaluated")
    valid_rows_count: int = Field(..., description="Count of valid non-null rows included in mathematical computation")
    missing_values_excluded: int = Field(..., description="Count of null/NaN values excluded")
    non_finite_values_excluded: int = Field(..., description="Count of Inf/-Inf values excluded")
    rows_excluded: int = Field(..., description="Total count of rows excluded from computation")
    exclusion_reasons: List[str] = Field(default_factory=list, description="Deterministic reasons for any row exclusions")
    calculation: str = Field(..., description="Short calculation trace string")
    formula: str = Field(..., description="Explicit mathematical formula trace")
    result: Any = Field(..., description="Calculated result value or group structure")
    data_quality_status: str = Field(..., description="Status from data quality report ('pass', 'review', or 'fail')")
    data_quality_score: int = Field(..., description="Quality score (0-100) from data quality report")
    data_quality_warnings_count: int = Field(0, description="Count of total data quality warnings")
    data_quality_critical_issues_count: int = Field(0, description="Count of critical data quality issues")
    group_details: Optional[List[Dict[str, Any]]] = Field(None, description="Per-group calculation trace for group-by operations")
    verification: ProofVerification = Field(..., description="Deterministic internal consistency verification block")
    counterfactual_context: Optional[Dict[str, Any]] = Field(None, description="Optional metadata for counterfactual what-if exclusion")


class AnalysisResponse(BaseModel):
    """Schema for deterministic analysis response containing result, proof, and evidence."""
    dataset_id: str
    operation: str
    column: str
    group_by: Optional[str] = None
    result: Any
    evidence: Dict[str, Any]
    proof: AnalysisProof
    groups: Optional[Dict[str, Any]] = None


class CounterfactualRequest(BaseModel):
    """Schema for deterministic counterfactual / what-if analysis requests."""
    dataset_id: str = Field(..., description="Unique dataset identifier")
    operation: str = Field(..., description="Deterministic operation to perform")
    column: str = Field(..., description="Target column name")
    group_by: Optional[str] = Field(None, description="Grouping column for group-by operations")
    exclude_column: str = Field(..., description="Categorical column from which to exclude value")
    exclude_value: str = Field(..., description="Categorical value to exclude")

    @field_validator("operation")
    @classmethod
    def validate_operation(cls, v: str) -> str:
        if not v or not isinstance(v, str):
            raise ValueError("Operation must be a non-empty string.")
        op = v.strip().lower()
        if op == "mean":
            op = "average"
        if op not in ALL_SUPPORTED_OPERATIONS:
            sorted_ops = sorted(list(ALL_SUPPORTED_OPERATIONS))
            raise ValueError(
                f"Unsupported operation '{v}'. Supported operations are: {sorted_ops}"
            )
        return op


class CounterfactualResponse(BaseModel):
    """Schema for counterfactual what-if analysis response comparing baseline vs counterfactual."""
    dataset_id: str
    condition: Dict[str, Any]
    original_rows: int
    counterfactual_rows: int
    rows_excluded_by_condition: int
    original_result: Any
    counterfactual_result: Any
    difference: Any
    percentage_change: Optional[float] = None
    original_proof: AnalysisProof
    counterfactual_proof: AnalysisProof
    original_groups: Optional[Dict[str, Any]] = None
    counterfactual_groups: Optional[Dict[str, Any]] = None
    group_differences: Optional[List[Dict[str, Any]]] = None


class VerificationRequest(BaseModel):
    """Schema for proof verification request."""
    proof: Optional[Dict[str, Any]] = Field(None, description="Formal proof object to verify")
    response: Optional[Dict[str, Any]] = Field(None, description="Complete analysis response containing a proof object")


class VerificationResponse(BaseModel):
    """Schema for proof verification response."""
    verified: bool = Field(..., description="True if proof passes all internal consistency checks")
    verification_status: str = Field(..., description="'passed' or 'failed'")
    verification_method: str = Field("deterministic_internal_consistency", description="Verification method applied")
    dataset_id: Optional[str] = None
    operation: Optional[str] = None
    target_column: Optional[str] = None
    verified_result: Optional[Any] = None
    checks_performed: List[str] = Field(default_factory=list, description="Deterministic checks executed")
    message: str = Field(..., description="Explanatory summary of verification outcome")
