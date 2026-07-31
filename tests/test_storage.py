"""Unit tests for the persistence layer, independent of HTTP."""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

import pytest

from src.models import ExpenseCreate, ExpenseUpdate
from src.storage import CorruptStoreError, ExpenseNotFoundError, ExpenseRepository


def make(title: str = "Lunch", amount: str = "10.00", category: str = "food") -> ExpenseCreate:
    return ExpenseCreate(title=title, amount=Decimal(amount), category=category)


def test_add_and_get_roundtrip(repo: ExpenseRepository) -> None:
    expense = repo.add(make())
    assert repo.get(expense.id) == expense
    assert len(repo) == 1


def test_ids_are_unique(repo: ExpenseRepository) -> None:
    ids = {repo.add(make()).id for _ in range(50)}
    assert len(ids) == 50


def test_data_survives_a_restart(data_file: Path) -> None:
    first = ExpenseRepository(data_file)
    created = first.add(make(title="Rent", amount="1200.00", category="Housing"))

    reopened = ExpenseRepository(data_file)  # simulates a server restart
    restored = reopened.get(created.id)
    assert restored.title == "Rent"
    assert restored.amount == Decimal("1200.00")
    assert restored.category == "housing"


def test_file_contains_a_json_array(repo: ExpenseRepository, data_file: Path) -> None:
    repo.add(make())
    payload = json.loads(data_file.read_text())
    assert isinstance(payload, list) and len(payload) == 1
    assert set(payload[0]) == {"id", "title", "amount", "category", "date"}


def test_delete_persists(repo: ExpenseRepository, data_file: Path) -> None:
    expense = repo.add(make())
    repo.delete(expense.id)
    assert json.loads(data_file.read_text()) == []
    with pytest.raises(ExpenseNotFoundError):
        repo.get(expense.id)


def test_update_keeps_untouched_fields(repo: ExpenseRepository) -> None:
    expense = repo.add(make())
    updated = repo.update(expense.id, ExpenseUpdate(category="Groceries"))
    assert updated.category == "groceries"
    assert updated.title == expense.title
    assert updated.amount == expense.amount
    assert updated.id == expense.id


def test_missing_file_starts_empty(tmp_path: Path) -> None:
    assert len(ExpenseRepository(tmp_path / "nested" / "nope.json")) == 0


def test_corrupt_file_fails_loudly(tmp_path: Path) -> None:
    path = tmp_path / "expenses.json"
    path.write_text('{"not": "a list"}')
    with pytest.raises(CorruptStoreError):
        ExpenseRepository(path)


def test_repository_can_run_purely_in_memory() -> None:
    repo = ExpenseRepository(None)
    repo.add(make())
    assert len(repo) == 1


def test_list_filters_by_normalised_category(repo: ExpenseRepository) -> None:
    repo.add(make(category="Food"))
    repo.add(make(category="  food  "))
    repo.add(make(category="Transport"))
    assert len(repo.list(category="FOOD")) == 2
# Additional test case
