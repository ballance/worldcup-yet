#!/usr/bin/env python3
"""Generate schedule.ics from matches.json (RFC 5545)."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


def fmt_dt(iso_utc: str) -> str:
    dt = datetime.fromisoformat(iso_utc.replace("Z", "+00:00"))
    return dt.strftime("%Y%m%dT%H%M%SZ")


def add_2h(iso_utc: str) -> str:
    dt = datetime.fromisoformat(iso_utc.replace("Z", "+00:00"))
    return (dt + timedelta(hours=2)).strftime("%Y%m%dT%H%M%SZ")


def escape_ics(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(",", "\\,")
        .replace(";", "\\;")
        .replace("\n", "\\n")
    )


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    data = json.loads((root / "matches.json").read_text())

    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//worldcupyet.com//Schedule//EN",
        "X-WR-CALNAME:FIFA World Cup 2026",
        "X-WR-CALDESC:Full schedule of FIFA World Cup 2026 matches",
        "X-WR-TIMEZONE:UTC",
        "METHOD:PUBLISH",
        "CALSCALE:GREGORIAN",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ]

    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    for m in data["matches"]:
        home = escape_ics(m["home"]["name"])
        away = escape_ics(m["away"]["name"])
        venue = escape_ics(f"{m['venue']['stadium']}, {m['venue']['city']}")
        desc = escape_ics(
            f"FIFA World Cup 2026 · {m['stage']} · Match #{m['id']}"
        )
        lines += [
            "BEGIN:VEVENT",
            f"UID:wcy-{m['id']}@worldcupyet.com",
            f"DTSTAMP:{now_stamp}",
            f"DTSTART:{fmt_dt(m['kickoffUtc'])}",
            f"DTEND:{add_2h(m['kickoffUtc'])}",
            f"SUMMARY:⚽ {home} vs {away}",
            f"LOCATION:{venue}",
            f"DESCRIPTION:{desc}",
            f"URL:https://worldcupyet.com/?day={m['kickoffUtc'][:10]}",
            "END:VEVENT",
        ]

    lines.append("END:VCALENDAR")

    # RFC 5545 requires CRLF line endings and lines folded at 75 octets.
    # Match titles are short enough that folding isn't needed here.
    output = "\r\n".join(lines) + "\r\n"
    out = root / "schedule.ics"
    out.write_text(output)
    print(f"wrote {out} ({len(lines)} lines, {len(output)} bytes)")


if __name__ == "__main__":
    main()
