from fastapi import APIRouter

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("")
def get_monitoring():
    return {
        "power": 87,
        "water": 72,
        "food": 61,
        "temperature": 22.4,
        "humidity": 48,
        "radiation": 17
    }