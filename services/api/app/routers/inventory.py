from fastapi import APIRouter
from psycopg.rows import dict_row

from app.db import ConnectionDep
from app.schemas import InventoryResponse

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("", response_model=InventoryResponse)
async def get_inventory(connection: ConnectionDep):
    async with connection.cursor(row_factory=dict_row) as cursor:
        await cursor.execute(
            """
            SELECT code, quantity
            FROM inventory_items
            """
        )
        rows = await cursor.fetchall()

    quantities = {row["code"]: row["quantity"] for row in rows}

    return InventoryResponse(**quantities)
