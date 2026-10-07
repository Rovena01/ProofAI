import pandas as pd
from fastapi import APIRouter, UploadFile, File, HTTPException

from services.data_quality import assess_data_quality
from services.profiler import profile_dataframe
from services.storage import (
    generate_dataset_id,
    save_uploaded_csv,
    remove_uploaded_dataset,
)


router = APIRouter()

MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
CHUNK_SIZE_BYTES = 1024 * 1024          # 1 MB


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided."
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are currently supported."
        )

    # Stream read with size enforcement (max 50MB) to prevent memory exhaustion
    total_size = 0
    chunks = []
    while True:
        chunk = await file.read(CHUNK_SIZE_BYTES)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="File exceeds maximum allowed upload size of 50MB."
            )
        chunks.append(chunk)

    content = b"".join(chunks)

    # Empty file check
    if len(content) == 0:
        raise HTTPException(
            status_code=400,
            detail="Uploaded CSV file is empty (0 bytes)."
        )

    dataset_id = generate_dataset_id()

    try:
        stored = save_uploaded_csv(
            dataset_id=dataset_id,
            original_filename=file.filename,
            content=content,
        )

        # Support UTF-8 with automatic fallback to Latin-1
        try:
            df = pd.read_csv(stored["local_path"], encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(stored["local_path"], encoding="latin-1")

        if df.empty and len(df.columns) == 0:
            remove_uploaded_dataset(dataset_id)
            raise HTTPException(
                status_code=400,
                detail="CSV file contains no readable columns or rows."
            )

        profile = profile_dataframe(df)
        data_quality = assess_data_quality(df, profile)

        return {
            "dataset_id": dataset_id,
            "filename": file.filename,
            "stored_filename": stored["stored_filename"],
            "storage_key": stored["storage_key"],
            "profile": profile,
            "data_quality": data_quality,
        }

    except HTTPException:
        remove_uploaded_dataset(dataset_id)
        raise
    except pd.errors.EmptyDataError:
        remove_uploaded_dataset(dataset_id)
        raise HTTPException(
            status_code=400,
            detail="CSV file contains no readable columns or rows."
        )
    except pd.errors.ParserError as e:
        remove_uploaded_dataset(dataset_id)
        raise HTTPException(
            status_code=400,
            detail=f"Malformed CSV: Failed to parse rows and columns: {str(e)}"
        )
    except Exception as e:
        remove_uploaded_dataset(dataset_id)
        raise HTTPException(
            status_code=400,
            detail=f"Could not process dataset: {str(e)}"
        )
