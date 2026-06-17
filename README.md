# worldcupyet.com

> The definitive answer to the question: **Is it the World Cup?**

A single-page static site that says **YES** during the FIFA World Cup 2026 tournament window and **NO** the rest of the time. Built to be:

- **Single-purpose** — one question, one answer, no clutter.
- **Privacy-first** — no cookies, no client-side tracking, no third-party scripts on the page.
- **Cheap to run** — pure static HTML on S3 + CloudFront, plus one minute-cron Lambda for live scores. Hosting runs ~$1/month during the tournament; $0 otherwise.
- **Pleasant to use** — gold-on-navy celebration UI, live scores, favorite-team highlighting, calendar export, embeddable widget.

Production deploy: <https://worldcupyet.com>

---

## What's in the box

| Layer | What it does |
|---|---|
| `index.html` | The whole site. A single HTML file with embedded CSS and JS. No build step. ~120 KB. |
| `matches.json` | The full FIFA World Cup 2026 schedule (104 matches). Sourced from Wikipedia's per-group articles. |
| `schedule.ics` | Calendar subscription file generated from `matches.json` by `scripts/generate-ics.py`. |
| `og-image.png` | 1200×630 Open Graph image used in link previews. Generated from `scripts/og-source.html`. |
| `embed/countdown.html` | Self-contained iframe widget anyone can drop on their own site. |
| `embed.html` | Instructions / copy-paste page for the widget. |
| `decoys/` | Honeypot endpoints for scanner traffic (`/wp-admin/install.php`, `/wp-login.php`, `/robots.txt`, etc.). |
| `lambda/wcy-live-poller/` | Node.js 20 Lambda that polls football-data.org every minute, normalizes, writes `live.json` to S3. |
| `infra/live-poller/` | Terraform module for the Lambda + EventBridge + IAM + SSM SecureString. |
| `scripts/generate-ics.py` | Regenerates `schedule.ics` from `matches.json`. |
| `scripts/og-source.html` | The HTML composition rendered once to produce `og-image.png`. |
| `docs/` | Design specs, implementation plans, Athena query cheatsheet. |
| `tests/` | Browser fixtures for the live-scores feature. |

The browser feature stack:

- "Today's matches" panel with day navigation (arrows + URL state in `?day=YYYY-MM-DD`)
- Live ticker layout when a match is live (sticky to top while scrolling)
- "Your next match" surfaced when none of your teams play today
- Favorite team + 3-team watchlist with localStorage persistence, picker modal, in-card popover
- Group standings table per group (computed from FT scores)
- Tournament-stage indicator, countdown to next kickoff, broadcast lines (`📺 FOX · Telemundo`)
- "📅 Subscribe in calendar" via `webcal://`
- Goal-flash animation + canvas particles + screen-reader announcements
- Tab title updates with live score (`⚽ 2-1 Spain vs Cape Verde · Is it the World Cup?`)
- Calm motion after 10s (gradient slows, balls halve)

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

The whole runtime is two cron-driven layers — the Lambda writes once a minute, the browser polls once every 30 seconds during live windows. Nothing else moves.

---

## Deploying your own

### Prerequisites

- AWS account with permission to create S3 buckets, CloudFront distributions, Lambda functions, EventBridge rules, IAM roles, and SSM parameters.
- A registered domain (or a CloudFront-default `*.cloudfront.net` URL — works fine).
- An ACM certificate in `us-east-1` if you want HTTPS on your custom domain.
- Terraform >= 1.6.
- Python 3.10+ (for `scripts/generate-ics.py`).
- Node.js 20.x (for Lambda packaging).
- An API token from [football-data.org](https://www.football-data.org/client/register) — the free tier covers the World Cup but delivers no in-match minute; the €12/month "Free w/ Livescores" tier gives real-time scores.

### Step 1 — Bucket + CloudFront

Out of scope for this Terraform module. Create:

- An S3 bucket (e.g., `your-domain.com`) configured for static website hosting **or** as a private bucket with CloudFront OAC/OAI.
- A CloudFront distribution serving that bucket, with your ACM cert if using a custom domain.

Make a note of the **distribution ID**. You'll use it for cache invalidations.

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

Before going live, update `index.html` and `embed/countdown.html` to point at **your** domain (replace `worldcupyet.com` references in the og-image URL, security.txt canonical, etc.).

### Step 3 — Deploy the Lambda + cron

```bash
cd lambda/wcy-live-poller && ./build.sh       # produces bundle.zip

cd ../../infra/live-poller
cp terraform.tfvars.example terraform.tfvars  # then edit with your values
terraform init
terraform plan -out tfplan
terraform apply tfplan
```

`s3_bucket` and `ssm_parameter_name` are required — there are no project-specific defaults. `terraform.tfvars` is gitignored.

Then put the football-data.org token into SSM:

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

A successful dry run returns `{"updatedUtc": "...", "matches": {...}}`. The cron will start writing the real `live.json` on its next minute boundary.

### Step 4 — Optional: access logs and analytics

CloudFront standard logs to S3 + Athena is a zero-client-side-code way to count visitors. See `docs/access-log-queries.md` for the setup and a SQL cheatsheet.

### Step 5 — Tear down

```bash
cd infra/live-poller
terraform destroy
```

The S3 bucket and CloudFront distribution stay (they weren't created by this Terraform module). Empty + delete them by hand if you're done.

---

## Updating the schedule

`matches.json` is hand-curated from Wikipedia's per-group articles. When the knockout bracket fills in:

1. Edit `matches.json` to replace `"TBD"` codes with real team codes.
2. Run `python3 scripts/generate-ics.py` to rebuild `schedule.ics`.
3. Re-upload both to S3 and invalidate the CloudFront paths.
4. Re-zip the Lambda (`./build.sh`) — it bundles its own copy of `matches.json` for the FIFA-match-id lookup table.
5. Update the Lambda code via `aws lambda update-function-code --function-name ... --zip-file fileb://bundle.zip` or `terraform apply`.

---

## Local development

There's no build step. To work on `index.html`:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765
```

Useful URL parameters for testing:

- `?celebrate` — forces the YES state regardless of the real date.
- `?date=2026-06-18` — overrides "today" for filtering and rendering.
- `?time=20:00:00` — overrides the time of "today" (UTC; combined with `?date=`).
- `?tz=America/New_York` — overrides the user timezone.
- `?live=tests/live-fixture.json` — points `LiveScores` at a checked-in fixture instead of production.
- `?day=2026-06-13` — navigates the day-view to a specific date.

The Lambda has Node.js test coverage:

```bash
cd lambda/wcy-live-poller && node --test test/
```

---

## Design and implementation history

Everything was built using an iterative design → plan → execute loop. The artifacts live under `docs/superpowers/`:

- `docs/superpowers/specs/` — design docs per feature
- `docs/superpowers/plans/` — task-by-task implementation plans

Three major features in chronological order:

1. **Daily matches panel** — `2026-06-11`
2. **Favorite team + watchlist** — `2026-06-12`
3. **Live scores via Lambda + S3** — `2026-06-13`

If you want to understand a particular feature deeply, start with its spec, then read the corresponding plan.

---

## License

MIT — see [`LICENSE`](LICENSE).

The schedule data in `matches.json` is derived from public Wikipedia sources and is freely usable. FIFA, "World Cup," team names, and crests are trademarks of their respective owners; this site is fan-made and unaffiliated.

---

## Acknowledgments

- [football-data.org](https://www.football-data.org/) — live score upstream.
- Wikipedia's per-group articles for the 2026 World Cup schedule.
- The folks who showed up and polled `live.json` for 20 minutes during a match — you're the audience this was built for.
