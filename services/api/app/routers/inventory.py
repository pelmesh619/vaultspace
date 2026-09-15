from fastapi import APIRouter

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("")
def get_inventory():
    return {
        "water": 340,
        "food": 128,
        "medicine": 24,
        "fuel": 76
    }