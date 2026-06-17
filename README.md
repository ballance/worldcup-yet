# worldcupyet.com

> The definitive answer to the question: **Is it the World Cup?**

A single-page static site that says **YES** during the FIFA World Cup 2026 tournament window and **NO** the rest of the time.

- **Single-purpose.** One question, one answer, no clutter.
- **Privacy-first.** No cookies, no client-side analytics, no third-party scripts on the page.
- **Cheap.** Static HTML on S3 + CloudFront, plus one minute-cron Lambda for live scores. About $1/month while the tournament is on; $0 the rest of the year.
- **Polished.** Gold-on-navy celebration UI, live scores, favorite-team highlights, calendar export, embeddable countdown widget.

Production deploy: <https://worldcupyet.com>

---

## What's in the box

| Path | What it does |
|---|---|
| `index.html` | The whole site. One HTML file with embedded CSS + JS, no build step, ~120 KB. |
| `matches.json` | The full 104-match FIFA World Cup 2026 schedule. Hand-curated from Wikipedia's per-group articles. |
| `schedule.ics` | Calendar subscription file, generated from `matches.json` by `scripts/generate-ics.py`. |
| `og-image.png` | 1200×630 Open Graph image for link previews, rendered from `scripts/og-source.html`. |
| `embed/countdown.html` | Self-contained iframe widget anyone can drop on their own site. |
| `embed.html` | Copy-paste instructions page for the widget. |
| `decoys/` | Honeypot endpoints for scanner traffic (`/wp-admin/install.php`, `/wp-login.php`, `/robots.txt`, etc.). |
| `lambda/wcy-live-poller/` | Node.js 20 Lambda that polls football-data.org every minute, normalizes, writes `live.json` to S3. |
| `infra/live-poller/` | Terraform module for the Lambda + EventBridge + IAM + SSM SecureString. |
| `scripts/generate-ics.py` | Regenerates `schedule.ics` from `matches.json`. |
| `scripts/og-source.html` | The HTML composition rendered once to produce `og-image.png`. |
| `tests/` | Browser fixtures for the live-scores feature. |

What the page does for a visitor:

- "Today's matches" panel with day-by-day navigation (arrows + `?day=YYYY-MM-DD` in the URL)
- A sticky live ticker that floats to the top while a match is in progress
- "Your next match" surfaced when none of your teams are playing today
- Favorite team + 3-team watchlist, persisted in localStorage, with a picker modal and in-card popover
- Per-group standings computed from full-time scores
- Tournament-stage indicator, countdown to the next kickoff, broadcast lines (`📺 FOX · Telemundo`)
- "📅 Subscribe in calendar" via `webcal://`
- Goal-flash animation, canvas particles, screen-reader announcements
- Tab title that updates with the live score (`⚽ 2-1 Spain vs Cape Verde · Is it the World Cup?`)
- Motion that calms down after 10 seconds — the gradient slows, half the balls disappear

---

## Architecture

```
        ┌─────────────────────────────┐
        │  EventBridge schedule       │  rate(1 minute)
        └──────────────┬──────────────┘
                       │ invokes
                       ▼
        ┌─────────────────────────────┐
        │  Lambda: wcy-live-poller    │
        │   - reads SSM SecureString  │
        │   - GET football-data.org   │
        │   - normalize to live.json  │
        │   - PUT to S3               │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │  S3 bucket  <your-domain>   │
        │   index.html                │
        │   matches.json              │
        │   live.json (max-age=20)    │
        │   schedule.ics              │
        │   og-image.png              │
        │   embed/countdown.html      │
        └──────────────┬──────────────┘
                       │ CloudFront edge cache
                       ▼
        ┌─────────────────────────────┐
        │  Browser                    │
        │   loads index.html once     │
        │   polls live.json every 30s │
        │   only during live windows  │
        └─────────────────────────────┘
```

Two cron-driven layers — the Lambda writes once a minute; the browser polls every 30 seconds, but only during live windows. Nothing else moves.

---

## Deploying your own

### Prerequisites

