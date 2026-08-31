# Personal Life OS

A private, standalone Next.js application for daily health signals, goals, recurring actions, explainable scores, drift detection, and weekly review.

## Local setup

1. Create a PostgreSQL database and copy `.env.example` to `.env.local` with local-only values.
2. Run `npm install`, `npm run db:generate`, `npm run db:migrate`, and `npm run db:seed`.
3. Start with `npm run dev`, create a private account at `/signup`, and continue to `/today`.

`db:seed` intentionally creates no account unless `SEED_USER_EMAIL` and `SEED_USER_PASSWORD` are supplied. The first account created in the app receives a personal baseline automatically.

Outbound email defaults to an audit-only adapter, which stores intended messages without sending them. The inbound endpoint records a signed provider payload and creates proposed parsed entries for review.
