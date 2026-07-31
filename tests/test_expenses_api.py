"""End-to-end tests for the HTTP surface (the five required operations)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


# ------------------------------------------------------------------ create


def test_create_expense_returns_201_with_generated_id(client: TestClient) -> None:
    response = client.post(
        "/expenses",
        json={"title": "Coffee", "amount": 3.4, "category": "Food", "date": "2026-07-05"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["id"]
    assert body["title"] == "Coffee"
    assert body["amount"] == 3.40
    assert body["category"] == "food"  # normalised
    assert body["date"] == "2026-07-05"


def test_create_defaults_date_to_today(client: TestClient) -> None:
    from datetime import date

    response = client.post("/expenses", json={"title": "Tea", "amount": 2, "category": "food"})
    assert response.status_code == 201
    assert response.json()["date"] == date.today().isoformat()


@pytest.mark.parametrize(
    "payload",
    [
        {"title": "", "amount": 5, "category": "food"},
        {"title": "  ", "amount": 5, "category": "food"},
        {"title": "X", "amount": -5, "category": "food"},
        {"title": "X", "amount": 0, "category": "food"},
        {"title": "X", "amount": "abc", "category": "food"},
        {"title": "X", "amount": 5, "category": ""},
        {"title": "X", "amount": 5},  # missing category
        {"amount": 5, "category": "food"},  # missing title
        {"title": "X", "amount": 5, "category": "food", "date": "not-a-date"},
        {"title": "X", "amount": 5, "category": "food", "surprise": True},  # extra field
    ],
)
def test_create_rejects_invalid_payloads(client: TestClient, payload: dict) -> None:
    assert client.post("/expenses", json=payload).status_code == 422


def test_amount_is_not_subject_to_float_drift(client: TestClient) -> None:
    """0.1 + 0.2 must total 0.30, not 0.30000000000000004."""
    for amount in (0.1, 0.2):
        client.post("/expenses", json={"title": "x", "amount": amount, "category": "misc"})
    assert client.get("/expenses/totals").json()["total"] == 0.30


# -------------------------------------------------------------------- read


def test_list_returns_all_newest_first(client: TestClient, sample_expenses: list[dict]) -> None:
    body = client.get("/expenses").json()
    assert len(body) == len(sample_expenses)
    dates = [item["date"] for item in body]
    assert dates == sorted(dates, reverse=True)


def test_list_is_empty_by_default(client: TestClient) -> None:
    assert client.get("/expenses").json() == []


def test_filter_by_category_is_case_insensitive(
    client: TestClient, sample_expenses: list[dict]
) -> None:
    for query in ("food", "Food", "  FOOD  "):
        body = client.get("/expenses", params={"category": query}).json()
        assert {item["title"] for item in body} == {"Lunch", "Groceries"}


def test_filter_by_unknown_category_returns_empty_list(
    client: TestClient, sample_expenses: list[dict]
) -> None:
    response = client.get("/expenses", params={"category": "yachts"})
    assert response.status_code == 200
    assert response.json() == []


def test_filter_by_date_range(client: TestClient, sample_expenses: list[dict]) -> None:
    body = client.get("/expenses", params={"from": "2026-07-01", "to": "2026-07-31"}).json()
    assert {item["title"] for item in body} == {"Lunch", "Bus pass"}


def test_inverted_date_range_is_a_400(client: TestClient) -> None:
    response = client.get("/expenses", params={"from": "2026-07-31", "to": "2026-07-01"})
    assert response.status_code == 400


def test_get_single_expense(client: TestClient, sample_expenses: list[dict]) -> None:
    expense_id = sample_expenses[0]["id"]
    assert client.get(f"/expenses/{expense_id}").json() == sample_expenses[0]


def test_get_missing_expense_is_404(client: TestClient) -> None:
    response = client.get("/expenses/does-not-exist")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_categories_endpoint(client: TestClient, sample_expenses: list[dict]) -> None:
    assert client.get("/expenses/categories").json() == [
        "entertainment",
        "food",
        "transport",
    ]


# ------------------------------------------------------------------ totals


def test_totals_overall_and_by_category(client: TestClient, sample_expenses: list[dict]) -> None:
    body = client.get("/expenses/totals").json()
    assert body["total"] == 154.75
    assert body["count"] == 4
    # Sorted by spend, descending.
    assert body["by_category"] == [
        {"category": "food", "total": 99.75, "count": 2},
        {"category": "transport", "total": 40.0, "count": 1},
        {"category": "entertainment", "total": 15.0, "count": 1},
    ]


def test_totals_for_one_category(client: TestClient, sample_expenses: list[dict]) -> None:
    body = client.get("/expenses/totals", params={"category": "Food"}).json()
    assert body["total"] == 99.75
    assert body["count"] == 2
    assert len(body["by_category"]) == 1


def test_totals_of_empty_store_are_zero(client: TestClient) -> None:
    assert client.get("/expenses/totals").json() == {
        "total": 0.0,
        "count": 0,
        "by_category": [],
    }


def test_category_totals_sum_to_overall(client: TestClient, sample_expenses: list[dict]) -> None:
    body = client.get("/expenses/totals").json()
    assert round(sum(b["total"] for b in body["by_category"]), 2) == body["total"]


# ------------------------------------------------------------------ bonus


def test_monthly_summary_groups_by_month_newest_first(
    client: TestClient, sample_expenses: list[dict]
) -> None:
    months = client.get("/expenses/summary/monthly").json()["months"]
    assert [m["month"] for m in months] == ["2026-07", "2026-06"]
    assert months[0]["total"] == 52.50
    assert months[1]["total"] == 102.25
    assert months[1]["by_category"][0] == {"category": "food", "total": 87.25, "count": 1}


# ------------------------------------------------------------ update/delete


def test_patch_updates_only_supplied_fields(
    client: TestClient, sample_expenses: list[dict]
) -> None:
    expense_id = sample_expenses[0]["id"]
    response = client.patch(f"/expenses/{expense_id}", json={"amount": 20})
    assert response.status_code == 200
    assert response.json()["amount"] == 20.0
    assert response.json()["title"] == sample_expenses[0]["title"]


def test_patch_missing_expense_is_404(client: TestClient) -> None:
    assert client.patch("/expenses/nope", json={"amount": 1}).status_code == 404


def test_delete_removes_the_expense(client: TestClient, sample_expenses: list[dict]) -> None:
    expense_id = sample_expenses[0]["id"]
    assert client.delete(f"/expenses/{expense_id}").status_code == 204
    assert client.get(f"/expenses/{expense_id}").status_code == 404
    assert len(client.get("/expenses").json()) == len(sample_expenses) - 1


def test_delete_is_not_idempotent_second_call_404s(
    client: TestClient, sample_expenses: list[dict]
) -> None:
    expense_id = sample_expenses[0]["id"]
    assert client.delete(f"/expenses/{expense_id}").status_code == 204
    assert client.delete(f"/expenses/{expense_id}").status_code == 404


def test_delete_updates_totals(client: TestClient, sample_expenses: list[dict]) -> None:
    client.delete(f"/expenses/{sample_expenses[1]['id']}")  # Bus pass, 40.00
    assert client.get("/expenses/totals").json()["total"] == 114.75


# --------------------------------------------------------------- docs/spec


def test_openapi_schema_is_served(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    assert schema["info"]["title"] == "Smart Expense Tracker API"
    assert "/expenses/{expense_id}" in schema["paths"]
