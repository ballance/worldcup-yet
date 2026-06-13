import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../normalize.mjs';

const aliases = { MEX: 'MX', RSA: 'ZA', USA: 'US', PAR: 'PY' };

const matchesJson = {
  tournament: 'Test',
  matches: [
    {
      id: 1,
      stage: 'Group A',
      kickoffUtc: '2026-06-11T19:00:00Z',
      venue: { city: 'Mexico City', stadium: 'Azteca', tz: 'America/Mexico_City' },
      home: { code: 'MX', name: 'Mexico' },
      away: { code: 'ZA', name: 'South Africa' },
    },
    {
      id: 4,
      stage: 'Group D',
      kickoffUtc: '2026-06-12T20:00:00Z',
      venue: { city: 'Inglewood', stadium: 'LA Stadium', tz: 'America/Los_Angeles' },
      home: { code: 'US', name: 'United States' },
      away: { code: 'PY', name: 'Paraguay' },
    },
  ],
};

test('drops scheduled matches', () => {
  const out = normalize(
    { matches: [{ status: 'SCHEDULED', homeTeam: { tla: 'MEX' }, awayTeam: { tla: 'RSA' }, utcDate: '2026-06-11T19:00:00Z' }] },
    matchesJson,
    aliases,
    '2026-06-11T20:00:00Z',
  );
  assert.deepEqual(out.matches, {});
});

test('maps live match with correct fifaId, score, and status', () => {
  const out = normalize(
    {
      matches: [
        {
          status: 'IN_PLAY',
          homeTeam: { tla: 'MEX' },
          awayTeam: { tla: 'RSA' },
          utcDate: '2026-06-11T19:00:00Z',
          minute: 67,
          score: { fullTime: { home: 1, away: 0 } },
        },
      ],
    },
    matchesJson,
    aliases,
    '2026-06-11T20:07:00Z',
  );
  assert.equal(out.matches['1'].fifaId, 1);
  assert.equal(out.matches['1'].status, 'LIVE');
  assert.equal(out.matches['1'].minute, "67'");
  assert.equal(out.matches['1'].homeScore, 1);
  assert.equal(out.matches['1'].awayScore, 0);
});

test('maps FT with full-time score', () => {
  const out = normalize(
    {
      matches: [
        {
          status: 'FINISHED',
          homeTeam: { tla: 'USA' },
          awayTeam: { tla: 'PAR' },
          utcDate: '2026-06-12T20:00:00Z',
          score: { fullTime: { home: 2, away: 2 } },
        },
      ],
    },
    matchesJson,
    aliases,
    '2026-06-12T22:00:00Z',
  );
  assert.equal(out.matches['4'].status, 'FT');
  assert.equal(out.matches['4'].minute, 'FT');
  assert.equal(out.matches['4'].homeScore, 2);
  assert.equal(out.matches['4'].awayScore, 2);
});

test('skips matches with no fifaId match', () => {
  const out = normalize(
    {
      matches: [
        {
          status: 'IN_PLAY',
          homeTeam: { tla: 'XYZ' },
          awayTeam: { tla: 'ABC' },
          utcDate: '2026-06-11T19:00:00Z',
          score: { fullTime: { home: 0, away: 0 } },
        },
      ],
    },
    matchesJson,
    aliases,
    '2026-06-11T20:00:00Z',
  );
  assert.deepEqual(out.matches, {});
});

test('handles swapped home/away in upstream', () => {
  const out = normalize(
    {
      matches: [
        {
          status: 'IN_PLAY',
          homeTeam: { tla: 'RSA' },
          awayTeam: { tla: 'MEX' },
          utcDate: '2026-06-11T19:00:00Z',
          minute: 30,
          score: { fullTime: { home: 0, away: 1 } },
        },
      ],
    },
    matchesJson,
    aliases,
    '2026-06-11T19:30:00Z',
  );
  assert.equal(out.matches['1'].fifaId, 1);
});

test('updatedUtc is set from the passed timestamp', () => {
  const out = normalize({ matches: [] }, matchesJson, aliases, '2026-06-15T12:00:00Z');
  assert.equal(out.updatedUtc, '2026-06-15T12:00:00Z');
});

test('live match without upstream minute → blank minute (no fabricated "1\'")', () => {
  const out = normalize(
    {
      matches: [
        {
          status: 'IN_PLAY',
          homeTeam: { tla: 'MEX' },
          awayTeam: { tla: 'RSA' },
          utcDate: '2026-06-11T19:00:00Z',
          // minute intentionally omitted (free tier)
          score: { fullTime: { home: 0, away: 0 } },
        },
      ],
    },
    matchesJson,
    aliases,
    '2026-06-11T19:30:00Z',
  );
  assert.equal(out.matches['1'].status, 'LIVE');
  assert.equal(out.matches['1'].minute, '');
});
