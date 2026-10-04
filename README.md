# Pyramid

Construction site project management. Next.js + MySQL, deployed with Docker.

## Local development

```bash
docker compose up -d      # MySQL on localhost:3307
cp .env.example .env.local
npm install
npm run dev               # http://localhost:3000
```

`http://localhost:3000/api/health` reports whether the app can reach the database.

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`:

1. Lints, builds the Docker image and pushes it to `ghcr.io/imanirumvaolivier20-a11y/piramid`.
2. Copies `docker-compose.prod.yml` to `~/piramid` on the VPS over SSH.
3. Pulls the new image, restarts the stack and checks `/api/health`.

The app is published on port `3100` of the VPS (change `APP_PORT` in `~/piramid/.env`).

### One-time setup

GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret        | Value                                         |
| ------------- | --------------------------------------------- |
| `VPS_HOST`    | VPS IP address                                |
| `VPS_USER`    | SSH user (must be allowed to run `docker`)    |
| `VPS_SSH_KEY` | Private deploy key                            |
| `VPS_PORT`    | SSH port, only if it is not 22                |

On the VPS, create `~/piramid/.env` with the production values listed in `.env.example`
and add the public deploy key to `~/.ssh/authorized_keys`.
