"""HTTP routes for the expense tracker."""

from __future__ import annotations

from datetime import date as date_type
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from . import service
from .dependencies import get_repository
from .models import (
    ErrorResponse,
    Expense,
    ExpenseCreate,
    ExpenseUpdate,
    MonthlySummaryResponse,
    TotalsResponse,
)
from .storage import ExpenseNotFoundError, ExpenseRepository

router = APIRouter(prefix="/expenses", tags=["expenses"])

Repo = Annotated[ExpenseRepository, Depends(get_repository)]

NOT_FOUND = {status.HTTP_404_NOT_FOUND: {"model": ErrorResponse, "description": "Expense not found"}}


def _validate_range(date_from: date_type | None, date_to: date_type | None) -> None:
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'from' must not be later than 'to'",
        )


@router.post(
    "",
    response_model=Expense,
    status_code=status.HTTP_201_CREATED,
    summary="Add an expense",
)
def create_expense(payload: ExpenseCreate, repo: Repo) -> Expense:
    return repo.add(payload)


@router.get("", response_model=list[Expense], summary="List / filter expenses")
def list_expenses(
    repo: Repo,
    category: Annotated[
        str | None, Query(description="Case-insensitive exact category match.")
    ] = None,
    date_from: Annotated[
        date_type | None, Query(alias="from", description="Only expenses on/after this date.")
    ] = None,
    date_to: Annotated[
        date_type | None, Query(alias="to", description="Only expenses on/before this date.")
    ] = None,
) -> list[Expense]:
    _validate_range(date_from, date_to)
    return repo.list(category=category, date_from=date_from, date_to=date_to)


# NOTE: the literal paths below are declared *before* "/{expense_id}" — FastAPI
# matches routes in declaration order, so otherwise "totals" would be captured
# as an id and return a 404.
@router.get("/totals", response_model=TotalsResponse, summary="Overall + per-category totals")
def get_totals(
    repo: Repo,
    category: Annotated[str | None, Query(description="Restrict the totals to one category.")] = None,
    date_from: Annotated[date_type | None, Query(alias="from")] = None,
    date_to: Annotated[date_type | None, Query(alias="to")] = None,
) -> TotalsResponse:
    _validate_range(date_from, date_to)
    return service.compute_totals(
        repo.list(category=category, date_from=date_from, date_to=date_to)
    )


@router.get(
    "/summary/monthly",
    response_model=MonthlySummaryResponse,
    summary="Bonus: spend grouped by calendar month",
)
def get_monthly_summary(
    repo: Repo,
    category: Annotated[str | None, Query()] = None,
) -> MonthlySummaryResponse:
    return service.compute_monthly_summary(repo.list(category=category))


@router.get("/categories", response_model=list[str], summary="Distinct categories in use")
def list_categories(repo: Repo) -> list[str]:
    return repo.categories()


@router.get("/{expense_id}", response_model=Expense, responses=NOT_FOUND, summary="Get one expense")
def get_expense(expense_id: str, repo: Repo) -> Expense:
    try:
        return repo.get(expense_id)
    except ExpenseNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.patch(
    "/{expense_id}", response_model=Expense, responses=NOT_FOUND, summary="Update an expense"
)
def update_expense(expense_id: str, payload: ExpenseUpdate, repo: Repo) -> Expense:
    try:
        return repo.update(expense_id, payload)
    except ExpenseNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.delete(
    "/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=NOT_FOUND,
    summary="Delete an expense",
)
def delete_expense(expense_id: str, repo: Repo) -> Response:
    try:
        repo.delete(expense_id)
    except ExpenseNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
