from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import psycopg
from psycopg.rows import dict_row


class DatabaseConfigError(RuntimeError):
    """Raised when the PostgreSQL configuration is incomplete."""


@dataclass
class ConnectionSettings:
    conninfo: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    user: Optional[str] = None
    password: Optional[str] = None
    dbname: Optional[str] = None

    @classmethod
    def from_environment(cls) -> "ConnectionSettings":
        conninfo = os.getenv("DATABASE_URL")
        if conninfo:
            return cls(conninfo=conninfo)

        host = os.getenv("POSTGRES_HOST")
        user = os.getenv("POSTGRES_USER")
        password = os.getenv("POSTGRES_PASSWORD")
        dbname = os.getenv("POSTGRES_DB")
        port_raw = os.getenv("POSTGRES_PORT", "5432")

        if not host or not user or not password or not dbname:
            raise DatabaseConfigError(
                "Incomplete PostgreSQL configuration. Set DATABASE_URL or the POSTGRES_* variables."
            )

        try:
            port = int(port_raw)
        except ValueError as exc:
            raise DatabaseConfigError("POSTGRES_PORT must be an integer") from exc

        return cls(host=host, port=port, user=user, password=password, dbname=dbname)


def get_connection() -> "psycopg.Connection[Any]":
    """Return a psycopg connection using environment variables."""
    settings = ConnectionSettings.from_environment()
    if settings.conninfo:
        return psycopg.connect(settings.conninfo, row_factory=dict_row)

    assert settings.host is not None  # for type checkers
    assert settings.port is not None
    assert settings.user is not None
    assert settings.password is not None
    assert settings.dbname is not None

    return psycopg.connect(
        host=settings.host,
        port=settings.port,
        user=settings.user,
        password=settings.password,
        dbname=settings.dbname,
        row_factory=dict_row,
    )


__all__ = ["get_connection", "DatabaseConfigError", "ConnectionSettings"]
