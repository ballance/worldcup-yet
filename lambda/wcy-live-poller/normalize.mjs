// Pure function: takes upstream football-data.org match list + matches.json + aliases
// and returns the live.json shape.

const FIFA_STATUS_MAP = {
  IN_PLAY: 'LIVE',
  PAUSED: 'HT',
  FINISHED: 'FT',
  AWARDED: 'FT',
  EXTRA_TIME: 'ET',
  PENALTY_SHOOTOUT: 'PEN',
  SCHEDULED: 'SCHEDULED',
  TIMED: 'SCHEDULED',
  POSTPONED: 'SCHEDULED',
  SUSPENDED: 'SCHEDULED',
  CANCELLED: 'SCHEDULED',
};

function isoFromUpstream(upstreamCode, aliases) {
  if (!upstreamCode) return null;
  const upper = String(upstreamCode).toUpperCase();
  if (aliases[upper]) return aliases[upper];
  if (upper.length === 2) return upper;
  if (upper.length === 3 && aliases[upper]) return aliases[upper];
  return null;
}

function dateKey(iso) {
  return iso ? iso.slice(0, 10) : '';
}

function buildLookupTable(matchesJson) {
  const map = new Map();
  for (const m of matchesJson.matches) {
    const key = dateKey(m.kickoffUtc) + '|' + m.home.code + '|' + m.away.code;
    map.set(key, m.id);
  }
  return map;
}

function deriveLastEvent(upstreamMatch) {
  // football-data.org doesn't expose per-event detail on the free tier;
  // synthesize a placeholder last-event from the score deltas if available.
  // For v1 we just leave it null — the score itself is the news.
  return null;
}

function deriveMinute(upstreamMatch, status) {
  if (status === 'HT') return 'HT';
  if (status === 'FT') return 'FT';
  if (status === 'ET') return 'ET';
  if (status === 'PEN') return 'PEN';
  if (status === 'LIVE') {
    const m = upstreamMatch.minute;
    // Free tier of football-data.org omits the in-match minute; leave blank
    // rather than fabricate "1'" which would mislabel every match.
    return m ? (typeof m === 'number' ? m + "'" : String(m)) : '';
  }
  return '';
}

export function normalize(upstreamPayload, matchesJson, aliases, nowIso) {
  const lookup = buildLookupTable(matchesJson);
  const out = { updatedUtc: nowIso, matches: {} };
  const upstreamMatches = (upstreamPayload && upstreamPayload.matches) || [];

  for (const u of upstreamMatches) {
    const rawStatus = u.status || 'SCHEDULED';
    const status = FIFA_STATUS_MAP[rawStatus] || 'SCHEDULED';
    if (status === 'SCHEDULED') continue;

    const homeIso = isoFromUpstream(u.homeTeam && (u.homeTeam.tla || u.homeTeam.code), aliases);
    const awayIso = isoFromUpstream(u.awayTeam && (u.awayTeam.tla || u.awayTeam.code), aliases);
    if (!homeIso || !awayIso) continue;

    const k = dateKey(u.utcDate || u.kickoffUtc) + '|' + homeIso + '|' + awayIso;
    const fifaId = lookup.get(k);
    if (!fifaId) {
      // Try swapped (home/away switched between sources)
      const swapped = dateKey(u.utcDate || u.kickoffUtc) + '|' + awayIso + '|' + homeIso;
      if (!lookup.get(swapped)) continue;
    }
    const resolvedId = fifaId || lookup.get(dateKey(u.utcDate || u.kickoffUtc) + '|' + awayIso + '|' + homeIso);

    const homeScore = u.score && u.score.fullTime && typeof u.score.fullTime.home === 'number'
      ? u.score.fullTime.home
      : 0;
    const awayScore = u.score && u.score.fullTime && typeof u.score.fullTime.away === 'number'
      ? u.score.fullTime.away
      : 0;

    out.matches[String(resolvedId)] = {
      fifaId: resolvedId,
      status,
      minute: deriveMinute(u, status),
      homeScore,
      awayScore,
      lastEvent: deriveLastEvent(u),
    };
  }

  return out;
}
