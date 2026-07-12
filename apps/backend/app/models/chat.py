from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.database import Base

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String, index=True, nullable=False)
    session_title = Column(String, nullable=False)
    sender = Column(String, nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ChatMessageFeedback(Base):
    __tablename__ = "chat_messages_feedback"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("chat_messages.id", ondelete="CASCADE"), unique=True, nullable=False)
    thumbs_up = Column(Boolean, default=False)
    thumbs_down = Column(Boolean, default=False)
    expert_correction = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

