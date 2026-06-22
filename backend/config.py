import os
from dotenv import load_dotenv

load_dotenv()

# Database
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_USER = os.getenv("DB_USER", "regulens_admin")
DB_PASSWORD = os.getenv("DB_PASSWORD", "regulens123")
DB_NAME = os.getenv("DB_NAME", "regulens")

# SQLAlchemy DSNs
DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
SYNC_DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6380"))
REDIS_QUEUE = os.getenv("REDIS_QUEUE", "ocr_queue")

# API
API_PORT = int(os.getenv("API_PORT", "8085"))

# File Storage
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "shared", "uploads"))
