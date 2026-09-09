from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.scan import ScanLog
from app.services.vision.pipeline import analyze_crop_image
from app.services.activity_logger import log_activity

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
    current_user: User = Depends(deps.get_current_active_user),
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

    # 1. Enforce MIME file constraints
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if upload.content_type and upload.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "INVALID_IMAGE", "message": "Invalid file format. Please upload a JPEG, PNG, or WebP image."}
        )

    try:
        file_bytes = await upload.read()

        # Enforce size constraint (5MB max)
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "IMAGE_TOO_LARGE", "message": "File size exceeds the 5MB limit."}
            )

        # 2. Invoke multi-stage pipeline
        result = analyze_crop_image(file_bytes)

        # 3. Log to ScanLog database table
        disease_id = result.get("disease") or "unresolved"
        confidence = result.get("disease_confidence") or result.get("crop_confidence") or 0.0

        db_log = ScanLog(
            user_id=current_user.id,
            image_path=upload.filename,
            predicted_disease_id=disease_id,
            confidence=float(confidence),
            user_feedback_correct=None
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)

        result["scan_log_id"] = db_log.id

        # 4. Auto-log to farm activity diary
        try:
            status_label = result.get("status", "scanned")
            crop_label = result.get("crop") or "Vegetation"
            disease_name = result.get("disease_name") or result.get("disease") or "Uncertain"
            log_activity(
                db,
                user_id=current_user.id,
                activity_type="Vision Scan",
                title=f"Crop Scan: {crop_label.title()} ({status_label})",
                description=f"Analysis result: {result.get('message')}",
                source="auto",
                metadata={"scan_log_id": db_log.id, "status": status_label, "confidence": round(confidence, 4)},
            )
        except Exception:
            pass  # Never let diary logging interrupt scan response

        return result

    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "INVALID_IMAGE", "message": str(ve)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "MODEL_UNAVAILABLE", "message": f"An error occurred during model inference: {str(e)}"}
        )


@router.post("/detect", status_code=status.HTTP_200_OK)
async def detect_leaf_disease(
    *,
    db: Session = Depends(get_db),
    file: UploadFile = File(...),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    """
    Backward-compatible disease detection endpoint.
    Runs the multi-stage vision pipeline and formats response for legacy UI components.
    """
    res = await analyze_crop(db=db, file=file, current_user=current_user)
    # Adapt to legacy schema expectations
    res["name"] = res.get("disease_name") or (f"{res.get('crop', '').title()} Foliage" if res.get("crop") else "Unresolved")
    res["disease_id"] = res.get("disease") or "inconclusive"
    res["confidence"] = res.get("disease_confidence") or res.get("crop_confidence") or 0.0
    res["type"] = "Normal Health" if res.get("status") == "healthy" else ("Pathogen" if res.get("status") == "diagnosed" else "Unresolved")
    res["severity"] = "None" if res.get("status") == "healthy" else ("Medium" if res.get("status") == "diagnosed" else "None")
    return res


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
