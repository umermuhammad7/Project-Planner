# Local PostgreSQL Setup

You created a local pgAdmin 4 database named `HomeThread` on server `server1`.

## Connection String

Create `apps/backend/.env` from the example file and set `DATABASE_URL` with your local PostgreSQL credentials:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/HomeThread
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=development
PORT=3000
FRONTEND_URL=exp://homethread
```

If your pgAdmin server uses a different username, replace `postgres` with that role.

## Verify The Connection

```bash
npm --workspace apps/backend run db:check
```

Expected output:

```text
Connected to HomeThread as postgres
```

## Run The Schema Migration

```bash
npm run db:migrate
```

The migration creates:

- `pgcrypto`
- local `auth.users` compatibility table if it does not already exist
- all HomeThread app tables from the handoff
- indexes and constraints from the handoff

On a real Supabase database, `auth.users` already exists, so the compatibility statement does not replace it.

## Seed Local Demo Data

```bash
npm --workspace apps/backend run db:seed
```

This creates a deterministic dev family, members, events, chores, rewards, and a grocery list for local API testing.

## Start The Backend

```bash
npm run backend:dev
```

The API runs at:

```text
http://localhost:3000/api/v1
```
