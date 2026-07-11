from typing import Any
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from sqlalchemy.orm import Session

from app.api import deps
from app.models.user import User
from app.services.disease import classify_leaf_image

router = APIRouter()

@router.post("/detect", status_code=status.HTTP_200_OK)
async def detect_leaf_disease(
    *,
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Accepts multipart/form-data leaf image upload, processes it using PyTorch, 
    and returns localized pathogen recommendations.
    """
    # 1. Enforce file constraints (e.g. extension and size limit)
    allowed_types = ["image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a JPEG or PNG image.",
        )
        
    try:
        # Read the file contents as binary bytes
        file_bytes = await file.read()
        
        # Enforce size constraint (e.g. 5MB max)
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds the 5MB limit.",
            )

        # 2. Invoke the PyTorch classification engine
        prediction_results = classify_leaf_image(file_bytes)
        return prediction_results

    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during model inference: {str(e)}"
        )
