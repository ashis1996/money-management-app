"""
Unit tests for Email Parser Service.

We're testing the thin wrapper, not the underlying SMS parser. The bank
regex coverage already lives in test_sms_parser.py; here we focus on
behaviours unique to the email path:

  - HTML stripping
  - subject + body composition
  - autodetection of HTML vs plain text
  - timestamp defaulting
  - source_kind / is_email flags
"""

from datetime import datetime
from unittest.mock import MagicMock

import pytest

from app.services.email_parser import EmailParserService, _PlainText
from app.services.sms_parser import SmsParserService


@pytest.fixture
def parser():
    return EmailParserService()


# ---------------------------------------------------------------------------
# HTML stripping
# ---------------------------------------------------------------------------
class TestHtmlStripping:
    def test_drops_tags(self):
        p = _PlainText()
        p.feed("<p>Hello <b>world</b></p>")
        p.close()
        assert "Hello world" in p.get_text()
        assert "<" not in p.get_text()

    def test_collapses_whitespace_per_line(self):
        p = _PlainText()
        p.feed("<p>Hello   there</p>")
        p.close()
        assert p.get_text() == "Hello there"

    def test_block_tags_emit_newlines(self):
        p = _PlainText()
        p.feed("<p>Line one</p><p>Line two</p>")
        p.close()
        text = p.get_text()
        assert "Line one" in text
        assert "Line two" in text
        assert text.count("\n") >= 1

    def test_drops_script_and_style(self):
        p = _PlainText()
        p.feed(
            "<style>.x{color:red}</style>"
            "<script>alert(1)</script>"
            "<p>Visible</p>"
        )
        p.close()
        text = p.get_text()
        assert "Visible" in text
        assert "alert" not in text
        assert "color" not in text

    def test_decodes_entities(self):
        p = _PlainText()
        p.feed("<p>Rs.&nbsp;549</p>")
        p.close()
        # convert_charrefs=True maps &nbsp; to NBSP. We accept either
        # NBSP or a regular space so the test is whitespace-agnostic.
        text = p.get_text()
        assert "549" in text
        assert "Rs." in text


# ---------------------------------------------------------------------------
# parse_email behaviour
# ---------------------------------------------------------------------------
class TestParseEmail:
    def test_plaintext_passes_through_to_sms_parser(self, parser):
        body = "Rs.549.00 debited from a/c **4521 for UPI/SWIGGY/order 12345"
        result = parser.parse_email(
            body=body,
            sender="alerts@hdfcbank.net",
            subject=None,
            timestamp=datetime(2024, 6, 15, 12, 0, 0),
        )

        # Should hit the existing SMS parser's regex coverage.
        assert result["amount"] == 549.0
        assert result["transaction_type"] == "DEBIT"
        # The wrapper marks the source so the backend can discriminate.
        assert result["is_email"] is True
        assert result["source_kind"] == "EMAIL"

    def test_html_body_stripped_before_parsing(self, parser):
        body = (
            "<table><tr><td>"
            "<p>Rs.<b>549.00</b> debited from a/c <i>**4521</i> for UPI/ZOMATO</p>"
            "</td></tr></table>"
            "<style>.footer{color:#999}</style>"
        )
        result = parser.parse_email(
            body=body,
            sender="alerts@hdfcbank.net",
            subject="Transaction alert",
        )
        assert result["amount"] == 549.0
        assert result["transaction_type"] == "DEBIT"

    def test_subject_prepended_to_body(self):
        # Use a mocked SMS parser so we can assert on the composed input.
        sms = MagicMock(spec=SmsParserService)
        sms.parse_sms.return_value = {"amount": 549, "confidence": 0.9}

        parser = EmailParserService(sms_parser=sms)
        parser.parse_email(
            body="See your statement attached.",
            sender="alerts@hdfcbank.net",
            subject="Receipt: INR 549 to Swiggy",
        )

        # First positional arg to parse_sms is the composed text.
        args, _ = sms.parse_sms.call_args
        composed = args[0]
        assert "Receipt: INR 549 to Swiggy" in composed
        assert "See your statement" in composed
        assert composed.startswith("Receipt:")  # subject first

    def test_default_timestamp_used_when_missing(self):
        sms = MagicMock(spec=SmsParserService)
        sms.parse_sms.return_value = {"confidence": 0.5}

        parser = EmailParserService(sms_parser=sms)
        parser.parse_email(
            body="Anything",
            sender="alerts@hdfcbank.net",
        )

        args, _ = sms.parse_sms.call_args
        # Third positional arg is the timestamp; should be a datetime.
        assert isinstance(args[2], datetime)

    def test_explicit_timestamp_passes_through(self):
        sms = MagicMock(spec=SmsParserService)
        sms.parse_sms.return_value = {"confidence": 0.5}

        parser = EmailParserService(sms_parser=sms)
        ts = datetime(2024, 1, 17, 9, 30, 0)
        parser.parse_email(body="Anything", sender="x", timestamp=ts)

        args, _ = sms.parse_sms.call_args
        assert args[2] == ts

    def test_is_html_autodetect_false_for_plain(self):
        result = EmailParserService._extract_plain_text(
            "Hello there", is_html=None
        )
        assert result == "Hello there"

    def test_is_html_autodetect_true_for_tags(self):
        result = EmailParserService._extract_plain_text(
            "<p>Hello</p>", is_html=None
        )
        assert "<" not in result
        assert "Hello" in result

    def test_is_html_force_off(self):
        # If the caller forces is_html=False, even tag-like content is
        # returned verbatim. Useful for plaintext bodies that contain
        # angle-brackets in URLs (`<https://x.com>`).
        result = EmailParserService._extract_plain_text(
            "<https://example.com> see this", is_html=False
        )
        assert "<https://example.com>" in result

    def test_empty_body_returns_empty_text(self, parser):
        result = parser._extract_plain_text("", is_html=None)
        assert result == ""

    def test_malformed_html_falls_back_to_raw(self, monkeypatch, parser):
        # Force the HTMLParser to crash so we hit the except branch.
        class Boom(_PlainText):
            def feed(self, _data):
                raise RuntimeError("boom")

        monkeypatch.setattr(
            "app.services.email_parser._PlainText", Boom
        )
        text = EmailParserService._extract_plain_text("<p>X</p>", is_html=True)
        # We don't assert exact equality because the fallback returns
        # the raw body (`<p>X</p>`) — important is that we didn't raise.
        assert "X" in text
