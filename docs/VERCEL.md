# Vercel deployments

The **Vite frontend** deploys here. The **montage worker** (`workers/montage-worker.mjs`, FFmpeg) is **not** deployed to Vercel — it runs elsewhere so **Hobby** limits (serverless memory/duration) do not block production builds.

## Production domain

The canonical app domain is `https://5pmsomewhere.live`.

To make it live, add `5pmsomewhere.live` in **Vercel → Project → Settings → Domains**, then point the domain's DNS records at Vercel using the values Vercel provides. After the DNS check passes, update Supabase Auth redirect URLs and Edge Function secrets that reference the public app URL:

```bash
supabase secrets set SITE_URL=https://5pmsomewhere.live
```

## Push did not trigger a new deploy

Check in order:

1. **Vercel → Project → Settings → Git**  
   - Correct GitHub repo and **Production Branch** = `main` (or whatever you use).

2. **GitHub → Repo → Settings → Webhooks**  
   - Look for `vercel.com` / Vercel entries; recent deliveries should show `200`. If missing, reconnect Git in Vercel (Disconnect → Connect).

3. **Ignored Build Step** (Vercel → Settings → Git)  
   - If a custom command always exits `0` to “skip”, builds never run. Remove or fix it.

4. **Manual deploy**  
   - Vercel → Deployments → **Redeploy** on the latest commit, or import the repo again.

## Backup: Deploy Hook + GitHub Actions

If Git webhooks are unreliable, use the workflow `.github/workflows/trigger-vercel-deploy.yml`:

1. Vercel → **Settings → Git → Deploy Hooks** → Create hook for branch `main`.  
2. GitHub → **Settings → Secrets and variables → Actions** → add `VERCEL_DEPLOY_HOOK_URL` with that URL.

Every push to `main` will POST the hook and queue a production build.
