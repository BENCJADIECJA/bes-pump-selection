"""Populate PostgreSQL catalog tables from the Excel/JSON sources."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Dict, Iterable

import numpy as np
import pandas as pd
from psycopg import sql
from psycopg.rows import dict_row
from psycopg.types.json import Json

import equipment_selection
from db.utils import DatabaseConfigError, get_connection


def _json_default(value: Any) -> Any:
    if value is None:
        return None
    if value is pd.NA:
        return None
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (pd.Timestamp,)):
        return value.isoformat()
    if isinstance(value, bytes):
        return value.decode("utf-8")
    raise TypeError(f"Object of type {type(value)!r} is not JSON serializable")


def _normalize_records(records: Iterable[Dict[str, Any]]) -> list[Dict[str, Any]]:
    normalized: list[Dict[str, Any]] = []
    for entry in records:
        cleaned: Dict[str, Any] = {}
        for key, value in entry.items():
            if isinstance(value, float) and (np.isnan(value)):
                cleaned[key] = None
            else:
                cleaned[key] = value
        normalized.append(cleaned)
    return normalized


def _upsert_rows(
    cursor,
    table: str,
    db_id_column: str,
    payload_key: str,
    rows: Iterable[Dict[str, Any]]
) -> int:
    total = 0
    for payload in rows:
        identifier = payload.get(payload_key)
        if identifier in (None, ""):
            continue
        cursor.execute(
            sql.SQL(
                """
                INSERT INTO {table} ({id_column}, data)
                VALUES (%s, %s)
                ON CONFLICT ({id_column})
                DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
                """
            ).format(
                table=sql.Identifier(table),
                id_column=sql.Identifier(db_id_column),
            ),
            (str(identifier), Json(payload, dumps=lambda obj: json.dumps(obj, default=_json_default))),
        )
        total += 1
    return total


def _upsert_metadata(cursor, key: str, data: Dict[str, Any]) -> None:
    cursor.execute(
        """
        INSERT INTO catalog_metadata (key, data)
        VALUES (%s, %s)
        ON CONFLICT (key)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
        """,
        (key, Json(data, dumps=lambda obj: json.dumps(obj, default=_json_default))),
    )


def load_data_into_postgres(excel_path: str | None) -> None:
    equipment_selection.load_catalogs(force=True, source="excel", excel_path=excel_path)
    equipment_selection.load_cable_catalog(force=True, source="file")

    pump_df = equipment_selection.PUMP_CATALOG.copy()
    motor_df = equipment_selection.MOTOR_CATALOG.copy()
    pump_df = pump_df.replace({np.nan: None})
    motor_df = motor_df.replace({np.nan: None})

    mapping = equipment_selection.get_column_mapping()
    pump_id_key = mapping.get("pump_id_col") or equipment_selection.COL_PUMP_ID

    motor_map = mapping.get("motor_column_map") or equipment_selection.MOTOR_COLUMN_MAP
    if isinstance(motor_map, dict):
        motor_id_key = motor_map.get("descripcion") or mapping.get("motor_id_col") or equipment_selection.COL_MOTOR_ID
    else:
        motor_id_key = mapping.get("motor_id_col") or equipment_selection.COL_MOTOR_ID
    cable_id_key = "id"

    pump_records = _normalize_records(pump_df.to_dict(orient="records"))
    motor_records = _normalize_records(motor_df.to_dict(orient="records"))
    cable_records = equipment_selection.CABLE_CATALOG or []
    metadata = {
        "column_mapping": mapping,
        "motor_column_map": equipment_selection.MOTOR_COLUMN_MAP,
        "source": "excel",
        "excel_path": equipment_selection.get_catalog_excel_path(),
    }

    try:
        connection = get_connection()
    except DatabaseConfigError as exc:
        raise SystemExit(f"[ERROR] {exc}")

    inserted = {"pump_catalog": 0, "motor_catalog": 0, "cable_catalog": 0}
    with connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            inserted["pump_catalog"] = _upsert_rows(cursor, "pump_catalog", "pump_id", pump_id_key, pump_records)
            inserted["motor_catalog"] = _upsert_rows(cursor, "motor_catalog", "motor_id", motor_id_key, motor_records)

            cable_rows = []
            for entry in cable_records:
                if not isinstance(entry, dict):
                    continue
                cable_id = entry.get("id")
                if cable_id in (None, ""):
                    continue
                cable_rows.append(entry)
            inserted["cable_catalog"] = _upsert_rows(cursor, "cable_catalog", "cable_id", cable_id_key, cable_rows)

            _upsert_metadata(cursor, "catalog_context", metadata)

    print("Carga completada:")
    for table, count in inserted.items():
        print(f"  - {table}: {count} filas actualizadas")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Load BES catalogs into PostgreSQL")
    parser.add_argument(
        "--excel-path",
        dest="excel_path",
        default=None,
        help="Ruta alternativa al archivo de catálogos (por defecto usa coeficientes NOVOMET.xlsx)",
    )
    args = parser.parse_args(argv)

    try:
        load_data_into_postgres(args.excel_path)
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(f"[ERROR] No se pudieron cargar los catálogos: {exc}")


if __name__ == "__main__":
    main(sys.argv[1:])
