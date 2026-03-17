# Supabase + Feishu Worker Setup

## 1. Configure env

Copy `.env.example` to `.env`, then fill in your Supabase and Feishu credentials.

- `DATABASE_URL`: use the Supabase session pooler connection string for app runtime.
- `DIRECT_URL`: use the direct database host from the Supabase `Connect` panel.
- `APP_BASE_URL`: the public base URL that Feishu cards should link back to.
- `FEISHU_APP_ID` / `FEISHU_APP_SECRET`: your self-built Feishu app credentials.
- `FEISHU_VERIFICATION_TOKEN` / `FEISHU_ENCRYPT_KEY`: callback verification settings from Feishu.
- `FEISHU_SOURCE_APP_TOKEN` / `FEISHU_SOURCE_TABLE_ID`: the Bitable that stores `Sources`.
- `FEISHU_REVIEW_CHAT_ID`: chat that receives review cards and ingest summaries.
- `FEISHU_DIGEST_CHAT_ID`: chat that receives digest and dispatch summaries.
- `WORKER_SHARED_SECRET`: shared secret for `POST /api/internal/worker/:task`.

## 2. Generate Prisma client

```bash
npm run db:generate
```

## 3. Push schema and seed demo data

```bash
npm run db:push
npm run db:seed
```

## 4. Start the app

```bash
npm run dev
```

## 5. Run worker tasks

```bash
npm run worker:sync-feishu-sources
npm run worker:run-ingest-cycle
npm run worker:generate-digest
npm run worker:dispatch-email
```

## 6. Recommended schedule

- `sync-feishu-sources`: every 5 minutes
- `run-ingest-cycle`: every 10 minutes
- `generate-digest`: every day at 08:30
- `dispatch-email`: every day at 09:00

## Notes

- `db:reset` is guarded. Run it only when you really want to wipe the current database.
- `/admin` is intentionally disabled. Source management and content approval now live in Feishu.
- `POST /api/feishu/callback` is the callback URL for Feishu card actions and URL verification.
- `POST /api/internal/worker/:task` can be used by the local scheduler if you prefer HTTP triggers over direct CLI execution.
