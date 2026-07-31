"""Application entrypoint: ``uvicorn src.main:app``."""

from __future__ import annotations

from fastapi import FastAPI

from . import __version__
from .api import router as expenses_router

DESCRIPTION = """
A small REST API for tracking personal expenses.

* Add, list, filter, update and delete expenses
* Overall and per-category totals
* Bonus: a monthly summary endpoint

Data is persisted to a local JSON file — no database required.
"""


def create_app() -> FastAPI:
    app = FastAPI(
        title="Smart Expense Tracker API",
        description=DESCRIPTION,
        version=__version__,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.include_router(expenses_router)

    @app.get("/health", tags=["meta"], summary="Liveness probe")
    def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__}

    return app


app = create_app()
