"""Pydantic models: the request/response contract of the API.

Design notes
------------
* Money is modelled as ``Decimal`` (never ``float``) so that repeated addition
  in the totals endpoints does not accumulate binary floating point error.
  Pydantic serialises it as a JSON number, so clients see ``12.50``.
* Categories are free-form strings but are *normalised* (trimmed +
  lower-cased) so that ``"Food"``, ``"food"`` and ``" food "`` are the same
  bucket. Filtering and grouping therefore behave the way a user expects.
* The ``id`` is generated server-side. Letting a client pick the id invites
  collisions and is not something the assignment requires.
"""

from __future__ import annotations

import uuid
from datetime import date as date_type
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, field_validator

# Money is a Decimal internally (exact arithmetic) but is emitted as a JSON
# *number* rather than Pydantic's default string, because "amount": 12.5 is what
# an HTTP client expects. The value is always quantised to 2dp first, so the
# float conversion is lossless at the precision we care about.
Money = Annotated[
    Decimal,
    PlainSerializer(float, return_type=float, when_used="json"),
]

# Positive, at most 2 decimal places, sane upper bound on size.
Amount = Annotated[
    Money,
    Field(gt=Decimal("0"), max_digits=12, decimal_places=2, examples=[12.50]),
]

CategoryStr = Annotated[str, Field(min_length=1, max_length=50, examples=["food"])]


def _normalise_category(value: str) -> str:
    return " ".join(value.strip().lower().split())


class ExpenseBase(BaseModel):
    """Fields supplied by the client."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: Annotated[str, Field(min_length=1, max_length=120, examples=["Lunch"])]
    amount: Amount
    category: CategoryStr
    date: date_type = Field(
        default_factory=date_type.today,
        description="ISO-8601 date (YYYY-MM-DD). Defaults to today.",
    )

    @field_validator("category")
    @classmethod
    def normalise_category(cls, value: str) -> str:
        normalised = _normalise_category(value)
        if not normalised:
            raise ValueError("category must not be blank")
        return normalised

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("title must not be blank")
        return value.strip()

    @field_validator("amount")
    @classmethod
    def quantise_amount(cls, value: Decimal) -> Decimal:
        # Store a canonical 2dp value so "10" and "10.00" round-trip identically.
        return value.quantize(Decimal("0.01"))


class ExpenseCreate(ExpenseBase):
    """Payload for ``POST /expenses``."""


class ExpenseUpdate(BaseModel):
    """Payload for ``PATCH /expenses/{id}`` — every field optional."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: Annotated[str, Field(min_length=1, max_length=120)] | None = None
    amount: Amount | None = None
    category: CategoryStr | None = None
    date: date_type | None = None

    @field_validator("category")
    @classmethod
    def normalise_category(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalised = _normalise_category(value)
        if not normalised:
            raise ValueError("category must not be blank")
        return normalised

    @field_validator("amount")
    @classmethod
    def quantise_amount(cls, value: Decimal | None) -> Decimal | None:
        return None if value is None else value.quantize(Decimal("0.01"))


class Expense(ExpenseBase):
    """A stored expense, as returned by the API."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class CategoryTotal(BaseModel):
    category: str
    total: Money
    count: int


class TotalsResponse(BaseModel):
    """``GET /expenses/totals`` — overall total plus per-category breakdown."""

    total: Money
    count: int
    by_category: list[CategoryTotal]


class MonthlyTotal(BaseModel):
    month: str = Field(examples=["2026-07"], description="Year-month, YYYY-MM.")
    total: Money
    count: int
    by_category: list[CategoryTotal]


class MonthlySummaryResponse(BaseModel):
    """``GET /expenses/summary/monthly`` — the chosen bonus feature."""

    months: list[MonthlyTotal]


class ErrorResponse(BaseModel):
    detail: str
