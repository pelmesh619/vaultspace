import logging
import os
from typing import Annotated, AsyncIterator

from fastapi import Depends, HTTPException
from psycopg import AsyncConnection
from psycopg.conninfo import make_conninfo
from psycopg_pool import AsyncConnectionPool

logger = logging.getLogger(__name__)

_pool: AsyncConnectionPool | None = None


def build_conninfo() -> str:
    """Build a libpq connection string from the PG* environment variables."""
    password = os.getenv("PGPASSWORD")
    if not password:
        raise RuntimeError("PGPASSWORD is not set")

    return make_conninfo(
        host=os.getenv("PGHOST", "postgres"),
        port=os.getenv("PGPORT", "5432"),
        dbname=os.getenv("PGDATABASE", "vaultspace"),
        user=os.getenv("PGUSER", "vaultspace"),
        password=password,
        connect_timeout=5,
    )


async def open_pool() -> None:
    global _pool

    _pool = AsyncConnectionPool(
        conninfo=build_conninfo(),
        min_size=1,
        max_size=5,
        open=False,
    )
    await _pool.open(wait=True, timeout=30)
    logger.info("PostgreSQL connection pool is ready")


async def close_pool() -> None:
    global _pool

    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")


async def check_database() -> bool:
    """Return True when PostgreSQL accepts a simple query."""
    if _pool is None:
        return False

    try:
        async with _pool.connection(timeout=2) as connection:
            await connection.execute("SELECT 1")
    except Exception:
        logger.exception("Database health check failed")
        return False

    return True


async def get_connection() -> AsyncIterator[AsyncConnection]:
    if _pool is None:
        raise HTTPException(status_code=503, detail="Database is not ready")

    async with _pool.connection(timeout=5) as connection:
        yield connection


ConnectionDep = Annotated[AsyncConnection, Depends(get_connection)]
