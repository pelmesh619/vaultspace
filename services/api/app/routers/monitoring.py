from fastapi import APIRouter, HTTPException
from psycopg.rows import dict_row

from app.db import ConnectionDep
from app.schemas import MonitoringResponse

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.get("", response_model=MonitoringResponse)
async def get_monitoring(connection: ConnectionDep):
    async with connection.cursor(row_factory=dict_row) as cursor:
        await cursor.execute(
            """
            SELECT power, water, food, temperature, humidity, radiation
            FROM monitoring_readings
            ORDER BY recorded_at DESC, id DESC
            LIMIT 1
            """
        )
        row = await cursor.fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Monitoring data not found")

    return MonitoringResponse(**row)
