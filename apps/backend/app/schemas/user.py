from typing import Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime

# Shared properties
class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = True
    full_name: Optional[str] = None
    role: Optional[str] = "farmer"
    phone_number: Optional[str] = None
    state: Optional[str] = None

# Properties to receive on user creation
class UserCreate(UserBase):
    email: EmailStr
    password: str
    role: str = "farmer"

# Properties to receive on user update
class UserUpdate(UserBase):
    password: Optional[str] = None

# Properties to return to client
class UserResponse(UserBase):
    id: int
    email: EmailStr
    is_superuser: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# JSON Web Token properties
class Token(BaseModel):
    access_token: str
    token_type: str

# Payload stored inside JWT
class TokenPayload(BaseModel):
    sub: Optional[int] = None
