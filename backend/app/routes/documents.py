import html
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Document, DocumentPresence, DocumentShare, DocumentVersion, User
from app.schemas import (
    DocumentCreate,
    DocumentList,
    DocumentOut,
    DocumentUpdate,
    DocumentVersionOut,
    PresenceUser,
    ShareGrant,
    ShareRequest,
    ShareResult,
)

router = APIRouter(prefix="/documents", tags=["documents"])


def clean_title(title: str) -> str:
    cleaned = title.strip()
    return cleaned or "Untitled"


def text_to_html(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized:
        return "<p></p>"
    blocks: list[str] = []
    for part in normalized.split("\n\n"):
        lines = [line.strip() for line in part.split("\n") if line.strip()]
        if not lines:
            continue
        blocks.append("<p>" + "<br>".join(html.escape(line) for line in lines) + "</p>")
    return "".join(blocks) or "<p></p>"


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


def record_version(document: Document, user: User, db: Session) -> None:
    db.add(
        DocumentVersion(
            document_id=document.id,
            title=document.title,
            content=document.content,
            saved_by_user_id=user.id,
        )
    )
    db.flush()
    versions = list(
        db.scalars(
            select(DocumentVersion)
            .where(DocumentVersion.document_id == document.id)
            .order_by(DocumentVersion.created_at.desc(), DocumentVersion.id.desc())
        )
    )
    for stale in versions[10:]:
        db.delete(stale)


def save_document(document: Document, title: str, content: str, user: User, db: Session) -> Document:
    document.title = clean_title(title)
    document.content = content
    document.updated_at = datetime.now(timezone.utc)
    record_version(document, user, db)
    db.commit()
    db.refresh(document)
    return document


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
    return document, share.permission == "edit"


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


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    filename = file.filename or ""
    extension = Path(filename).suffix.lower()
    if extension not in {".txt", ".md"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .txt and .md files can be uploaded",
        )
    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be UTF-8 text",
        ) from exc
    document = Document(
        title=clean_title(Path(filename).stem),
        content=text_to_html(text),
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
    shared_rows = db.execute(
        select(Document, DocumentShare.permission)
        .join(DocumentShare, DocumentShare.document_id == Document.id)
        .where(DocumentShare.shared_with_user_id == user.id)
        .order_by(Document.updated_at.desc(), Document.id.desc())
    ).all()
    return DocumentList(
        owned=[to_document_out(document, can_edit=True) for document in owned],
        shared=[
            to_document_out(document, can_edit=permission == "edit")
            for document, permission in shared_rows
        ],
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
            detail="You do not have edit access",
        )
    save_document(document, payload.title, payload.content, user, db)
    return to_document_out(document, can_edit=True)


@router.get("/{document_id}/versions", response_model=list[DocumentVersionOut])
def list_versions(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[DocumentVersionOut]:
    document, _can_edit = get_visible_document(document_id, user, db)
    rows = db.execute(
        select(DocumentVersion, User)
        .join(User, User.id == DocumentVersion.saved_by_user_id)
        .where(DocumentVersion.document_id == document.id)
        .order_by(DocumentVersion.created_at.desc(), DocumentVersion.id.desc())
        .limit(10)
    ).all()
    return [
        DocumentVersionOut(
            id=version.id,
            title=version.title,
            content=version.content,
            saved_by_user_id=author.id,
            saved_by_name=author.name,
            created_at=version.created_at,
        )
        for version, author in rows
    ]


@router.post("/{document_id}/versions/{version_id}/restore", response_model=DocumentOut)
def restore_version(
    document_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentOut:
    document, can_edit = get_visible_document(document_id, user, db)
    if not can_edit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have edit access",
        )
    version = db.get(DocumentVersion, version_id)
    if version is None or version.document_id != document.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    save_document(document, version.title, version.content, user, db)
    return to_document_out(document, can_edit=True)


@router.post("/{document_id}/share", response_model=ShareResult)
def share_document(
    document_id: int,
    payload: ShareRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareResult:
    document, _can_edit = get_visible_document(document_id, user, db)
    if document.owner_id != user.id:
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
        existing.permission = payload.permission
        db.commit()
        return ShareResult(detail=f"Permission updated to {payload.permission}")

    db.add(
        DocumentShare(
            document_id=document.id,
            shared_with_user_id=recipient.id,
            permission=payload.permission,
        )
    )
    db.commit()
    return ShareResult(detail="Document shared")


@router.get("/{document_id}/shares", response_model=list[ShareGrant])
def list_shares(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ShareGrant]:
    document, _can_edit = get_visible_document(document_id, user, db)
    if document.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can view shares",
        )
    rows = db.execute(
        select(DocumentShare, User)
        .join(User, User.id == DocumentShare.shared_with_user_id)
        .where(DocumentShare.document_id == document.id)
        .order_by(User.email)
    ).all()
    return [
        ShareGrant(email=recipient.email, name=recipient.name, permission=share.permission)
        for share, recipient in rows
    ]


PRESENCE_SECONDS = 20


def _presence_row(document_id: int, user_id: int, db: Session) -> DocumentPresence | None:
    return db.scalar(
        select(DocumentPresence).where(
            DocumentPresence.document_id == document_id,
            DocumentPresence.user_id == user_id,
        )
    )


@router.post("/{document_id}/presence", status_code=status.HTTP_204_NO_CONTENT)
def touch_presence(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    document, _can_edit = get_visible_document(document_id, user, db)
    now = datetime.now(timezone.utc)
    row = _presence_row(document.id, user.id, db)
    if row is None:
        db.add(DocumentPresence(document_id=document.id, user_id=user.id, last_seen=now))
    else:
        row.last_seen = now
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{document_id}/presence", status_code=status.HTTP_204_NO_CONTENT)
def leave_presence(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Response:
    document, _can_edit = get_visible_document(document_id, user, db)
    row = _presence_row(document.id, user.id, db)
    if row is not None:
        db.delete(row)
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{document_id}/presence", response_model=list[PresenceUser])
def list_presence(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PresenceUser]:
    document, _can_edit = get_visible_document(document_id, user, db)
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=PRESENCE_SECONDS)
    people = db.scalars(
        select(User)
        .join(DocumentPresence, DocumentPresence.user_id == User.id)
        .where(
            DocumentPresence.document_id == document.id,
            DocumentPresence.last_seen >= cutoff,
        )
        .order_by(User.name)
    ).all()
    return [PresenceUser(id=person.id, name=person.name, email=person.email) for person in people]
