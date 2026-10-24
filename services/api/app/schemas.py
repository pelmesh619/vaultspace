from pydantic import BaseModel


class VaultResponse(BaseModel):
    name: str
    status: str
    occupants: int
    security_level: int


class MonitoringResponse(BaseModel):
    power: int
    water: int
    food: int
    temperature: float
    humidity: int
    radiation: int


class InventoryResponse(BaseModel):
    water: int
    food: int
    medicine: int
    fuel: int
