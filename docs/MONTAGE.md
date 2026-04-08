# Premium montages (weekly / monthly)

## Architecture

1. **Supabase Edge Function** `montage-cron` — validates `CRON_SECRET`, forwards `POST` to your **montage worker URL** with `MONTAGE_WORKER_SECRET`.
2. **Montage worker** (`workers/montage-worker.mjs`) — runs **outside Vercel** (Railway, Fly.io, Render, a VPS, etc.). It uses the service role to read `profiles` / `moments`, trims clips (FFmpeg), mixes music from Storage, uploads MP4 to the `montages` bucket, creates a **Mux** asset from a signed URL, and writes **`user_montages`**.

The Vite app deploys to Vercel on **Hobby** without bundling FFmpeg; the worker is a separate Node process with `npm run montage-worker` (or your host’s start command).

## Database

Apply migration `supabase/migrations/20260327100000_user_montages_and_music.sql` (Table Editor or `supabase db push`).

## Storage: music uploads

1. Create/use bucket **`music`** (private is fine).
2. Upload Suno tracks under:
   - `pretty/`
   - `funny/`
   - `cheers/`
3. Supported: common audio formats (e.g. `.mp3`, `.m4a`).

## Montage worker environment variables

Set on the **host where the worker runs** (not in the browser):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never expose to client |
| `MONTAGE_WORKER_SECRET` | Long random string; shared with Edge Function |
| `MUX_TOKEN_ID` | Mux dashboard |
| `MUX_TOKEN_SECRET` | Mux dashboard |
| `MONTAGE_MAX_USERS` | Optional; default 25 users per run |
| `PORT` | Optional; HTTP listen port (default `8787`) |

Local: copy env into `.env` and run `npm run montage-worker`.

### Railway

1. **Service** connected to `NickHayward-nz/5pm-somewhere`, branch `main`. Root `railway.json` installs deps with `npm ci --legacy-peer-deps` and starts `node workers/montage-worker.mjs` (overrides dashboard start/build if both are set).
2. **Variables** (service): `SUPABASE_URL` (project URL, e.g. `https://xxxx.supabase.co` — same value as `VITE_SUPABASE_URL`, but the name must be **`SUPABASE_URL`** for Node), `SUPABASE_SERVICE_ROLE_KEY`, `MONTAGE_WORKER_SECRET`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`. Optional: `MONTAGE_MAX_USERS`.
3. **Networking → Generate Domain** so the service has a public `https://….up.railway.app` URL.
4. **Supabase → Edge Function `montage-cron` secrets:** set `VERCEL_MONTAGE_WORKER_URL` to that **public URL** (no path; trailing slash optional). Keep `MONTAGE_WORKER_SECRET` **identical** to Railway’s value.
5. Redeploy Railway after env changes; test with `curl` (see below).

## Supabase Edge Function secrets

Deploy: `supabase functions deploy montage-cron`

Secrets (Dashboard → Edge Functions → `montage-cron`):

| Secret | Description |
|--------|-------------|
| `CRON_SECRET` | Bearer token callers must send to invoke the function |
| `VERCEL_MONTAGE_WORKER_URL` | **Public URL of the montage worker** (name is historical; not Vercel-specific). Example: `https://your-worker.up.railway.app` — no path required; `POST` root with JSON body. |
| `MONTAGE_WORKER_SECRET` | **Must match** the worker’s `MONTAGE_WORKER_SECRET` |

## Schedules (example)

- **Weekly:** Sunday 09:00 UTC — `POST` body `{"type":"weekly"}` (previous 7 days ending “now” when the job runs).
- **Monthly:** 1st 09:00 UTC — `{"type":"monthly"}` (previous 30 days, top 6 moments by total reactions).

Use **pg_cron** + `pg_net` to `POST` the Edge Function URL, or an external cron (GitHub Actions, etc.) with `Authorization: Bearer <CRON_SECRET>`.

## Manual test

```bash
curl -X POST "https://<PROJECT>.supabase.co/functions/v1/montage-cron" \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly"}'
```

Direct worker (bypasses Edge):

```bash
curl -X POST "https://<your-worker-host>/" \
  -H "Authorization: Bearer <MONTAGE_WORKER_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly"}'
```

## Notes

- The worker can run for several minutes (FFmpeg + Mux polling); use a host that allows long requests or run batch sizes accordingly.
- If a montage fails, the row is set to `status = failed` with `error_message`.
- Dominant reaction type picks the `music/{pretty|funny|cheers}/` folder; rotation is fair via `montage_music_rotation`.
