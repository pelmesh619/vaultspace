from fastapi import APIRouter

router = APIRouter(prefix="/vault", tags=["Vault"])


@router.get("")
def get_vault():
    return {
        "name": "Vaultspace Alpha",
        "status": "operational",
        "occupants": 4,
        "security_level": 3
    }