#!/usr/bin/env python3
"""Generate schema.org JSON-LD for the World Cup schedule and inline into index.html.

Emits one SportsEvent per match plus a tournament super-event and a WebSite entry.
Replaces the content between the BEGIN/END STRUCTURED-DATA markers in index.html;
inserts a fresh block before </head> on first run.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from pathlib import Path

SITE = "https://worldcupyet.com"
MATCH_DURATION_MIN = 110

TZ_TO_COUNTRY = {
    "America/Mexico_City": "MX",
    "America/Toronto": "CA",
    "America/Vancouver": "CA",
    "America/New_York": "US",
    "America/Chicago": "US",
    "America/Los_Angeles": "US",
}

START_MARKER = "<!-- BEGIN STRUCTURED-DATA -->"
END_MARKER = "<!-- END STRUCTURED-DATA -->"


def add_min(iso_utc: str, minutes: int) -> str:
    dt = datetime.fromisoformat(iso_utc.replace("Z", "+00:00"))
    return (dt + timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_graph(data: dict) -> dict:
    tournament_id = f"{SITE}/#fifa-world-cup-2026"
    fifa_id = f"{SITE}/#fifa"
    image_url = f"{SITE}/og-image.png"
    graph: list[dict] = [
        {
            "@type": "WebSite",
            "@id": f"{SITE}/#website",
            "name": "worldcupyet.com",
            "url": SITE,
            "description": (
                "Single-page site that answers Is it the World Cup? — YES during the "
                "FIFA World Cup 2026, NO the rest of the time. Live scores, full "
                "schedule, embeddable countdown widget."
            ),
        },
        {
            "@type": "Organization",
            "@id": fifa_id,
            "name": "FIFA",
            "url": "https://www.fifa.com/",
        },
        {
            "@type": "SportsEvent",
            "@id": tournament_id,
            "name": "FIFA World Cup 2026",
            "alternateName": "World Cup 2026",
            "description": (
                "The 23rd FIFA World Cup, hosted by Canada, Mexico, and the United States."
            ),
            "startDate": "2026-06-11",
            "endDate": "2026-07-19",
            "url": SITE,
            "image": image_url,
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "sport": "Soccer",
            "organizer": {"@id": fifa_id},
            "location": [
                {"@type": "Country", "name": "Canada"},
                {"@type": "Country", "name": "Mexico"},
                {"@type": "Country", "name": "United States"},
            ],
        },
    ]

    for m in data["matches"]:
        tz = m["venue"]["tz"]
        if tz not in TZ_TO_COUNTRY:
            raise SystemExit(f"unmapped tz: {tz!r} (add to TZ_TO_COUNTRY)")
        day = m["kickoffUtc"][:10]
        home_team = {"@type": "SportsTeam", "name": m["home"]["name"]}
        away_team = {"@type": "SportsTeam", "name": m["away"]["name"]}
        graph.append(
            {
                "@type": "SportsEvent",
                "@id": f"{SITE}/?day={day}#match-{m['id']}",
                "name": f"{m['home']['name']} vs {m['away']['name']}",
                "description": f"FIFA World Cup 2026 · {m['stage']}",
                "startDate": m["kickoffUtc"],
                "endDate": add_min(m["kickoffUtc"], MATCH_DURATION_MIN),
                "url": f"{SITE}/?day={day}",
                "image": image_url,
                "eventStatus": "https://schema.org/EventScheduled",
                "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                "sport": "Soccer",
                "organizer": {"@id": fifa_id},
                "location": {
                    "@type": "Place",
                    "name": m["venue"]["stadium"],
                    "address": {
                        "@type": "PostalAddress",
                        "addressLocality": m["venue"]["city"],
                        "addressCountry": TZ_TO_COUNTRY[tz],
                    },
                },
                "homeTeam": home_team,
                "awayTeam": away_team,
                "performer": [home_team, away_team],
                "superEvent": {"@id": tournament_id},
            }
        )

    return {"@context": "https://schema.org", "@graph": graph}


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    data = json.loads((root / "matches.json").read_text())
    payload = build_graph(data)
    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))

    block = (
        f'{START_MARKER}\n'
        f'  <script type="application/ld+json">{compact}</script>\n'
        f'  {END_MARKER}'
    )

    index = root / "index.html"
    html = index.read_text()
    pattern = re.compile(
        re.escape(START_MARKER) + r"[\s\S]*?" + re.escape(END_MARKER)
    )
    if pattern.search(html):
        new_html = pattern.sub(block, html)
    else:
        new_html = html.replace("</head>", f"  {block}\n</head>", 1)

    index.write_text(new_html)
    print(
        f"wrote {index} (graph: {len(payload['@graph'])} entries, {len(compact)} bytes)"
    )


if __name__ == "__main__":
    main()
