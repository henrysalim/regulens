import os
import uuid
import json
import logging
from pathlib import Path
from fastapi import APIRouter, File, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
import redis as redis_client

from database import get_db
from models import Document
from schemas import DocumentOut
from config import UPLOAD_DIR, REDIS_HOST, REDIS_PORT, REDIS_QUEUE

logger = logging.getLogger(__name__)

router = APIRouter()

# Sync Redis client for pushing jobs (sync LPUSH is fine here)
_redis = redis_client.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

ALLOWED_EXTENSIONS = {".pdf", ".html", ".htm"}


@router.post("/api/upload", response_model=DocumentOut, status_code=202)
async def upload_document(
    document: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Accept a PDF or HTML file, save it to shared storage,
    create a PENDING document record, and push a job to Redis.
    """
    ext = Path(document.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Generate unique filename to avoid collisions
    doc_id = str(uuid.uuid4())
    safe_filename = f"{doc_id}{ext}"
    save_path = os.path.join(UPLOAD_DIR, safe_filename)

    # Ensure upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # Write file to disk
    try:
        content = await document.read()
        with open(save_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"Failed to save uploaded file: {e}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded file.")

    # Insert document record
    doc = Document(
        id=doc_id,
        filename=document.filename,
        file_path=f"/uploads/{safe_filename}",
        status="PENDING",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Push task to Redis queue
    task_payload = json.dumps({
        "document_id": doc_id,
        "file_path": save_path,
        "filename": document.filename,
    })
    try:
        _redis.lpush(REDIS_QUEUE, task_payload)
        logger.info(f"Queued document {doc_id} → {REDIS_QUEUE}")
    except Exception as e:
        logger.error(f"Redis push failed for {doc_id}: {e}")
        # Update document status to FAILED — queue push failed
        doc.status = "FAILED"
        await db.commit()

    return doc
