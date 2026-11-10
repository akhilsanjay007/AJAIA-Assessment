from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, User
from app.schemas import DocumentCreate, DocumentOut, DocumentUpdate

router = APIRouter(prefix="/documents", tags=["documents"])


def clean_title(title: str) -> str:
    cleaned = title.strip()
    return cleaned or "Untitled"


def get_owned_document(document_id: int, user: User, db: Session) -> Document:
    document = db.scalar(
        select(Document).where(Document.id == document_id, Document.owner_id == user.id)
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    document = Document(
        title=clean_title(payload.title),
        content=payload.content,
        owner_id=user.id,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


@router.get("", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Document]:
    return list(
        db.scalars(
            select(Document)
            .where(Document.owner_id == user.id)
            .order_by(Document.updated_at.desc(), Document.id.desc())
        )
    )


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    return get_owned_document(document_id, user, db)


@router.put("/{document_id}", response_model=DocumentOut)
def update_document(
    document_id: int,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Document:
    document = get_owned_document(document_id, user, db)
    document.title = clean_title(payload.title)
    document.content = payload.content
    document.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(document)
    return document
