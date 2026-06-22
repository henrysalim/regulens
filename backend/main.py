"""
main.py — ReguLens FastAPI Backend

Starts the FastAPI application, registers all routers, sets up CORS,
serves static uploads, and launches the OCR/AI background worker thread
during the application lifespan.
"""
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from config import UPLOAD_DIR
from database import create_tables
from routers import upload, documents
from worker.consumer import start_worker, stop_worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Application Lifespan ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup:
      1. Create upload directory if missing.
      2. Auto-create database tables.
      3. Launch OCR/AI worker background thread.
    Shutdown:
      4. Signal worker thread to stop gracefully.
    """
    # 1. Ensure shared upload directory exists
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    logger.info(f"Upload directory ready: {UPLOAD_DIR}")

    # 2. Auto-create database tables
    await create_tables()
    logger.info("Database tables verified/created.")

    # 3. Start background worker thread
    worker_thread = start_worker()
    logger.info(f"Worker thread '{worker_thread.name}' started (daemon={worker_thread.daemon}).")

    yield  # application is running

    # 4. Graceful worker shutdown
    stop_worker()
    logger.info("Worker thread signalled to stop.")


# ── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="ReguLens API",
    description=(
        "Autonomous AI backend for digital trade regulatory discovery and evidence mapping "
        "under the UNESCAP RDTII framework (Pillars 5–9)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# Static file serving — uploaded documents accessible at /uploads/<filename>
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Routers
app.include_router(upload.router, tags=["Upload"])
app.include_router(documents.router, tags=["Documents"])


@app.get("/", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "ReguLens API", "version": "1.0.0"}
