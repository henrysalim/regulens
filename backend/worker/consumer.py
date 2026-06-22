"""
consumer.py — Redis background worker thread.

Runs inside the FastAPI process as a daemon thread, launched during
the application's lifespan startup event.

Flow:
  1. brpop blocks on ocr_queue
  2. Parse job payload {document_id, file_path, filename}
  3. Update document status → PROCESSING
  4. Extract text via ocr.py
  5. Run Proposer + Verifier agents via mapper.py
  6. Save EvidenceAnchors + update status → COMPLETED / FAILED
"""
import json
import time
import logging
import datetime
import threading

import redis
import psycopg2
from psycopg2.extras import RealDictCursor

from config import REDIS_HOST, REDIS_PORT, REDIS_QUEUE, SYNC_DATABASE_URL
from worker.ocr import extract_text
from worker.mapper import proposer_agent, verifier_agent

logger = logging.getLogger(__name__)

# Thread-level stop signal
_stop_event = threading.Event()


# ── Database helpers ──────────────────────────────────────────────────────────

def _get_conn():
    return psycopg2.connect(SYNC_DATABASE_URL)


def _update_status(conn, doc_id: str, status: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE documents SET status = %s, updated_at = %s WHERE id = %s",
            (status, datetime.datetime.utcnow(), doc_id),
        )
    conn.commit()


def _save_anchor(
    conn,
    doc_id: str,
    indicator: str,
    verbatim: str,
    page: int,
    bbox: str,
    confidence: float,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO evidence_anchors
                (document_id, sub_indicator, verbatim_text, page, bounding_box, confidence, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (doc_id, indicator, verbatim, page, bbox, confidence, datetime.datetime.utcnow()),
        )
    conn.commit()


# ── Core processing ───────────────────────────────────────────────────────────

def _process_document(conn, doc_id: str, file_path: str, filename: str) -> bool:
    """Extract text, run agents, persist anchors. Returns True on success."""
    pages = extract_text(file_path, filename)
    if not pages:
        logger.warning(f"No text extracted from {filename} ({doc_id})")
        return False

    anchors_found = 0
    mock_bbox = '{"top": 0, "left": 0, "width": 0, "height": 0}'

    for page_data in pages:
        text: str = page_data["text"]
        page_num: int = page_data["page_number"]

        # Split text into paragraphs for fine-grained anchoring
        paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 20]
        if not paragraphs:
            paragraphs = [ln.strip() for ln in text.splitlines() if len(ln.strip()) > 30]

        for paragraph in paragraphs:
            matched_indicators = proposer_agent(paragraph)
            for indicator in matched_indicators:
                verified, confidence = verifier_agent(paragraph, indicator)
                if verified:
                    _save_anchor(conn, doc_id, indicator, paragraph, page_num, mock_bbox, confidence)
                    anchors_found += 1

    logger.info(f"Document {doc_id}: {anchors_found} evidence anchor(s) saved.")
    return True


# ── Background thread ─────────────────────────────────────────────────────────

def _worker_loop() -> None:
    """
    Infinite loop that blocks on Redis brpop and processes documents.
    Runs as a daemon thread inside the FastAPI process.
    """
    logger.info("OCR/AI worker thread started. Listening on queue: %s", REDIS_QUEUE)

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)
    conn = None

    while not _stop_event.is_set():
        # Ensure DB connection is alive
        try:
            if conn is None or conn.closed:
                conn = _get_conn()
        except Exception as e:
            logger.error(f"DB connection failed: {e}. Retrying in 5s...")
            time.sleep(5)
            continue

        try:
            # brpop with a timeout so we can check _stop_event periodically
            result = r.brpop(REDIS_QUEUE, timeout=3)
            if result is None:
                continue  # timeout — loop and check stop event

            _, raw_payload = result
            payload = json.loads(raw_payload.decode("utf-8"))
            doc_id = payload["document_id"]
            file_path = payload["file_path"]
            filename = payload["filename"]

            logger.info(f"Processing: {filename} (ID={doc_id})")
            _update_status(conn, doc_id, "PROCESSING")

            success = _process_document(conn, doc_id, file_path, filename)
            _update_status(conn, doc_id, "COMPLETED" if success else "FAILED")

        except json.JSONDecodeError as e:
            logger.error(f"Malformed Redis payload: {e}")
        except Exception as e:
            logger.error(f"Worker loop error: {e}", exc_info=True)
            time.sleep(2)

    if conn and not conn.closed:
        conn.close()
    logger.info("OCR/AI worker thread stopped.")


def start_worker() -> threading.Thread:
    """
    Launch the worker as a background daemon thread.
    Called from FastAPI's lifespan startup.
    """
    _stop_event.clear()
    thread = threading.Thread(target=_worker_loop, name="ocr-worker", daemon=True)
    thread.start()
    return thread


def stop_worker() -> None:
    """Signal the worker thread to stop gracefully."""
    _stop_event.set()
