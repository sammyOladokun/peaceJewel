# Peace Jewel

Starter environment for a jewelry e-commerce store.

## Stack

- Next.js + React + TypeScript for the storefront
- NestJS + TypeScript for the API
- PostgreSQL for primary data
- Redis for caching and background jobs
- S3-compatible storage for product media
- Stripe for payments

## Local setup

1. Copy `.env.example` to `.env`.
2. Start local services:

   ```bash
   npm run db:up
   ```

3. Build and run the apps with Docker:

   ```bash
   docker compose up --build web api
   ```

4. Install dependencies when app code is added:

   ```bash
   npm install
   ```

## Services

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Mailhog UI: `http://localhost:8025`
- Web app: `http://localhost:3000`
- API app: `http://localhost:4000`

## Environment

- Copy `.env.example` to `.env` if you want to customize values.
- `NEXT_PUBLIC_API_URL` points the storefront at the API service.
- `PORT` controls the NestJS API port inside the container.

## Next step

Add the web app and API app inside `apps/`, then wire them to the shared environment variables.
