# CAMFIX

CAMFIX is a campus maintenance issue reporting and resolution application. It includes a browser-based frontend, an Express API, and SQLite/PostgreSQL database support.

## Requirements

- Node.js 20 or later
- npm

## Run locally

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create a local environment file and set a private JWT secret:

   ```powershell
   Copy-Item .env.example .env
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Put the generated value in `.env` as `JWT_SECRET`. Do not commit `.env`.

3. Start the application:

   ```powershell
   npm start
   ```

   Open <http://localhost:3000>.

With the example database settings, the server uses a local SQLite database at `backend/database/camfix.sqlite`. To use PostgreSQL instead, set `DATABASE_URL` or configure the `PG*` variables in `.env`. The server creates the schema and seeds demo data the first time it starts against an empty database.

## Demo accounts

The seed data includes demo users that all use `password123`:

| Role | Email |
| --- | --- |
| Student | `student@campus.edu` |
| Student | `student2@campus.edu` |
| Electrical maintenance | `tech.electrical@campus.edu` |
| IT maintenance | `tech.it@campus.edu` |
| Administrator | `admin@campus.edu` |

These credentials and the automatic demo seeding are for local development only. Do not expose a seeded instance publicly without changing/removing the demo accounts and reviewing the seed behavior.

## GitHub notes

Commit the source, `package.json`, `package-lock.json`, schema, and required sample assets. The root `.gitignore` excludes local environment files, dependencies, the SQLite database, generated QR codes, user uploads, and scratch scripts. `.env.example` is safe to commit and documents the required configuration.
