# CS Technical Interview Prep Platform

A gamified prep platform for technical interviews. Its core feature is the 1-strike Survival Quiz: answer questions one at a time and the first wrong answer ends the run. This is v1, built on free tiers.

**Stack:** React + Vite + TypeScript + Tailwind (client) · Node + Express + TypeScript (API) · PostgreSQL + Prisma · Docker

> Status: Milestone 1 (foundation). The app currently shows whether the API is alive; features arrive in later milestones.

## Prerequisites

- Node 24 (see `.nvmrc`)
- Git
- Docker Desktop (with Compose)

## Quick start

1. Clone the repo and enter it:
   ```
   git clone https://github.com/Mukul0223/cs-interview-prep.git
   cd cs-interview-prep
   ```
2. Create the Compose environment file and fill in your own local values (a username, a password of letters and digits, and a database name):
   ```
   cp .env.example .env
   ```
3. Start Postgres and the API (applies the database migrations automatically):
   ```
   docker compose up --build
   ```
4. In a second terminal, start the client:
   ```
   cd client
   cp .env.example .env
   npm install
   npm run dev
   ```
5. Open http://localhost:5173. It should say **API ok**.

The API runs at http://localhost:4000 (health check: http://localhost:4000/api/v1/health). Postgres and the API are only reachable from your own machine.

## Running the API outside Docker (optional)

Keep the Postgres container running, stop the `api` container, then:

```
cd server
cp .env.example .env
npm install
npm run dev
```

Set `DATABASE_URL` in `server/.env` to point at `localhost` with the same user, password and database as your root `.env`.

## Project layout

- `client/` React single-page app
- `server/` Express API, Prisma schema and migrations
- `docker-compose.yml` local Postgres + API

## Notes

- Never commit `.env` files. Only the `.env.example` files are tracked.
- `docker compose down` keeps your database data; `docker compose down -v` deletes it.
