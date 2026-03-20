# OpenBiometrics Cloud

SaaS platform for [OpenBiometrics](https://github.com/drinkredwine/openbiometrics) — the open-source biometric engine.

## Architecture

| Component | Path | Deploys to | URL |
|-----------|------|------------|-----|
| Marketing site | `marketing/` | Cloudflare Pages | `openbiometrics.dev` |
| SaaS API | `api/` | Fly.io | `api.openbiometrics.dev` |
| Dashboard | `dashboard/` | Cloudflare Pages | `app.openbiometrics.dev` |

## Quick Start

### Marketing Site

```bash
cd marketing
npm install
npm run dev
```

### API

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload
```

### Dashboard

```bash
cd dashboard
npm install
npm run dev
```

## Deployment

- **Marketing**: Pushed to Cloudflare Pages via GitHub Actions on merge to `main`
- **API**: Deployed to Fly.io via GitHub Actions on merge to `main`
- **Dashboard**: Built and deployed alongside marketing to Cloudflare Pages

## Environment Variables (API)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite path (default: `./openbiometrics.db`) |
| `ENGINE_URL` | OpenBiometrics engine URL (default: `http://localhost:8000`) |
| `STRIPE_SECRET_KEY` | Stripe API key for billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `CORS_ORIGINS` | Comma-separated allowed origins |

## License

MIT
