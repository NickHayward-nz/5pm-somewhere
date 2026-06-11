# Launch Readiness Checklist

Use this checklist before inviting people beyond a small trusted beta.

## 1. Real-device capture QA

Test at local 5PM on the actual devices people will use.

Minimum pass criteria:

- [ ] Sign-in works on mobile browser.
- [ ] Sign-in works in installed PWA/home-screen app.
- [ ] Camera and microphone permission prompts appear clearly.
- [ ] Recording starts reliably.
- [ ] Preview video is sharp enough and motion is not distractingly jittery.
- [ ] Audio is understandable and not obviously glitchy.
- [ ] Upload succeeds.
- [ ] Uploaded moment appears in the live stream.
- [ ] Logged-out visitors can play the live-stream moment.
- [ ] Installed PWA updates to the latest deployed bundle after close/reopen.
- [ ] Share action works or gives a clear fallback.

## 2. First-session understanding

A cold visitor should understand within 10 seconds:

- [ ] This is a daily global 5PM video ritual.
- [ ] They can watch 5PM moments around the world.
- [ ] They can post one short video when it is 5PM where they are.
- [ ] Returning tomorrow matters.

## 3. Retention loop

After a successful upload:

- [ ] User sees a clear “Your 5PM moment is live” success state.
- [ ] User can watch their moment in the live stream.
- [ ] User can enable tomorrow’s reminder from the success state.
- [ ] User can share the moment.
- [ ] Analytics records upload success and reminder/share outcomes without sending private media or email.

## 4. Public UGC safety

Before wider public launch:

- [ ] Live-stream moments have a visible Report action.
- [ ] Report submissions land in `public.moment_reports`.
- [ ] Reports are RLS-protected from public reads.
- [ ] Admin/service-role review path is known.
- [ ] Owner delete/removal path for bad moments is available through My Moments/admin workflow.
- [ ] Terms/community guidance clearly permits takedowns.

## 5. Privacy/security

- [ ] `moments` storage bucket remains private.
- [ ] Live playback uses signed/blob URLs only.
- [ ] No raw `/storage/v1/object/public/moments/...` video path is rendered in production.
- [ ] Public live stream uses narrow `public_live_moments`, not broad `moments` table reads.
- [ ] Public clients cannot list raw storage objects.
- [ ] Sentry/Plausible/PostHog browser config contains only intended public keys.
- [ ] Sentry allowed domains/rate limits are configured in dashboard when available.

## 6. Payments/Premium

Before advertising paid Premium broadly:

- [ ] Stripe live account has no activation/payout/compliance blockers.
- [ ] Live Checkout works with the production price.
- [ ] Stripe webhook deliveries show no pending errors.
- [ ] A controlled live subscription sets `profiles.is_premium = true`.
- [ ] Billing Portal opens for a paid customer.
- [ ] Refund/cancel/support process is known.

## 7. Deployment/ops

Before each launch-facing deploy:

```bash
npm run lint
npm run build
npm run check:edge
npm run check:production-smoke
```

After deploy:

- [ ] `https://5pmsomewhere.live/` returns HTTP 200.
- [ ] Current bundle is referenced from production HTML.
- [ ] Service worker references current precache assets.
- [ ] Browser console has no JS errors on home/how-it-works/live stream.
- [ ] If Supabase migrations changed, `supabase db push` has been run and verified.

## 8. Recommended launch path

- [ ] Private beta: 10–20 trusted testers.
- [ ] Ask each tester: “Did you understand it?”, “Could you upload?”, “Would you do it again tomorrow?”
- [ ] Fix camera/upload/confusion issues before public launch.
- [ ] Then expand via one themed challenge, e.g. “Friday 5PM”.
