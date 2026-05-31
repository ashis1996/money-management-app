"""
Unit tests for Money Leak Detector Service
"""

import pytest

from app.services.leak_detector import LeakDetectorService


@pytest.fixture
def detector():
    return LeakDetectorService()


def _sub(name, amount, frequency="MONTHLY", **extra):
    return {
        "id": f"sub-{name}",
        "status": "ACTIVE",
        "name": name,
        "merchantName": name,
        "amount": amount,
        "frequency": frequency,
        **extra,
    }


def _debit(amount, merchant="Cafe", date="2024-01-15T12:00:00", **extra):
    return {
        "type": "DEBIT",
        "amount": amount,
        "merchantName": merchant,
        "transactionDate": date,
        **extra,
    }


class TestUnusedSubscriptions:
    def test_low_usage_flag_triggers_leak(self, detector):
        leaks = detector._detect_unused_subscriptions(
            [_sub("Hotstar", 299, isLowUsage=True, usageScore=0.1)]
        )

        assert len(leaks) == 1
        assert leaks[0]["type"] == "UNUSED_SUBSCRIPTION"
        assert leaks[0]["severity"] == "HIGH"
        assert leaks[0]["monthly_savings"] == 299.0

    def test_low_usage_score_below_03_triggers_leak(self, detector):
        leaks = detector._detect_unused_subscriptions(
            [_sub("Hotstar", 299, usageScore=0.2)]
        )

        assert len(leaks) == 1

    def test_high_usage_no_leak(self, detector):
        leaks = detector._detect_unused_subscriptions(
            [_sub("Netflix", 499, usageScore=0.9)]
        )
        assert leaks == []

    def test_inactive_skipped(self, detector):
        leaks = detector._detect_unused_subscriptions(
            [_sub("Hotstar", 299, status="CANCELLED", isLowUsage=True)]
        )
        assert leaks == []

    @pytest.mark.parametrize(
        "frequency,amount,expected_monthly",
        [
            ("WEEKLY", 100, 400),
            ("MONTHLY", 199, 199),
            ("QUARTERLY", 600, 200),
            ("YEARLY", 1200, 100),
        ],
    )
    def test_frequency_normalised_to_monthly(
        self, detector, frequency, amount, expected_monthly
    ):
        leaks = detector._detect_unused_subscriptions(
            [_sub("X", amount, frequency=frequency, isLowUsage=True)]
        )

        assert leaks[0]["monthly_savings"] == expected_monthly


class TestDuplicateSubscriptions:
    def test_two_video_services_flagged_as_duplicate(self, detector):
        leaks = detector._detect_duplicate_subscriptions(
            [_sub("Netflix", 499), _sub("Hotstar", 299)]
        )

        assert len(leaks) == 1
        leak = leaks[0]
        assert leak["type"] == "DUPLICATE_SERVICES"
        assert leak["category"] == "video"
        # Cheaper subscription is "kept", so saved amount is the more
        # expensive one (Netflix).
        assert leak["monthly_savings"] == 499.0
        assert leak["amount"] == 798.0

    def test_single_service_in_category_no_duplicate(self, detector):
        leaks = detector._detect_duplicate_subscriptions([_sub("Spotify", 119)])
        assert leaks == []

    def test_inactive_subs_not_counted(self, detector):
        leaks = detector._detect_duplicate_subscriptions(
            [
                _sub("Spotify", 119, status="CANCELLED"),
                _sub("Apple Music", 99),
            ]
        )

        assert leaks == []

    def test_duplicate_recommendation_names_cheapest(self, detector):
        leaks = detector._detect_duplicate_subscriptions(
            [_sub("Netflix", 499), _sub("Hotstar", 299), _sub("Zee5", 199)]
        )

        assert "Zee5" in leaks[0]["recommendation"]


class TestPriceIncreases:
    def test_price_hike_yields_leak(self, detector):
        leaks = detector._detect_price_increases(
            [
                _sub(
                    "Netflix",
                    649,
                    priceIncreased=True,
                    originalAmount=499,
                    priceIncreasePercent=30,
                )
            ]
        )

        assert len(leaks) == 1
        assert leaks[0]["extra_monthly_cost"] == 150.0
        assert leaks[0]["severity"] == "LOW"
        assert leaks[0]["monthly_savings"] == 150.0

    def test_no_flag_no_leak(self, detector):
        leaks = detector._detect_price_increases([_sub("Netflix", 499)])
        assert leaks == []

    def test_missing_original_skipped(self, detector):
        leaks = detector._detect_price_increases(
            [_sub("Netflix", 649, priceIncreased=True)]
        )
        # Without an originalAmount the leak can't be quantified.
        assert leaks == []


