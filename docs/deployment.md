# Deployment Guide

## Files to Create

### `.github/workflows/deploy.yml`

Create the directory `.github/workflows/` in the repo root and add this file:

```yaml
name: Deploy HackFarmer

on:
  push:
    branches: [main]

jobs:
  backend:
    name: Deploy Backend to Heroku
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
          heroku_app_name: hackfarmer-api
          heroku_email: ${{ secrets.HEROKU_EMAIL }}
          appdir: backend

  frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - name: Install & Build
        working-directory: frontend
        run: |
          npm ci
          npm run build
      - name: Deploy to Appwrite Sites
        working-directory: frontend
        run: |
          npm install -g appwrite-cli
          appwrite login --endpoint ${{ secrets.APPWRITE_ENDPOINT }} --project ${{ secrets.APPWRITE_PROJECT_ID }} --key ${{ secrets.APPWRITE_API_KEY }}
          appwrite deploy site --site-id hackfarmer-frontend --build-path dist
```

## Heroku Setup (Run Once)

```bash
heroku login
heroku create hackfarmer-api
heroku config:set \
  ENVIRONMENT=production \
  APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1 \
  APPWRITE_PROJECT_ID=xxx \
  APPWRITE_API_KEY=xxx \
  APPWRITE_DATABASE_ID=hackfarmer-db \
  APPWRITE_ZIP_BUCKET_ID=generated-zips \
  FERNET_KEY=xxx \
  FRONTEND_URL=https://your-domain.com \
  --app hackfarmer-api

git subtree push --prefix backend heroku main
```

## Appwrite Sites Deploy (Run Once)

```bash
npm install -g appwrite-cli
appwrite login
cd frontend && npm run build
appwrite deploy site --site-id hackfarmer-frontend --build-path dist
```

## Environment Variables Required on Heroku

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | `production` |
| `APPWRITE_ENDPOINT` | `https://cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT_ID` | Your Appwrite project ID |
| `APPWRITE_API_KEY` | Server-side Appwrite API key |
| `APPWRITE_DATABASE_ID` | `hackfarmer-db` |
| `APPWRITE_ZIP_BUCKET_ID` | `generated-zips` |
| `FERNET_KEY` | Encryption key for API keys/tokens |
| `FRONTEND_URL` | Production frontend URL (for CORS) |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |

## Validation

```bash
curl https://hackfarmer-api.herokuapp.com/health
# Expected: {"status":"healthy"}
```
