# Vercel deployments

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
