# Study P: independent hosting preparation

This is a separate deployment target for the same application source, not a
redeployment of the ChatGPT Sites project. Do not publish until the privacy and
account checks below are complete. No live student data is copied by these files.

## Status

- The app is wired for Cloudflare Workers + D1 photo storage (R2 is disabled for the no-payment-method account).
- The admin analysis screen can delete processed evidence photos older than
  90 days in batches. Point and redemption records remain. Pending/held
  evidence is never selected. The deletion requires an admin confirmation.
- `vite.cloudflare.config.ts` omits the Sites-specific adapter.
- This configuration is a build target, not a tested public production release.
- A Cloudflare account, D1 database, R2 bucket and deployment credentials are
  required. Keep the account and credentials under the study room owner's control.
- Change the placeholder `database_id` in `wrangler.cloudflare.jsonc` after
  creating `study-p-db`. Photos are compressed before upload and stored privately in D1; do not enable R2.
- Set `ADMIN_SETUP_CODE` as a Worker secret. Generate a new random code; never
  copy the old Sites setup code into source control or chat.
- Run both checked-in SQL migrations on the new D1 database before the first
  request, then build and deploy with the standalone Cloudflare configuration.
  Confirm the output worker's D1 binding before deployment.

## Blocking production checks

1. Use synthetic students only while testing. The existing Sites database and
   photos do not automatically move to Cloudflare; moving them requires a
   separate, controlled export/import and verification.
2. Arrange an age-appropriate guardian notice/consent process and review the
   applicable privacy obligations before collecting real names, grades, work
   photos or activity records from minors. The current self-signup screen does
   not provide that process.
3. Check Cloudflare account tier and quotas in the actual account. A free tier
   is not an unlimited-capacity guarantee. In particular, the Worker Free CPU
   time limit needs real login/load testing with this app's password hashing.
   D1 Free has a 500 MB limit per database. Photos are compressed to at most
   180 KB, uploads stop when their encoded data reaches 350 MB, and old
   processed photos need manual deletion. Backups and other rows also use space.
4. Test student signup/approval, login persistence, photo access, requests,
   approval/ledger, once-a-day attendance, redemption and low-balance races
   on the new deployment before sharing a QR code.
5. Set up a backup and deletion workflow and restrict admin credentials.

The old Sites deployment stays private and unchanged. Do not put a production
link or personal student records in a public repository.
