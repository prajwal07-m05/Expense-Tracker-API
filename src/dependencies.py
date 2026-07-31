"""Wiring for the repository singleton.

Routes depend on ``get_repository`` rather than importing a module-level
object, which lets the test-suite swap in a repository backed by a temp file
via ``app.dependency_overrides``.
"""

from __future__ import annotations

import os
from functools import lru_cache

from .storage import ExpenseRepository

DEFAULT_DATA_FILE = "data/expenses.json"


def data_file_path() -> str:
    """Storage location; override with the ``EXPENSES_DATA_FILE`` env var."""
    return os.environ.get("EXPENSES_DATA_FILE", DEFAULT_DATA_FILE)


@lru_cache(maxsize=1)
def get_repository() -> ExpenseRepository:
    return ExpenseRepository(data_file_path())
