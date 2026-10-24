from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row

from app.db import ConnectionDep
from app.schemas import VaultResponse

router = APIRouter(prefix="/vault", tags=["Vault"])


@router.get("", response_model=VaultResponse)
async def get_vault(connection: ConnectionDep):
    async with connection.cursor(row_factory=dict_row) as cursor:
        await cursor.execute(
            """
            SELECT name, status, occupants, security_level
            FROM vault
            WHERE id = 1
            """
        )
        row = await cursor.fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Vault record not found")

    return VaultResponse(**row)
