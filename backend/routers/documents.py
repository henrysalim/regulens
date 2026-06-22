import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import Document
from schemas import DocumentOut, DocumentListOut

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/api/documents", response_model=list[DocumentListOut])
async def list_documents(db: AsyncSession = Depends(get_db)):
    """Return all documents ordered by creation time (most recent first)."""
    result = await db.execute(
        select(Document).order_by(Document.created_at.desc())
    )
    return result.scalars().all()


@router.get("/api/documents/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    """Return a single document with all its evidence anchors."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.anchors))
        .where(Document.id == doc_id)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return doc
