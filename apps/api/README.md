# API App

Backend service for catalog, inventory, orders, payments, and admin operations.

## Redis cache

This service uses Redis only as a cache layer for inventory and order reads.

- Set `REDIS_URL` to a secure `rediss://...` connection in production
- Keep Postgres as the source of truth
- Do not store admin passwords, payment keys, or other secrets in Redis
- If Redis is unavailable, the API falls back to Neon/Postgres and local file storage
