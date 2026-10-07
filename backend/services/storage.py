import re
import shutil
import uuid
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
UPLOAD_DIR = PROJECT_ROOT / "datasets" / "uploads"
DATASETS_DIR = PROJECT_ROOT / "datasets"

_UNSAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")
DATASET_ID_PATTERN = re.compile(r"^[A-Za-z0-9_\-]+$")


def generate_dataset_id() -> str:
    return str(uuid.uuid4())


def validate_dataset_id(dataset_id: str) -> str:
    """
    Ensure dataset_id is a non-empty alphanumeric/hyphen/underscore identifier
    with zero path traversal characters.
    """
    if not dataset_id or not isinstance(dataset_id, str):
        raise ValueError("A valid non-empty dataset_id must be provided.")
    clean = dataset_id.strip()
    if not clean or not DATASET_ID_PATTERN.match(clean) or ".." in clean:
        raise ValueError(
            f"Invalid dataset_id format: '{dataset_id}'. Must be alphanumeric, hyphen, or underscore only."
        )
    return clean


def sanitize_filename(filename: str) -> str:
    """Keep only the basename and strip characters that are unsafe on disk."""
    name = Path(filename).name
    stem = Path(name).stem
    stem = _UNSAFE_CHARS.sub("_", stem).strip("._") or "dataset"
    return f"{stem}.csv"


def save_uploaded_csv(
    dataset_id: str,
    original_filename: str,
    content: bytes,
) -> dict:
    """
    Persist an uploaded CSV under datasets/uploads/{dataset_id}/.
    Validates dataset_id to prevent path traversal.
    Returns local filesystem path plus API-safe identifiers.
    """
    clean_id = validate_dataset_id(dataset_id)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    stored_filename = sanitize_filename(original_filename)
    dataset_dir = (UPLOAD_DIR / clean_id).resolve()

    # Sandboxing guarantee: must resolve within UPLOAD_DIR
    if not dataset_dir.is_relative_to(UPLOAD_DIR.resolve()):
        raise ValueError("Security violation: Dataset storage path escapes uploads root.")

    dataset_dir.mkdir(parents=True, exist_ok=False)

    local_path = dataset_dir / stored_filename
    local_path.write_bytes(content)

    return {
        "local_path": local_path,
        "stored_filename": stored_filename,
        "storage_key": f"uploads/{clean_id}/{stored_filename}",
    }


def remove_uploaded_dataset(dataset_id: str) -> None:
    """Safely remove an uploaded dataset directory if processing or validation fails."""
    try:
        clean = validate_dataset_id(dataset_id)
        target_dir = (UPLOAD_DIR / clean).resolve()
        if target_dir.is_relative_to(UPLOAD_DIR.resolve()) and target_dir.is_dir():
            shutil.rmtree(target_dir, ignore_errors=True)
    except Exception:
        pass

