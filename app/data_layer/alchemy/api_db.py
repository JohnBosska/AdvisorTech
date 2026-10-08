from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import alchemy

engine = create_async_engine(
    str(alchemy.dsn),
    pool_size=alchemy.pool_size,
    max_overflow=alchemy.max_overflow,
    pool_timeout=alchemy.pool_timeout,
    pool_recycle=alchemy.pool_recycle,
    pool_pre_ping=alchemy.pool_pre_ping,
)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)
