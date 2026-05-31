"""
Unit tests for Behavioral Analyzer Service
"""

from datetime import datetime, time, timedelta

import pytest

from app.services.behavioral_analyzer import BehavioralAnalyzerService


@pytest.fixture
def analyzer():
    return BehavioralAnalyzerService()


def _tx(amount, hour=15, day_offset=0, category="FOOD_DINING", merchant="Cafe", **extra):
    """
    Build a transaction at a deterministic local time.

    The analyzer's `_is_late_night` check uses naive `datetime.time()`,
    so we build naive datetimes here. `day_offset` is days back from a
    fixed Wednesday so the weekend bit can be set deliberately by
    callers (e.g. day_offset=5 -> Saturday).
    """
    base = datetime(2024, 1, 17, hour, 0, 0)  # Wednesday
    return {
        "type": "DEBIT",
        "amount": amount,
        "category": category,
        "merchantName": merchant,
        "transactionDate": (base - timedelta(days=day_offset)).isoformat(),
        **extra,
    }


class TestBehavioralAnalyzerService:
    def test_empty_input_returns_zeros(self, analyzer):
        result = analyzer.analyze_patterns("user-1", [], period_days=30)

        assert result["total_analyzed"] == 0
        assert result["patterns"]["late_night"]["transaction_count"] == 0
        assert result["patterns"]["weekend"]["transaction_count"] == 0
        assert result["patterns"]["impulse"]["transaction_count"] == 0
        assert result["behavioral_score"]["rating"] == "NO_DATA"
        assert result["insights"] == []

    def test_credits_are_excluded(self, analyzer):
        """Credits should never be counted as expenses or impulses."""
        result = analyzer.analyze_patterns(
            "user-1",
            [
                {
                    "type": "CREDIT",
                    "amount": 50000,
                    "transactionDate": "2024-01-17T15:00:00",
                }
            ],
        )

        assert result["total_analyzed"] == 0

    def test_is_late_night_window(self, analyzer):
        """The 22:00–06:00 window is inclusive at both ends per spec."""
        late_obj = datetime(2024, 1, 17, 23, 30, 0)
        morning = datetime(2024, 1, 17, 5, 0, 0)
        midday = datetime(2024, 1, 17, 13, 0, 0)
        boundary_lower = datetime(2024, 1, 17, 22, 0, 0)
        boundary_upper = datetime(2024, 1, 17, 6, 0, 0)

        assert analyzer._is_late_night(late_obj) is True
        assert analyzer._is_late_night(morning) is True
        assert analyzer._is_late_night(midday) is False
        assert analyzer._is_late_night(boundary_lower) is True
        assert analyzer._is_late_night(boundary_upper) is True

    def test_late_night_pattern_counted(self, analyzer):
        transactions = [
            _tx(800, hour=23, merchant="Zomato"),
            _tx(600, hour=2, merchant="Swiggy"),
            _tx(400, hour=15, merchant="Cafe"),
        ]

        result = analyzer.analyze_patterns("user-1", transactions)

        assert result["patterns"]["late_night"]["transaction_count"] == 2
        assert result["patterns"]["late_night"]["total_amount"] == 1400.0
        # Total spend is 1800; late-night is 1400 -> ~77.78%
        assert (
            result["patterns"]["late_night"]["percentage_of_spending"]
            == pytest.approx(77.78, rel=1e-2)
        )

    def test_weekend_pattern_counted(self, analyzer):
        # base date is Wednesday 17 Jan 2024; offset=4 -> Saturday, offset=5 -> Friday
        # Use offset=4 (Sat) and offset=5 (Fri) and offset=11 (last Sat).
        transactions = [
            _tx(300, hour=12, day_offset=4),   # Sat
            _tx(400, hour=12, day_offset=11),  # Sat (one week earlier)
            _tx(200, hour=12, day_offset=2),   # Mon
        ]

        result = analyzer.analyze_patterns("user-1", transactions)

        assert result["patterns"]["weekend"]["transaction_count"] == 2
        assert result["patterns"]["weekend"]["total_amount"] == 700.0

    def test_impulse_score_aggregates_signals(self, analyzer):
        """Late-night + small + impulse merchant + impulse category trips the >0.6 cut."""
        score = analyzer._calculate_impulse_score(
            transaction={"merchantName": "Zomato"},
            tx_date=datetime(2024, 1, 17, 23, 0, 0),
            amount=80,
            category="FOOD_DINING",
        )

        # 0.3 (late night) + 0.3 (≤100) + 0.2 (category) + 0.2 (merchant) = 1.0
        assert score == pytest.approx(1.0)

    def test_impulse_score_caps_at_one(self, analyzer):
        """Even with all signals, we never exceed 1.0."""
        score = analyzer._calculate_impulse_score(
            transaction={"merchantName": "Netflix"},
            tx_date=datetime(2024, 1, 17, 23, 0, 0),
            amount=50,
            category="ENTERTAINMENT",
        )

        assert score <= 1.0

    def test_impulse_score_grocery_midday_low(self, analyzer):
        """Boring midday grocery run should not look like impulse."""
        score = analyzer._calculate_impulse_score(
            transaction={"merchantName": "BigBazaar"},
            tx_date=datetime(2024, 1, 17, 13, 0, 0),
            amount=2000,
            category="GROCERIES",
        )

        # No late-night, no impulse merchant/category, amount > 1000 -> 0.0
        assert score == pytest.approx(0.0)
        assert score < 0.6

    def test_late_night_insight_emits_high_severity(self, analyzer):
        """>20% late-night share should escalate the insight."""
        transactions = [
            _tx(2000, hour=23, merchant="Zomato"),
            _tx(2000, hour=2, merchant="Swiggy"),
            _tx(1000, hour=12, merchant="Cafe"),
        ]

        result = analyzer.analyze_patterns("user-1", transactions)
        insight = next(
            i for i in result["insights"] if i["type"] == "LATE_NIGHT_SPENDING"
        )

        assert insight["severity"] == "HIGH"
        assert insight["affected_amount"] == 4000.0

    def test_late_night_insight_skipped_under_threshold(self, analyzer):
        """≤10% late-night share shouldn't surface a late-night insight."""
        transactions = [_tx(50, hour=23, merchant="Cafe")] + [
            _tx(2000, hour=12, merchant="Cafe") for _ in range(5)
        ]

        result = analyzer.analyze_patterns("user-1", transactions)
        types = {i["type"] for i in result["insights"]}

        assert "LATE_NIGHT_SPENDING" not in types

    def test_impulse_insight_high_when_many_candidates(self, analyzer):
        """>5 impulse candidates should be HIGH severity."""
        transactions = [
            _tx(80, hour=23, merchant="Zomato", category="FOOD_DINING")
            for _ in range(6)
        ]

        result = analyzer.analyze_patterns("user-1", transactions)
        insight = next(
            i for i in result["insights"] if i["type"] == "IMPULSE_SPENDING"
        )

        assert insight["severity"] == "HIGH"
        assert "6" in insight["title"]

    def test_behavioral_score_rating_thresholds(self, analyzer):
        """Score thresholds map to the documented rating buckets."""

        # Crank impulse share so the weighted score lands in NEEDS_ATTENTION (>40).
        score = analyzer._calculate_behavioral_score(
            late_night_total=500,
            weekend_total=0,
            impulse_total=900,
            total_spent=1000,
        )
        assert score["rating"] == "NEEDS_ATTENTION"

        # Pristine case.
        clean = analyzer._calculate_behavioral_score(
            late_night_total=0,
            weekend_total=0,
            impulse_total=0,
            total_spent=10000,
        )
        assert clean["rating"] == "EXCELLENT"
        assert clean["score"] == 0

    def test_behavioral_score_no_data(self, analyzer):
        result = analyzer._calculate_behavioral_score(0, 0, 0, 0)
        assert result["rating"] == "NO_DATA"
        assert result["score"] == 0

    def test_parse_datetime_string_with_z_suffix(self, analyzer):
        parsed = analyzer._parse_datetime("2024-01-17T15:00:00Z")
        assert parsed.year == 2024
        assert parsed.month == 1

    def test_parse_datetime_invalid_returns_none(self, analyzer):
        assert analyzer._parse_datetime("not a date") is None
        assert analyzer._parse_datetime(None) is None

    def test_parse_datetime_passthrough(self, analyzer):
        dt = datetime(2024, 1, 17, 15, 0, 0)
        assert analyzer._parse_datetime(dt) is dt

    def test_skips_transactions_without_date(self, analyzer):
        """Missing/invalid dates are silently dropped, not exploded."""
        result = analyzer.analyze_patterns(
            "user-1",
            [
                {"type": "DEBIT", "amount": 500, "transactionDate": None},
                {"type": "DEBIT", "amount": 700, "date": "garbage"},
                _tx(300, hour=12),
            ],
        )

        # Only the valid transaction makes it through to the per-bucket
        # totals; the analyzer still counts every DEBIT in `total_analyzed`.
        assert result["total_analyzed"] == 3
        assert result["patterns"]["late_night"]["transaction_count"] == 0

    def test_tag_transactions_adds_flags(self, analyzer):
        transactions = [
            _tx(80, hour=23, merchant="Zomato"),         # late + impulse
            _tx(2000, hour=12, day_offset=4),            # weekend, not impulse
            _tx(500, hour=12, category="GROCERIES"),     # neither
            {"type": "DEBIT", "amount": 100, "date": None},  # no date -> untouched
        ]

        tagged = analyzer.tag_transactions(transactions)

        assert tagged[0]["isLateNight"] is True
        assert tagged[0]["isImpulse"] is True
        assert tagged[0]["impulseScore"] >= 0.6

        assert tagged[1]["isLateNight"] is False
        assert tagged[1]["isWeekend"] is True
        assert tagged[1]["isImpulse"] is False

        assert tagged[2]["isLateNight"] is False
        assert tagged[2]["isWeekend"] is False
        assert tagged[2]["isImpulse"] is False

        # Row without a parseable date is returned untouched (no flags
        # added).
        assert "isLateNight" not in tagged[3]
        assert "isImpulse" not in tagged[3]

    def test_tag_transactions_returns_copies(self, analyzer):
        """The analyzer must not mutate caller-supplied dicts in place."""
        original = _tx(80, hour=23, merchant="Zomato")
        tagged = analyzer.tag_transactions([original])

        assert "isLateNight" not in original
        assert tagged[0] is not original