- An AWS account with permission to create S3 buckets, CloudFront distributions, Lambda functions, EventBridge rules, IAM roles, and SSM parameters.
- A registered domain (or just use the CloudFront `*.cloudfront.net` URL).
- An ACM certificate in `us-east-1` if you want HTTPS on a custom domain.
- Terraform ≥ 1.6.
- Python 3.10+ (for `scripts/generate-ics.py`).
- Node.js 20.x (for Lambda packaging).
- An API token from [football-data.org](https://www.football-data.org/client/register). The free tier covers the World Cup but doesn't report the in-match minute; the €12/month "Free w/ Livescores" tier does.

### Step 1 — Bucket + CloudFront

The Terraform module here doesn't create your bucket or CloudFront distribution — that piece varies too much per AWS account. Set them up the way you usually would:

- An S3 bucket (e.g., `your-domain.com`) for static website hosting **or** a private bucket fronted by CloudFront with OAC/OAI.
- A CloudFront distribution serving that bucket, with your ACM cert if you want a custom domain.

Note the **distribution ID** — you'll use it for cache invalidations.

### Step 2 — Upload the static assets

```bash
# Sync everything
aws s3 cp index.html       s3://your-bucket/index.html       --content-type "text/html; charset=utf-8" --cache-control "public, max-age=300"
aws s3 cp matches.json     s3://your-bucket/matches.json     --content-type "application/json"        --cache-control "public, max-age=3600"
aws s3 cp og-image.png     s3://your-bucket/og-image.png     --content-type "image/png"               --cache-control "public, max-age=86400"
aws s3 cp embed.html       s3://your-bucket/embed.html       --content-type "text/html; charset=utf-8" --cache-control "public, max-age=300"
aws s3 cp embed/countdown.html s3://your-bucket/embed/countdown.html --content-type "text/html; charset=utf-8" --cache-control "public, max-age=300"
aws s3 cp decoys/robots.txt              s3://your-bucket/robots.txt              --content-type "text/plain; charset=utf-8" --cache-control "public, max-age=86400"
aws s3 cp decoys/sitemap.xml             s3://your-bucket/sitemap.xml             --content-type "application/xml; charset=utf-8" --cache-control "public, max-age=86400"
aws s3 cp decoys/well-known/security.txt s3://your-bucket/.well-known/security.txt --content-type "text/plain; charset=utf-8" --cache-control "public, max-age=86400"
aws s3 cp decoys/wp-admin/install.php    s3://your-bucket/wp-admin/install.php    --content-type "text/html; charset=utf-8" --cache-control "public, max-age=86400"
aws s3 cp decoys/wp-login.php            s3://your-bucket/wp-login.php            --content-type "text/html; charset=utf-8" --cache-control "public, max-age=86400"

# Generate and upload the ICS subscription file
python3 scripts/generate-ics.py
aws s3 cp schedule.ics     s3://your-bucket/schedule.ics     --content-type "text/calendar; charset=utf-8" --cache-control "public, max-age=3600"
```

Before you go live, swap the `worldcupyet.com` references in `index.html` and `embed/countdown.html` for your own domain — og-image URL, security.txt canonical, and the like.

### Step 3 — Deploy the Lambda + cron

```bash
cd lambda/wcy-live-poller && ./build.sh       # produces bundle.zip

cd ../../infra/live-poller
cp terraform.tfvars.example terraform.tfvars  # then edit with your values
terraform init
terraform plan -out tfplan
terraform apply tfplan
```

`s3_bucket` and `ssm_parameter_name` are required — no project-specific defaults. `terraform.tfvars` is gitignored.

Store your football-data.org token in SSM:

```bash
aws ssm put-parameter \
  --name /your/upstream-api-key \
  --value "<your-football-data-org-token>" \
  --type SecureString \
  --overwrite
```

Smoke-test:

```bash
aws lambda invoke --function-name your-prefix-live-poller \
  --payload '{"dryRun": true}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/wcy-dryrun.json && cat /tmp/wcy-dryrun.json | python3 -m json.tool
```

A successful dry run returns `{"updatedUtc": "...", "matches": {...}}`. The cron picks up on the next minute boundary and starts writing the real `live.json`.

### Step 4 — Tear down

```bash
cd infra/live-poller
terraform destroy
```

The S3 bucket and CloudFront distribution aren't owned by this module, so they stay behind. Empty and delete them by hand when you're done.

---

## Updating the schedule

`matches.json` is hand-curated from Wikipedia. When the knockout bracket fills in:

1. Edit `matches.json` to replace `"TBD"` codes with real team codes.
2. Run `python3 scripts/generate-ics.py` to rebuild `schedule.ics`.
3. Re-upload both to S3 and invalidate the CloudFront paths.
4. Re-zip the Lambda with `./build.sh` — it bundles its own copy of `matches.json` for the FIFA-match-id lookup table.
5. Push the new bundle with `aws lambda update-function-code --function-name ... --zip-file fileb://bundle.zip` (or `terraform apply`).

---

## Running locally

No build step:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765
```

URL parameters that make testing painless:

- `?celebrate` — forces the YES state regardless of the real date.
- `?date=2026-06-18` — overrides "today" for filtering and rendering.
- `?time=20:00:00` — overrides the time of "today" (UTC; combined with `?date=`).
- `?tz=America/New_York` — overrides the user timezone.
- `?live=tests/live-fixture.json` — points `LiveScores` at a checked-in fixture instead of production.
- `?day=2026-06-13` — navigates the day-view to a specific date.

Lambda unit tests:

```bash
cd lambda/wcy-live-poller && node --test test/
```

---

## License

MIT — see [`LICENSE`](LICENSE).

The schedule data in `matches.json` is derived from public Wikipedia sources and is freely reusable. FIFA, "World Cup", team names, and crests are trademarks of their respective owners; this is a fan site, unaffiliated with any of them.

---

## Thanks

- [football-data.org](https://www.football-data.org/) for the live-score feed.
- Wikipedia's per-group articles for the 2026 schedule data.
- Everyone who showed up and polled `live.json` for 20 minutes during a match — you're who this was built for.
