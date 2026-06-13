"""
SQLAlchemy async session factory using SQLite + aiosqlite.
No external database server required.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import event

from app.core.config import settings

# Create async SQLite engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    connect_args={
        "check_same_thread": False,  # Required for SQLite async
        "timeout": 30,
    },
)

# Session factory
AsyncSessionFactory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_all_tables() -> None:
    """Create all tables on startup (replaces Alembic for SQLite dev)."""
    from app.db.base import Base  # noqa: F401 — triggers model registration
    # Import all models to register them
    import app.models.user  # noqa: F401
    import app.models.conversation  # noqa: F401
    import app.models.message  # noqa: F401
    import app.models.uploaded_file  # noqa: F401
    import app.models.memory  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_engine() -> None:
    """Dispose engine on shutdown."""
    await engine.dispose()
