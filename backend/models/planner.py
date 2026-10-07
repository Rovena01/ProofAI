from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

from models.analysis import AnalysisRequest


class PlanRequest(BaseModel):
    """Schema for incoming natural language planning requests."""
    dataset_id: str = Field(..., description="Unique dataset identifier or standard dataset name")
    question: str = Field(..., description="Natural language question to plan")

    @field_validator("dataset_id")
    @classmethod
    def validate_dataset_id(cls, v: str) -> str:
        if not v or not isinstance(v, str) or not v.strip():
            raise ValueError("dataset_id must be a non-empty string.")
        return v.strip()

    @field_validator("question")
    @classmethod
    def validate_question(cls, v: str) -> str:
        if not v or not isinstance(v, str) or not v.strip():
            raise ValueError("question must be a non-empty string.")
        return v.strip()


class AnalysisPlan(BaseModel):
    """
    Schema for validated natural-language analysis plan.
    Represents an interpretation blueprint without executing calculations.
    """
    dataset_id: str = Field(..., description="Target dataset identifier")
    question: str = Field(..., description="Original natural language question")
    operation: Optional[str] = Field(None, description="Deterministic operation to perform if resolved")
    column: Optional[str] = Field(None, description="Resolved target column")
    group_by: Optional[str] = Field(None, description="Resolved grouping column if applicable")
    status: str = Field(
        "ready",
        description="Plan status ('ready', 'clarification_required', 'unsupported', 'error')",
    )
    clarification_required: bool = Field(
        False,
        description="True if question is ambiguous, unsupported, or missing parameters",
    )
    clarification_message: Optional[str] = Field(
        None,
        description="Human-readable explanation of ambiguity or required clarification",
    )
    candidate_columns: List[str] = Field(
        default_factory=list,
        description="Candidate columns available when clarification is required",
    )
    analysis_request: Optional[AnalysisRequest] = Field(
        None,
        description="Executable AnalysisRequest specification, populated only when status is 'ready'",
    )

    def to_analysis_request(self) -> AnalysisRequest:
        """Convert validated plan into an executable AnalysisRequest for the analysis engine."""
        if self.clarification_required or not self.analysis_request:
            raise ValueError(
                f"Cannot convert plan to AnalysisRequest: {self.clarification_message or 'Plan is not ready.'}"
            )
        return self.analysis_request
