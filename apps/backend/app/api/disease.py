from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.scan import ScanLog
from app.services.disease import classify_leaf_image
from app.services.activity_logger import log_activity

router = APIRouter()

class ScanFeedbackIn(BaseModel):
    user_feedback_correct: Optional[bool] = None
    expert_correction_id: Optional[str] = None

@router.post("/detect", status_code=status.HTTP_200_OK)
async def detect_leaf_disease(
    *,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Accepts leaf image uploads, invokes SOTA classification & Grad-CAM mapping,
    logs metadata into PostgreSQL database for future training feeds, and returns report JSON.
    """
    # 1. Enforce file constraints
    allowed_types = ["image/jpeg", "image/png", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a JPEG or PNG image.",
        )
        
    try:
        # Read the file contents as binary bytes
        file_bytes = await file.read()
        
        # Enforce size constraint (5MB max)
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds the 5MB limit.",
            )

        # 2. Invoke the PyTorch classification & Grad-CAM engine
        prediction_results = classify_leaf_image(file_bytes)
        
        # 3. Log details to ScanLog
        db_log = ScanLog(
            user_id=current_user.id,
            image_path=file.filename,
            predicted_disease_id=prediction_results.get("disease_id", "inconclusive"),
            confidence=prediction_results.get("confidence", 0.0),
            user_feedback_correct=None
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        
        # Include logged database entry ID to payload
        prediction_results["scan_log_id"] = db_log.id

        # Auto-log to farm activity diary
        try:
            disease_name = prediction_results.get("disease", "Unknown")
            confidence = prediction_results.get("confidence", 0.0)
            log_activity(
                db,
                user_id=current_user.id,
                activity_type="Disease Scan",
                title=f"Disease Scan: {disease_name}",
                description=f"Leaf image scanned. Prediction: {disease_name} at {confidence:.1%} confidence.",
                source="auto",
                metadata={"scan_log_id": db_log.id, "disease": disease_name, "confidence": round(confidence, 4)},
            )
        except Exception:
            pass  # Never let activity logging break the scan response

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

@router.post("/feedback/{scan_log_id}", status_code=status.HTTP_200_OK)
def post_scan_feedback(
    scan_log_id: int,
    feedback: ScanFeedbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Submits user validation or expert audit overrides to update ScanLog history records.
    """
    log_entry = db.query(ScanLog).filter(ScanLog.id == scan_log_id).first()
    if not log_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scan record not found."
        )
        
    # Check authorization (Farmers can update their own scans; Admins/Experts can update anything)
    if log_entry.user_id != current_user.id and current_user.role not in ["admin", "expert"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to log feedback on this scan profile."
        )
        
    if feedback.user_feedback_correct is not None:
        log_entry.user_feedback_correct = feedback.user_feedback_correct
    if feedback.expert_correction_id is not None:
        log_entry.expert_correction_id = feedback.expert_correction_id
        
    db.commit()
    db.refresh(log_entry)
    return {"status": "Scan feedback logged successfully", "scan_log_id": log_entry.id}
