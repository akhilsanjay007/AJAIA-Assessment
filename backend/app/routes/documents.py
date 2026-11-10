from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, DocumentShare, User
from app.schemas import (
    DocumentCreate,
    DocumentList,
    DocumentOut,
    DocumentUpdate,
    ShareRequest,
    ShareResult,
)

router = APIRouter(prefix="/documents", tags=["documents"])


def clean_title(title: str) -> str:
    cleaned = title.strip()
    return cleaned or "Untitled"


def to_document_out(document: Document, *, can_edit: bool) -> DocumentOut:
    return DocumentOut(
        id=document.id,
        title=document.title,
        content=document.content,
        owner_id=document.owner_id,
        can_edit=can_edit,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


def get_visible_document(document_id: int, user: User, db: Session) -> tuple[Document, bool]:
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    if document.owner_id == user.id:
        return document, True
    share = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == document.id,
            DocumentShare.shared_with_user_id == user.id,
        )
    )
    if share is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document, False


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    document = Document(
        title=clean_title(payload.title),
        content=payload.content,
        owner_id=user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return to_document_out(document, can_edit=True)


@router.get("", response_model=DocumentList)
def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentList:
    owned = list(
        db.scalars(
            select(Document)
            .where(Document.owner_id == user.id)
            .order_by(Document.updated_at.desc(), Document.id.desc())
        )
    )
    shared = list(
        db.scalars(
            select(Document)
            .join(DocumentShare, DocumentShare.document_id == Document.id)
            .where(DocumentShare.shared_with_user_id == user.id)
            .order_by(Document.updated_at.desc(), Document.id.desc())
        )
    )
    return DocumentList(
        owned=[to_document_out(document, can_edit=True) for document in owned],
        shared=[to_document_out(document, can_edit=False) for document in shared],
    )


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    document, can_edit = get_visible_document(document_id, user, db)
    return to_document_out(document, can_edit=can_edit)


@router.put("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: int,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    document, can_edit = get_visible_document(document_id, user, db)
    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can edit this document",
        )
    document.title = clean_title(payload.title)
    document.content = payload.content
    document.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    return to_document_out(document, can_edit=True)


@router.post("/{document_id}/share", response_model=ShareResult)
def share_document(
    document_id: int,
    payload: ShareRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareResult:
    document, can_edit = get_visible_document(document_id, user, db)
    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can share this document",
        )

    email = payload.email.strip().lower()
    recipient = db.scalar(select(User).where(User.email == email))
    if recipient is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No user with that email")
    if recipient.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot share a document with yourself",
        )

    existing = db.scalar(
        select(DocumentShare).where(
            DocumentShare.document_id == document.id,
            DocumentShare.shared_with_user_id == recipient.id,
        )
    )
    if existing is not None:
        return ShareResult(detail="Document already shared with this user")

    db.add(DocumentShare(document_id=document.id, shared_with_user_id=recipient.id))
    db.commit()
    return ShareResult(detail="Document shared")
