from fastapi import FastAPI

from app.routers import vault, monitoring, inventory

app = FastAPI(
    title="Vaultspace API",
    description="Shelter Management & Monitoring System",
    version="0.1.0",
)

app.include_router(vault.router, prefix="/api/v1")
app.include_router(monitoring.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "vaultspace-api"
    }

@app.get("/")
def home():
    return {
        "status": "healthy",
        "service": "vaultspace-api",
        "error": "This endpoint is for frontend!"
    }
