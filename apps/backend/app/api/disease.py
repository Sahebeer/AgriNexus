import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, File, Form, UploadFile, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.scan import ScanLog
from app.services.vision.pipeline import analyze_crop_image
from app.services.activity_logger import log_activity

logger = logging.getLogger(__name__)

router = APIRouter()


class ScanFeedbackIn(BaseModel):
    user_feedback_correct: Optional[bool] = None
    expert_correction_id: Optional[str] = None


@router.post("/analyze", status_code=status.HTTP_200_OK)
async def analyze_crop(
    *,
    db: Session = Depends(get_db),
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    crop_hint: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(deps.get_current_active_user_optional if hasattr(deps, 'get_current_active_user_optional') else deps.get_current_active_user),
) -> Any:
    """
    Unified Multi-Stage Agricultural Computer Vision Pipeline.
    Evaluates:
      1. Image Quality & Integrity
      2. Crop / Plant Relevance Gate (Rejects OOD objects, cars, humans, electronics)
      3. Crop Species Classification
      4. Disease Classification & Calibrated Thresholding
    """
    upload = image or file
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "INVALID_IMAGE", "message": "No image file provided in upload."}
        )

    try:
        file_bytes = await upload.read()
        if not file_bytes or len(file_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "INVALID_IMAGE", "message": "Uploaded image file is empty."}
            )

        # Enforce size constraint (10MB max)
        if len(file_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "IMAGE_TOO_LARGE", "message": "File size exceeds the 10MB limit."}
            )

        # 2. Invoke multi-stage pipeline
        result = analyze_crop_image(file_bytes, crop_hint=crop_hint)

        # Normalize fields for legacy & modern consumers
        status_label = result.get("status", "diagnosed")
        is_non_crop = status_label == "crop_not_detected"
        disease_id = result.get("disease")
        confidence = result.get("disease_confidence") or result.get("crop_confidence") or 0.0
        crop_label = result.get("crop") or "Vegetation"
        disease_name = result.get("disease_name")

        # A rejected image must never be normalized into a misleading
        # "healthy" diagnosis for legacy clients or scan history.
        result["name"] = disease_name if not is_non_crop else None
        result["disease_id"] = disease_id if not is_non_crop else None
        result["confidence"] = confidence if not is_non_crop else 0.0

        # 3. Log to ScanLog database table if user is authenticated
        if current_user and not is_non_crop:
            try:
                db_log = ScanLog(
                    user_id=current_user.id,
                    image_path=upload.filename or "leaf_scan.jpg",
                    predicted_disease_id=disease_id,
                    confidence=float(confidence),
                    user_feedback_correct=None
                )
                db.add(db_log)
                db.commit()
                db.refresh(db_log)
                result["scan_log_id"] = db_log.id

                # Auto-log to farm activity diary
                log_activity(
                    db,
                    user_id=current_user.id,
                    activity_type="Vision Scan",
                    title=f"Crop Scan: {crop_label.title()} ({status_label})",
                    description=f"Analysis result: {result.get('message')}",
                    source="auto",
                    metadata={"scan_log_id": db_log.id, "status": status_label, "confidence": round(confidence, 4)},
                )
            except Exception as e:
                logger.warning(f"ScanLog/ActivityLog auto-logging deferred: {e}")

        return result

    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "INVALID_IMAGE", "message": str(ve)}
        )
    except Exception as e:
        logger.error(f"Error during vision pipeline execution: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "MODEL_UNAVAILABLE", "message": f"An error occurred during model inference: {str(e)}"}
        )


@router.post("/predict", status_code=status.HTTP_200_OK)
async def predict_leaf_disease(
    *,
    db: Session = Depends(get_db),
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    crop_hint: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(deps.get_current_active_user_optional if hasattr(deps, 'get_current_active_user_optional') else deps.get_current_active_user),
) -> Any:
    """
    Direct predict endpoint used by UI components.
    """
    return await analyze_crop(db=db, file=file, image=image, crop_hint=crop_hint, current_user=current_user)


@router.post("/detect", status_code=status.HTTP_200_OK)
async def detect_leaf_disease(
    *,
    db: Session = Depends(get_db),
    file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    crop_hint: Optional[str] = Form(None),
    current_user: Optional[User] = Depends(deps.get_current_active_user_optional if hasattr(deps, 'get_current_active_user_optional') else deps.get_current_active_user),
) -> Any:
    """
    Backward-compatible disease detection endpoint.
    """
    return await analyze_crop(db=db, file=file, image=image, crop_hint=crop_hint, current_user=current_user)


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
