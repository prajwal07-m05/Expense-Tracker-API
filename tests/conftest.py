"""Shared fixtures.

Every test gets a repository backed by a fresh temp file, injected through
``dependency_overrides``. Tests never touch the real ``data/expenses.json``.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

import pytest
from fastapi.testclient import TestClient

from src.dependencies import get_repository
from src.main import create_app
from src.storage import ExpenseRepository


@pytest.fixture()
def data_file(tmp_path: Path) -> Path:
    return tmp_path / "expenses.json"


@pytest.fixture()
def repo(data_file: Path) -> ExpenseRepository:
    return ExpenseRepository(data_file)


@pytest.fixture()
def client(repo: ExpenseRepository) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_repository] = lambda: repo
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def sample_expenses(client: TestClient) -> list[dict]:
    payloads = [
        {"title": "Lunch", "amount": 12.50, "category": "Food", "date": "2026-07-01"},
        {"title": "Bus pass", "amount": 40, "category": "transport", "date": "2026-07-03"},
        {"title": "Groceries", "amount": 87.25, "category": "food", "date": "2026-06-28"},
        {"title": "Cinema", "amount": 15.00, "category": "Entertainment", "date": "2026-06-15"},
    ]
    created = []
    for payload in payloads:
        response = client.post("/expenses", json=payload)
        assert response.status_code == 201, response.text
        created.append(response.json())
    return created
