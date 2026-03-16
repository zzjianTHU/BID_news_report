# Supabase Setup

## 1. Configure env

Copy `.env.example` to `.env`, then fill in your Supabase Postgres credentials.

- `DATABASE_URL`: use the Supabase pooled connection string for app runtime.
- `DIRECT_URL`: use the direct connection string for Prisma schema operations.

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

## Notes

- `db:reset` is guarded. Run it only when you really want to wipe the current database.
- The current admin login still uses `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_SESSION_VALUE` from `.env`.
