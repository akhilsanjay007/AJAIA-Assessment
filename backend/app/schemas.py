from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class DocumentCreate(BaseModel):
    title: str = "Untitled"
    content: str = "<p></p>"


class DocumentUpdate(BaseModel):
    title: str
    content: str


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    content: str
    owner_id: int
    can_edit: bool
    created_at: datetime
    updated_at: datetime


class DocumentList(BaseModel):
    owned: list[DocumentOut]
    shared: list[DocumentOut]


class ShareRequest(BaseModel):
    email: str


class ShareResult(BaseModel):
    detail: str
