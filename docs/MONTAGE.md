# Premium montages (weekly / monthly)

## Architecture

1. **Supabase Edge Function** `montage-cron` — validates `CRON_SECRET`, forwards `POST` to your Vercel URL with `MONTAGE_WORKER_SECRET`.
2. **Vercel** `api/montage-worker.mjs` — service role reads `profiles` / `moments`, trims clips (FFmpeg), mixes music from Storage, uploads MP4 to `montages` bucket, creates a **Mux** asset from a signed URL, writes **`user_montages`**.

## Database

Apply migration `supabase/migrations/20260327100000_user_montages_and_music.sql` (Table Editor or `supabase db push`).

## Storage: music uploads

1. Create/use bucket **`music`** (private is fine).
2. Upload Suno tracks under:
   - `pretty/`
   - `funny/`
   - `cheers/`
3. Supported: common audio formats (e.g. `.mp3`, `.m4a`).

## Vercel environment variables

Set in the Vercel project (Settings → Environment Variables):

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never expose to client |
| `MONTAGE_WORKER_SECRET` | Long random string; shared with Edge Function |
| `MUX_TOKEN_ID` | Mux dashboard |
| `MUX_TOKEN_SECRET` | Mux dashboard |
| `MONTAGE_MAX_USERS` | Optional; default 25 users per run |

## Supabase Edge Function secrets

Deploy: `supabase functions deploy montage-cron`

Secrets (Dashboard → Edge Functions → `montage-cron`):

| Secret | Description |
|--------|-------------|
| `CRON_SECRET` | Bearer token callers must send to invoke the function |
| `VERCEL_MONTAGE_WORKER_URL` | `https://<your-app>.vercel.app/api/montage-worker` |
| `MONTAGE_WORKER_SECRET` | **Must match** Vercel `MONTAGE_WORKER_SECRET` |

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
curl -X POST "https://<app>.vercel.app/api/montage-worker" \
  -H "Authorization: Bearer <MONTAGE_WORKER_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"type":"weekly"}'
```

## Notes

- **Vercel Pro** (or similar) is recommended: function `maxDuration` is 300s and FFmpeg is CPU-heavy.
- If a montage fails, the row is set to `status = failed` with `error_message`.
- Dominant reaction type picks the `music/{pretty|funny|cheers}/` folder; rotation is fair via `montage_music_rotation`.
