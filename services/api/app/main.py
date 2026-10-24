import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from psycopg import Error as DatabaseError
from psycopg_pool import PoolTimeout

from app.db import check_database, close_pool, open_pool
from app.routers import inventory, monitoring, vault

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await open_pool()
    yield
    await close_pool()


app = FastAPI(
    title="Vaultspace API",
    description="Shelter Management & Monitoring System",
    version="0.2.0",
    lifespan=lifespan,
)

app.include_router(vault.router, prefix="/api/v1")
app.include_router(monitoring.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")


@app.exception_handler(DatabaseError)
@app.exception_handler(PoolTimeout)
async def database_error_handler(_: Request, error: Exception):
    logger.error("Database request failed: %s", error)
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is unavailable"},
    )


@app.get("/health")
async def health():
    database_ok = await check_database()
    return JSONResponse(
        status_code=200 if database_ok else 503,
        content={
            "status": "healthy" if database_ok else "unhealthy",
            "service": "vaultspace-api",
            "database": "ok" if database_ok else "unavailable",
        },
    )


@app.get("/")
def home():
    return {
        "status": "healthy",
        "service": "vaultspace-api",
        "docs": "/docs",
    }