class TestSmallFrequentExpenses:
    def test_five_or_more_small_charges_at_same_merchant(self, detector):
        transactions = [
            _debit(150, merchant="Chai") for _ in range(6)
        ]

        leaks = detector._detect_small_frequent_expenses(transactions)

        assert len(leaks) == 1
        assert leaks[0]["type"] == "SMALL_FREQUENT"
        assert leaks[0]["transaction_count"] == 6
        assert leaks[0]["total_amount"] == 900.0

    def test_below_five_threshold_no_leak(self, detector):
        transactions = [_debit(150, merchant="Chai") for _ in range(4)]
        assert detector._detect_small_frequent_expenses(transactions) == []

    def test_amounts_above_threshold_ignored(self, detector):
        transactions = [_debit(500, merchant="Lunch") for _ in range(6)]
        assert detector._detect_small_frequent_expenses(transactions) == []

    def test_only_top_five_leaks_returned(self, detector):
        transactions = []
        for i in range(7):
            transactions.extend(
                [_debit(50, merchant=f"M{i}") for _ in range(5)]
            )

        leaks = detector._detect_small_frequent_expenses(transactions)
        assert len(leaks) == 5

    def test_credits_skipped(self, detector):
        # Five credits at the same merchant must not register as a leak.
        transactions = [
            {
                "type": "CREDIT",
                "amount": 50,
                "merchantName": "Refund",
                "transactionDate": "2024-01-15T12:00:00",
            }
            for _ in range(6)
        ]

        assert detector._detect_small_frequent_expenses(transactions) == []


class TestImpulseAndLateNight:
    def test_impulse_leak_aggregates_count_and_amount(self, detector):
        transactions = [_debit(100, isImpulse=True) for _ in range(3)]

        leaks = detector._detect_impulse_leaks(transactions)
        assert len(leaks) == 1
        assert leaks[0]["transaction_count"] == 3
        assert leaks[0]["total_amount"] == 300.0
        assert leaks[0]["monthly_savings"] == 300.0

    def test_no_impulse_no_leak(self, detector):
        assert detector._detect_impulse_leaks([_debit(100)]) == []

    def test_late_night_savings_assumed_50pct(self, detector):
        transactions = [_debit(200, isLateNight=True) for _ in range(2)]

        leaks = detector._detect_late_night_leaks(transactions)
        assert leaks[0]["total_amount"] == 400.0
        assert leaks[0]["monthly_savings"] == 200.0

    def test_no_late_night_no_leak(self, detector):
        assert detector._detect_late_night_leaks([_debit(100)]) == []


class TestDetectAll:
    def test_combined_detection_summary(self, detector):
        subscriptions = [
            _sub("Hotstar", 299, isLowUsage=True),
            _sub("Netflix", 499),
            _sub("Zee5", 199),
        ]
        transactions = [
            _debit(150, merchant="Chai") for _ in range(6)
        ] + [_debit(100, isImpulse=True) for _ in range(2)]

        result = detector.detect_leaks(
            user_id="user-1",
            transactions=transactions,
            subscriptions=subscriptions,
        )

        assert result["leaks_found"] >= 3
        types = {leak["type"] for leak in result["leaks"]}
        assert "UNUSED_SUBSCRIPTION" in types
        assert "DUPLICATE_SERVICES" in types
        assert "SMALL_FREQUENT" in types
        assert "IMPULSE_PURCHASES" in types

        assert result["potential_monthly_savings"] > 0
        assert "summary" in result
        assert "analyzed_at" in result

    def test_no_data_returns_zero_score(self, detector):
        result = detector.detect_leaks("user-1", [])
        assert result["leak_score"] == 0
        assert result["leaks_found"] == 0


class TestLeakScore:
    def test_zero_spend_zero_score(self, detector):
        assert detector._calculate_leak_score([], 0) == 0

    @pytest.mark.parametrize(
        "leak_amount,total_spent,expected_bucket",
        [
            (100, 10000, (0, 30)),       # 1% -> within 0-30
            (1000, 10000, (30, 50)),     # 10% -> 30-50
            (2000, 10000, (50, 70)),     # 20% -> 50-70
            (4000, 10000, (70, 100)),    # 40% -> 70-100
        ],
    )
    def test_score_buckets(self, detector, leak_amount, total_spent, expected_bucket):
        transactions = [_debit(total_spent)]
        score = detector._calculate_leak_score(transactions, leak_amount)
        low, high = expected_bucket
        assert low <= score <= high


class TestSummary:
    def test_summary_groups_by_type(self, detector):
        leaks = [
            {"type": "UNUSED_SUBSCRIPTION", "amount": 299},
            {"type": "UNUSED_SUBSCRIPTION", "amount": 199},
            {"type": "IMPULSE_PURCHASES", "amount": 500},
        ]

        summary = detector._generate_leak_summary(leaks)

        assert summary["UNUSED_SUBSCRIPTION"]["count"] == 2
        assert summary["UNUSED_SUBSCRIPTION"]["total"] == 498.0
        assert summary["UNUSED_SUBSCRIPTION"]["name"] == "Unused Subscriptions"
        assert summary["IMPULSE_PURCHASES"]["count"] == 1
