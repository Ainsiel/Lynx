# LYNX — URL Shortener with Analytics

A production-ready URL shortener with real-time analytics, built with NestJS, Next.js, and PostgreSQL.

## Architecture

```mermaid
graph TB
    Client[Client Browser] --> Web[Next.js Web :3001]
    Web -->|API proxy| API[NestJS API :3000]
    API --> DB[(PostgreSQL)]
    API --> Cache[(Redis)]
    API --> Queue[RabbitMQ]
    Queue --> Worker[Worker Service]
    Worker --> Queue
    API --> Prometheus[Prometheus :9090]
    Prometheus --> Grafana[Grafana :3002]
```

## Features

- **URL Shortening** — Create short links with custom slugs
- **Analytics** — Click tracking by day, country, and device
- **QR Codes** — Generate and download QR codes (PNG/SVG)
- **Authentication** — JWT + OAuth (GitHub)
- **Rate Limiting** — Per-user and per-IP rate limits
- **Observability** — Prometheus metrics + Grafana dashboards

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, shadcn/ui |
| Backend | NestJS, Prisma, PostgreSQL |
| Cache | Redis |
| Queue | RabbitMQ |
| Worker | Node.js |
| Monitoring | Prometheus, Grafana |
| Load Testing | k6 |

## Quick Start

```bash
# Clone and start
git clone https://github.com/Ainsiel/Lynx.git
cd Lynx
cp apps/api/.env.example apps/api/.env
docker compose --profile develop up -d --build

# Seed sample data
pnpm db:seed
```

The application will be available at:
- **Web**: http://localhost:3001
- **API**: http://localhost:3000
- **Swagger**: http://localhost:3000/api/docs
- **Grafana**: http://localhost:3002

## Environment Variables

See `apps/api/.env.example` for the full list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://lynx:lynx@localhost:5432/lynx` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `RABBITMQ_URL` | RabbitMQ connection string | `amqp://localhost:5672` |
| `JWT_SECRET` | Secret for JWT signing | — |

## API Documentation

Swagger UI is available at `/api/docs` when the API is running.

## Load Testing

k6 scripts are in the `k6/` directory:

```bash
# Redirect spike test (10k redirects/min)
k6 run k6/redirect-spike.js

# Slug creation test (500 concurrent)
k6 run k6/create-slug.js
```

## Screenshots

> *Screenshots coming soon*

## CI/CD

GitHub Actions workflow runs on push to `main`:
1. **Build** — typecheck, lint, build
2. **Test** — integration tests with PostgreSQL, Redis, RabbitMQ
3. **Load** — k6 spike tests

## Project Structure

```
lynx/
├── apps/
│   ├── api/          # NestJS API server
│   ├── web/          # Next.js frontend
│   └── worker/       # Background worker (emails, clicks)
├── packages/
│   ├── db/           # Prisma schema + client
│   └── shared/       # Shared Zod schemas + types
├── k6/               # Load test scripts
├── infra/            # Prometheus + Grafana config
├── docker-compose.yml
└── README.md
```

## Future Improvements

- Hot links (real-time click streaming)
- Real geolocation for click analytics
- Old clicks purge policy
- Multi-tenant support

## License

MIT
