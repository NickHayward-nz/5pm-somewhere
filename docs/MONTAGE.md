# Premium montages (weekly / monthly)

## Architecture

1. **Supabase Edge Function** `montage-cron` — validates `CRON_SECRET`, forwards `POST` to your **montage worker URL** with `MONTAGE_WORKER_SECRET`.
2. **Montage worker** (`workers/montage-worker.mjs`) — runs **outside Vercel** (Railway, Fly.io, Render, a VPS, etc.). It uses the service role to read `profiles` / `moments`, trims clips (FFmpeg), mixes music from Storage, uploads MP4 to the `montages` bucket, creates a **Mux** asset from a signed URL, and writes **`user_montages`**. The same worker can also generate iOS/Safari-friendly moment playback renditions with `POST {"type":"playback-renditions"}`.
3. **Premium Profile UI** reads the signed-in user's latest `user_montages` row and plays the ready Mux HLS URL in-app.

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

1. **Service** connected to `NickHayward-nz/5pm-somewhere`, branch `main`. Root `.npmrc` sets `legacy-peer-deps=true` so Railpack’s `npm ci` succeeds; `railway.json` skips a second install/build step and starts `node workers/montage-worker.mjs`.
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

- **Weekly:** Monday 09:00 UTC — `POST` body `{"type":"weekly"}` (completed Monday-Sunday UTC period).
- **Monthly:** 1st 09:00 UTC — `{"type":"monthly"}` (previous calendar month, top 5 moments by views + reactions).

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
  -H "Authorization: Bearer <MONTA...ET>" \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly"}'
```

## iOS/Safari playback renditions

The worker can generate optional MP4/H.264/AAC playback copies for recent moments. This is separate from uploads and montages: originals remain untouched, and live playback falls back to the original video whenever no ready rendition exists.

Direct worker, small safe batch:

```bash
curl -X POST "https://<your-worker-host>/" \
  -H "Authorization: Bearer <MONTA...ET>" \
  -H "Content-Type: application/json" \
  -d '{"type":"playback-renditions","limit":5}'
```

Target one moment:

```bash
curl -X POST "https://<your-worker-host>/" \
  -H "Authorization: Bearer <MONTA...ET>" \
  -H "Content-Type: application/json" \
  -d '{"type":"playback-renditions","momentId":"<moment-id>","limit":1}'
```

The worker:

- selects moments with `playback_status` of `none` or `failed` unless a `momentId` is provided;
- marks each row `pending` before transcoding;
- uploads MP4 output under `moments/playback/<original-path>.mp4`;
- updates `playback_storage_path`, `playback_content_type`, `playback_status`, and `playback_generated_at` when ready;
- marks individual failures as `failed` with `playback_error` without breaking original playback.

## Sharing the MP4 from the app (Storage CORS)

The profile UI can fetch the signed MP4 URL in the browser to pass a `File` into the native share sheet (better for Instagram-style targets). That **GET** is cross-origin (your site → `*.supabase.co` storage). If the **`montages`** bucket does not allow your production web origin in **Storage CORS**, the fetch will fail and the app will fall back to sharing or copying the **signed MP4 URL** instead (still an MP4 link, not the Mux HLS URL).

In Supabase Dashboard: **Storage → Configuration (or bucket settings) → CORS** — add your site origin(s), e.g. `https://5pmsomewhere.live` and local dev if needed.

## Notes

- The worker can run for several minutes (FFmpeg + Mux polling); use a host that allows long requests or run batch sizes accordingly.
- If a montage fails, the row is set to `status = failed` with `error_message`.
- Premium users can open **Profile -> Watch my Weekly Montage / Monthly Highlights** to see the latest ready, processing, failed, or empty state.
- Dominant reaction type picks the `music/{pretty|funny|cheers}/` folder; rotation is fair via `montage_music_rotation`.
