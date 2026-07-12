import uuid
from typing import Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.api import deps
from app.db.database import get_db
from app.models.user import User
from app.models.chat import ChatMessage, ChatMessageFeedback
from app.services.advisor import generate_advisor_response

router = APIRouter()

# Schema definitions
class MessageIn(BaseModel):
    content: str
    session_id: Optional[str] = None
    farmer_context: Optional[dict] = None

class FeedbackIn(BaseModel):
    thumbs_up: Optional[bool] = False
    thumbs_down: Optional[bool] = False
    expert_correction: Optional[str] = None

class MessageResponse(BaseModel):
    id: int
    session_id: str
    session_title: str
    sender: str
    content: str
    
    class Config:
        from_attributes = True

class SessionResponse(BaseModel):
    session_id: str
    session_title: str

@router.get("/sessions", response_model=List[SessionResponse])
def get_chat_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Get all unique chat session IDs and titles for the current user.
    """
    # Fetch distinct session_id and session_title tuples, ordered by creation date
    results = (
        db.query(ChatMessage.session_id, ChatMessage.session_title)
        .filter(ChatMessage.user_id == current_user.id)
        .group_by(ChatMessage.session_id, ChatMessage.session_title)
        .all()
    )
    return [{"session_id": r[0], "session_title": r[1]} for r in results]

@router.get("/sessions/{session_id}", response_model=List[MessageResponse])
def get_session_messages(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Get all messages within a specific session.
    """
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return messages

@router.post("/chat", response_model=MessageResponse)
def post_chat_message(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    message_in: MessageIn
) -> Any:
    """
    Post a new user message, generate the AI response, save both, and return the AI message.
    """
    session_id = message_in.session_id
    is_new_session = False
    
    if not session_id:
        session_id = str(uuid.uuid4())
        is_new_session = True
        
    # Generate a default title from the first message
    session_title = message_in.content[:40] + "..." if len(message_in.content) > 40 else message_in.content
    
    # If not a new session, fetch the existing title
    if not is_new_session:
        existing_msg = (
            db.query(ChatMessage)
            .filter(ChatMessage.user_id == current_user.id, ChatMessage.session_id == session_id)
            .first()
        )
        if existing_msg:
            session_title = existing_msg.session_title
            
    # 1. Save user's message
    user_msg = ChatMessage(
        user_id=current_user.id,
        session_id=session_id,
        session_title=session_title,
        sender="user",
        content=message_in.content
    )
    db.add(user_msg)
    db.commit()

    # 2. Fetch history for context
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == current_user.id, ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    history_list = [{"sender": msg.sender, "content": msg.content} for msg in history]

    # 3. Generate advisor answer
    ai_response_text = generate_advisor_response(
        message_in.content,
        history_list,
        farmer_context=message_in.farmer_context,
        profile_state=current_user.state,
        profile_name=current_user.full_name
    )

    # 4. Save AI's response
    ai_msg = ChatMessage(
        user_id=current_user.id,
        session_id=session_id,
        session_title=session_title,
        sender="assistant",
        content=ai_response_text
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    return ai_msg

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_chat_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Deletes the entire conversation thread history.
    """
    db.query(ChatMessage).filter(
        ChatMessage.user_id == current_user.id, 
        ChatMessage.session_id == session_id
    ).delete()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.post("/feedback/{message_id}", status_code=status.HTTP_200_OK)
def post_message_feedback(
    message_id: int,
    feedback: FeedbackIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    """
    Saves user or expert feedback for a specific chat message.
    """
    # 1. Verify message exists
    msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat message not found."
        )
        
    # 2. Check if feedback record already exists
    existing_fb = db.query(ChatMessageFeedback).filter(ChatMessageFeedback.message_id == message_id).first()
    if existing_fb:
        existing_fb.thumbs_up = feedback.thumbs_up
        existing_fb.thumbs_down = feedback.thumbs_down
        if feedback.expert_correction is not None:
            existing_fb.expert_correction = feedback.expert_correction
        db.commit()
        db.refresh(existing_fb)
        return {"status": "Feedback updated", "feedback_id": existing_fb.id}
    else:
        new_fb = ChatMessageFeedback(
            message_id=message_id,
            thumbs_up=feedback.thumbs_up,
            thumbs_down=feedback.thumbs_down,
            expert_correction=feedback.expert_correction
        )
        db.add(new_fb)
        db.commit()
        db.refresh(new_fb)
        return {"status": "Feedback logged", "feedback_id": new_fb.id}

