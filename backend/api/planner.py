from fastapi import APIRouter, HTTPException

from models.planner import AnalysisPlan, PlanRequest
from services.planner import plan_question

router = APIRouter()


@router.post("/plan", response_model=AnalysisPlan)
def plan(request: PlanRequest):
    """
    Interpret a natural language question into a strictly validated AnalysisPlan.
    Does NOT execute analysis, calculate results, or generate proofs.
    """
    try:
        return plan_question(
            dataset_id=request.dataset_id,
            question=request.question,
        )

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
            detail=f"An unexpected error occurred during planning: {str(e)}",
        )
