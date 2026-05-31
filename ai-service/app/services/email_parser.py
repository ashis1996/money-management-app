"""
Email Parser Service

A thin layer over the existing SMS parser that's tuned for the noisier
shape of bank/merchant emails. Banks send the same transaction multiple
ways (statement, alert, OTP confirmation), and the body is wrapped in
HTML, signatures, and disclaimer footers. Re-running the SMS regexes
against the raw HTML works poorly — the regex anchors on bank-SMS
phrasing ("Rs.XXX debited from a/c ****1234"), and HTML noise
(`<br/>`, encoded `&nbsp;`) breaks the anchors.

Strategy:
  1. Strip HTML to plain text (very simple — preserves spaces and
     line-breaks, drops tags). We use stdlib only so the service has
     no new dependency.
  2. Concatenate the subject line in front of the body. Subjects often
     carry the merchant ("Receipt from Swiggy") or the amount ("INR
     549"); the SMS parser picks them up incidentally because they
     resemble SMS prose.
  3. Forward to SmsParserService.parse_sms with the email-derived
     timestamp.

The real, future-tense email parser will:
  - parse a richer ICA-style envelope with sender domain validation,
  - recognise marketing emails and skip them outright,
  - extract structured tables from statement HTML.

For now this is enough to give the backend a working endpoint shape
that mobile/web can post pasted emails to, so we can collect ground-truth
data before training a more capable model.
"""

from __future__ import annotations

from datetime import datetime
from html.parser import HTMLParser
from typing import Any, Dict, Optional

from app.services.sms_parser import SmsParserService


class _PlainText(HTMLParser):
    """Strip HTML tags while preserving rough text shape and whitespace."""

    BLOCK_TAGS = {
        "p",
        "div",
        "br",
        "li",
        "tr",
        "td",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._chunks: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: Any) -> None:
        if tag in {"script", "style"}:
            self._skip_depth += 1
            return
        if tag in self.BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if tag in self.BLOCK_TAGS:
            self._chunks.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth > 0:
            return
        self._chunks.append(data)

    def get_text(self) -> str:
        text = "".join(self._chunks)
        # Collapse stretches of whitespace, but keep newlines so the
        # SMS parser can still see message-shaped lines.
        lines = [" ".join(line.split()) for line in text.splitlines()]
        return "\n".join(line for line in lines if line)


class EmailParserService:
    """Best-effort transaction extraction from bank/merchant emails."""

    def __init__(self, sms_parser: Optional[SmsParserService] = None) -> None:
        self.sms_parser = sms_parser or SmsParserService()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def parse_email(
        self,
        body: str,
        sender: str,
        subject: Optional[str] = None,
        timestamp: Optional[datetime] = None,
        is_html: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        Parse an email body and return the same shape as `sms_parser.parse_sms`.

        Args:
            body: Raw email body. May be HTML or plain text.
            sender: From address (or display name) — passed through to the
                SMS parser, which uses sender hints to score confidence.
            subject: Optional subject line. Prepended to the body to give
                the parser a stronger amount/merchant signal.
            timestamp: When the email arrived. Defaults to now.
            is_html: Force HTML stripping on/off. When None, autodetect.

        Returns:
            Dict in the SMS parser's response shape, with `is_email`
            set to True so downstream consumers can distinguish.
        """
        ts = timestamp or datetime.utcnow()
        plain = self._extract_plain_text(body, is_html=is_html)
        composed = self._compose(plain, subject)

        parsed = self.sms_parser.parse_sms(composed, sender, ts)

        # Mark the source so the backend can carry it through to
        # `Transaction.source = 'EMAIL'` without reparsing.
        parsed["is_email"] = True
        parsed["source_kind"] = "EMAIL"
        return parsed

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    @staticmethod
    def _extract_plain_text(body: str, *, is_html: Optional[bool]) -> str:
        """Strip HTML if present. Heuristic detection unless the caller forced one."""
        if not body:
            return ""

        if is_html is None:
            # Cheap but sufficient: look for anything that resembles a
            # tag. Bank emails almost always include `<br/>` or `<table>`;
            # plain-text bodies don't.
            is_html = "<" in body and ">" in body and (
                "</" in body or "<br" in body.lower() or "<table" in body.lower()
            )

        if not is_html:
            return body.strip()

        parser = _PlainText()
        try:
            parser.feed(body)
            parser.close()
        except Exception:
            # If the HTML is malformed enough to crash the parser we
            # fall back to the raw input — the SMS parser will get a
            # noisier but still usable string.
            return body
        return parser.get_text()

    @staticmethod
    def _compose(plain_body: str, subject: Optional[str]) -> str:
        """Combine subject + body so the SMS parser sees both."""
        parts: list[str] = []
        if subject:
            s = subject.strip()
            if s:
                parts.append(s)
        if plain_body:
            parts.append(plain_body)
        return "\n".join(parts)
