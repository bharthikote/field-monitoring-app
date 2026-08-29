# Backend

Node.js + Express API, connects to a free-tier Supabase Postgres database.

## 1. Create a free Supabase project

1. Go to [supabase.com](https://supabase.com) and sign up / log in (free tier is fine).
2. Click **New project**. Pick any name/region, and set a database password — save it somewhere, you'll need it below.
3. Once the project is ready, go to **Project Settings -> Database -> Connection string -> URI**.
4. Copy that URI (it looks like `postgresql://postgres:[PASSWORD]@db.xxxx.supabase.co:5432/postgres`) and paste your actual password in where it says `[PASSWORD]`.

## 2. Configure

```bash
cp .env.example .env
```

Paste your connection string into `.env` as `DATABASE_URL`.

## 3. Install & run

```bash
npm install
npm run dev
```

Then check it's talking to the database:

```bash
curl http://localhost:4000/health
```

You should get back `{"status":"ok","dbTime":"..."}`.
