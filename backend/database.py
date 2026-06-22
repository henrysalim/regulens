from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import DATABASE_URL, SYNC_DATABASE_URL

# Async engine — used by FastAPI route handlers
async_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Sync engine — used by the background worker thread (brpop is blocking/sync)
sync_engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency: yields an async DB session per request."""
    async with AsyncSessionLocal() as session:
        yield session


def get_sync_db():
    """Worker utility: returns a sync DB session (caller must close)."""
    return SyncSessionLocal()


async def create_tables():
    """Called at startup to auto-create tables if they don't exist."""
    async with async_engine.begin() as conn:
        from models import Base as ModelBase  # avoid circular import
        await conn.run_sync(ModelBase.metadata.create_all)
