import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalize } from './normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MATCHES_JSON = JSON.parse(readFileSync(join(__dirname, 'matches.json'), 'utf8'));
const ALIASES = JSON.parse(readFileSync(join(__dirname, 'aliases.json'), 'utf8'));

const BUCKET = process.env.BUCKET;
const KEY = 'live.json';
const SSM_KEY = process.env.SSM_KEY;
const UPSTREAM_URL = process.env.UPSTREAM_URL ||
  'https://api.football-data.org/v4/competitions/WC/matches?status=LIVE,IN_PLAY,PAUSED,FINISHED';

if (!BUCKET) throw new Error('BUCKET env var required');
if (!SSM_KEY) throw new Error('SSM_KEY env var required');

const ssm = new SSMClient({});
const s3 = new S3Client({});

let cachedKey = null;

async function loadApiKey() {
  if (cachedKey) return cachedKey;
  const res = await ssm.send(new GetParameterCommand({ Name: SSM_KEY, WithDecryption: true }));
  cachedKey = res.Parameter && res.Parameter.Value;
  if (!cachedKey) throw new Error('SSM parameter ' + SSM_KEY + ' empty');
  return cachedKey;
}

async function fetchUpstream() {
  const key = await loadApiKey();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(UPSTREAM_URL, {
      headers: { 'X-Auth-Token': key, 'User-Agent': 'wcy-live-poller/1.0' },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '<unreadable>');
      throw new Error('upstream HTTP ' + res.status + ' body=' + body.slice(0, 200) + ' url=' + UPSTREAM_URL);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function readExisting() {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    const body = await res.Body.transformToString();
    return JSON.parse(body);
  } catch (e) {
    return { updatedUtc: null, matches: {} };
  }
}

async function writeLive(payload) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: JSON.stringify(payload),
    ContentType: 'application/json',
    CacheControl: 'public, max-age=20',
  }));
}

export const handler = async (event = {}) => {
  const nowIso = new Date().toISOString();
  let upstream;
  try {
    upstream = await fetchUpstream();
  } catch (err) {
    console.error('upstream fetch failed:', err.message || err);
    if (event.dryRun) return { error: 'upstream', message: String(err.message || err) };
    const existing = await readExisting();
    existing.updatedUtc = nowIso;
    await writeLive(existing);
    return { status: 'kept-stale', updatedUtc: nowIso };
  }

  const normalized = normalize(upstream, MATCHES_JSON, ALIASES, nowIso);

  if (event.dryRun) {
    return normalized;
  }

  await writeLive(normalized);
  return { status: 'ok', updatedUtc: nowIso, matchCount: Object.keys(normalized.matches).length };
};
