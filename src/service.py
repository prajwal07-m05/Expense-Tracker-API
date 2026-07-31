"""Aggregation logic, kept out of the HTTP layer so it can be unit-tested.

All arithmetic is done on ``Decimal`` and quantised to 2dp at the end, so the
sum of the per-category totals always equals the reported overall total.
"""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal
from typing import Sequence

from .models import (
    CategoryTotal,
    Expense,
    MonthlySummaryResponse,
    MonthlyTotal,
    TotalsResponse,
)

TWO_PLACES = Decimal("0.01")


def _bucket(expenses: Sequence[Expense]) -> list[CategoryTotal]:
    totals: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    counts: dict[str, int] = defaultdict(int)
    for expense in expenses:
        totals[expense.category] += expense.amount
        counts[expense.category] += 1
    buckets = [
        CategoryTotal(
            category=category,
            total=amount.quantize(TWO_PLACES),
            count=counts[category],
        )
        for category, amount in totals.items()
    ]
    # Biggest spend first — that is the interesting ordering for a report;
    # alphabetical as a deterministic tie-breaker.
    buckets.sort(key=lambda b: (-b.total, b.category))
    return buckets


def compute_totals(expenses: Sequence[Expense]) -> TotalsResponse:
    overall = sum((e.amount for e in expenses), Decimal("0"))
    return TotalsResponse(
        total=overall.quantize(TWO_PLACES),
        count=len(expenses),
        by_category=_bucket(expenses),
    )


def compute_monthly_summary(expenses: Sequence[Expense]) -> MonthlySummaryResponse:
    grouped: dict[str, list[Expense]] = defaultdict(list)
    for expense in expenses:
        grouped[expense.date.strftime("%Y-%m")].append(expense)

    months = [
        MonthlyTotal(
            month=month,
            total=sum((e.amount for e in items), Decimal("0")).quantize(TWO_PLACES),
            count=len(items),
            by_category=_bucket(items),
        )
        for month, items in sorted(grouped.items(), reverse=True)
    ]
    return MonthlySummaryResponse(months=months)
