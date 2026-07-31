"""Persistence layer.

The repository keeps every expense in memory (an ordered ``dict`` keyed by id)
and mirrors that state to a local JSON file after each mutation, so data
survives a restart without needing a database.

Two details worth calling out:

* **Atomic writes.** We write to a temp file in the same directory and then
  ``os.replace`` it. A crash mid-write can therefore never leave a truncated,
  unparseable store behind.
* **Locking.** Uvicorn runs sync path operations in a thread pool, so two
  requests really can touch the store concurrently. A single ``RLock`` around
  read-modify-write keeps the in-memory dict and the file consistent.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from collections import OrderedDict
from datetime import date as date_type
from pathlib import Path
from typing import Iterable

from .models import Expense, ExpenseCreate, ExpenseUpdate


class ExpenseNotFoundError(LookupError):
    """Raised when an expense id does not exist."""

    def __init__(self, expense_id: str) -> None:
        super().__init__(f"Expense '{expense_id}' not found")
        self.expense_id = expense_id


class CorruptStoreError(RuntimeError):
    """Raised when the JSON file exists but cannot be understood."""


class ExpenseRepository:
    """CRUD + query operations over a JSON-file-backed collection."""

    def __init__(self, path: str | os.PathLike[str] | None = None) -> None:
        self._path = Path(path) if path is not None else None
        self._lock = threading.RLock()
        self._items: OrderedDict[str, Expense] = OrderedDict()
        self._load()

    # ------------------------------------------------------------------ io

    def _load(self) -> None:
        if self._path is None or not self._path.exists():
            return
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8") or "[]")
        except json.JSONDecodeError as exc:  # pragma: no cover - defensive
            raise CorruptStoreError(f"{self._path} is not valid JSON: {exc}") from exc
        if not isinstance(raw, list):
            raise CorruptStoreError(f"{self._path} must contain a JSON array")
        for entry in raw:
            expense = Expense.model_validate(entry)
            self._items[expense.id] = expense

    def _flush(self) -> None:
        if self._path is None:
            return
        self._path.parent.mkdir(parents=True, exist_ok=True)
        # Dumped in "python" mode + ``default=str`` so amounts land in the file
        # as exact decimal strings ("12.50") instead of floats. That makes the
        # load -> save round-trip lossless.
        payload = [e.model_dump(mode="python") for e in self._items.values()]
        fd, tmp_name = tempfile.mkstemp(
            dir=str(self._path.parent), prefix=".expenses-", suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, indent=2, ensure_ascii=False, default=str)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_name, self._path)
        except BaseException:
            Path(tmp_name).unlink(missing_ok=True)
            raise

    # ------------------------------------------------------------- commands

    def add(self, payload: ExpenseCreate) -> Expense:
        expense = Expense(**payload.model_dump())
        with self._lock:
            self._items[expense.id] = expense
            self._flush()
        return expense

    def update(self, expense_id: str, payload: ExpenseUpdate) -> Expense:
        with self._lock:
            current = self._items.get(expense_id)
            if current is None:
                raise ExpenseNotFoundError(expense_id)
            changes = payload.model_dump(exclude_unset=True, exclude_none=True)
            updated = current.model_copy(update=changes)
            self._items[expense_id] = updated
            self._flush()
        return updated

    def delete(self, expense_id: str) -> None:
        with self._lock:
            if self._items.pop(expense_id, None) is None:
                raise ExpenseNotFoundError(expense_id)
            self._flush()

    def clear(self) -> None:
        with self._lock:
            self._items.clear()
            self._flush()

    # -------------------------------------------------------------- queries

    def get(self, expense_id: str) -> Expense:
        with self._lock:
            expense = self._items.get(expense_id)
        if expense is None:
            raise ExpenseNotFoundError(expense_id)
        return expense

    def list(
        self,
        *,
        category: str | None = None,
        date_from: date_type | None = None,
        date_to: date_type | None = None,
    ) -> list[Expense]:
        """Return expenses newest-first, optionally filtered.

        ``category`` is matched case-insensitively against the normalised
        stored value, so ``?category=Food`` finds ``"food"``.
        """
        wanted = " ".join(category.strip().lower().split()) if category else None
        with self._lock:
            items: Iterable[Expense] = list(self._items.values())
        result = [
            e
            for e in items
            if (wanted is None or e.category == wanted)
            and (date_from is None or e.date >= date_from)
            and (date_to is None or e.date <= date_to)
        ]
        # Newest first; ties broken by insertion order for a stable response.
        result.sort(key=lambda e: e.date, reverse=True)
        return result

    def categories(self) -> list[str]:
        with self._lock:
            return sorted({e.category for e in self._items.values()})

    def __len__(self) -> int:
        with self._lock:
            return len(self._items)
