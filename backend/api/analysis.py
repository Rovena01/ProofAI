from fastapi import APIRouter, HTTPException

from models.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    CounterfactualRequest,
    CounterfactualResponse,
    VerificationRequest,
    VerificationResponse,
)
from services.analysis import (
    analyze_dataset,
    perform_counterfactual_analysis,
    verify_analysis_proof,
)

router = APIRouter()


@router.post("/analyze", response_model=AnalysisResponse)
def analyze(request: AnalysisRequest):
    """
    Perform deterministic analysis on a stored dataset and return
    machine-readable evidence and formal proof.
    """
    try:
        result = analyze_dataset(
            dataset_id=request.dataset_id,
            operation=request.operation,
            column=request.column,
            group_by=request.group_by,
        )
        return AnalysisResponse(**result)

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during analysis: {str(e)}",
        )


@router.post("/verify", response_model=VerificationResponse)
def verify_proof(request: VerificationRequest):
    """
    Verify the deterministic internal consistency of an analysis proof or response.
    Checks structural completeness, value matching, exclusion logic, and JSON safety.
    Does NOT recalculate arbitrary user code.
    """
    payload = request.response or request.proof
    if not payload:
        raise HTTPException(
            status_code=400,
            detail="Must provide either 'proof' or 'response' object in request body.",
        )

    try:
        verification_result = verify_analysis_proof(payload)
        return VerificationResponse(**verification_result)

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during proof verification: {str(e)}",
        )


@router.post("/analyze/counterfactual", response_model=CounterfactualResponse)
def analyze_counterfactual(request: CounterfactualRequest):
    """
    Perform deterministic counterfactual / what-if analysis on a stored dataset,
    recomputing analysis on a filtered copy, generating a verified counterfactual proof,
    and calculating the exact verified impact difference.
    """
    try:
        result = perform_counterfactual_analysis(
            dataset_id=request.dataset_id,
            operation=request.operation,
            column=request.column,
            group_by=request.group_by,
            exclude_column=request.exclude_column,
            exclude_value=request.exclude_value,
        )
        return CounterfactualResponse(**result)

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during counterfactual analysis: {str(e)}",
        )
