# Deployment Plan for HackFarmer

This document outlines the steps to configure Heroku, Appwrite, and Sentry for the HackFarmer application.

## 1. Appwrite Configuration (Database & Storage)

1.  **Create Project:** Log in to [Appwrite Cloud](https://cloud.appwrite.io/) and create a new project (e.g., "HackFarmer").
2.  **API Key:**
    *   Go to **Overview** > **Integrations** > **API Keys**.
    *   Create a new API Key with the following scopes:
        *   `databases.read`, `databases.write`
        *   `collections.read`, `collections.write`
        *   `attributes.read`, `attributes.write`
        *   `indexes.read`, `indexes.write`
        *   `documents.read`, `documents.write`
        *   `files.read`, `files.write`
        *   `buckets.read`, `buckets.write`
        *   `users.read`, `users.write`
    *   Copy the `API Key` and `Project ID`.
3.  **Endpoint:** The endpoint is usually `https://cloud.appwrite.io/v1`.

## 2. GitHub Secrets (Frontend Build Time)

**CRITICAL:** The Frontend is built by GitHub Actions, NOT Heroku. The build process **cannot see your Heroku Config Vars**. You MUST set these secrets in GitHub for the frontend to work.

1.  **Go to GitHub Repo > Settings > Secrets and variables > Actions > New repository secret**:

    | Name | Value | Description |
    | :--- | :--- | :--- |
    | `VITE_APPWRITE_PROJECT_ID` | (Your Project ID) | Required for frontend to talk to Appwrite. |
    | `VITE_SENTRY_DSN` | (Your Sentry DSN) | Required for frontend error tracking. |
    | `HEROKU_API_KEY` | (Your Heroku API Key) | Required to deploy to Heroku. |
    | `HEROKU_APP_NAME` | **`hackfarmer-api`** | **IMPORTANT:** Use your **Backend** app name here. |
    | `HEROKU_EMAIL` | (Your Heroku Email) | Your Heroku account email. |

    *Note: `VITE_APPWRITE_ENDPOINT` and `VITE_APPWRITE_DATABASE_ID` are hardcoded/defaulted in the build script to `https://cloud.appwrite.io/v1` and `hackfarmer-db` respectively to save you time, but you can change them in `deploy.yml` if needed.*

## 3. Heroku Configuration (Backend Runtime)

**CRITICAL:** You only need to configure the **`hackfarmer-api`** (Backend) app.
*   The current setup is a **Unified Deployment**: The backend serves the frontend files.
*   The separate "frontend" app on Heroku is **NOT USED** by this setup.
*   Put all these variables in **`hackfarmer-api`**.

1.  **Go to Heroku Dashboard > `hackfarmer-api` > Settings > Config Vars**:

    | Key | Value | Notes |
    | :--- | :--- | :--- |
    | `APPWRITE_ENDPOINT` | `https://cloud.appwrite.io/v1` | Backend needs this. |
    | `APPWRITE_PROJECT_ID` | `...` | Backend needs this. |
    | `APPWRITE_API_KEY` | `standard_...` | **RENAME** `VITE_API_KEY` to this. **DO NOT** start with `VITE_`! |
    | `APPWRITE_DATABASE_ID` | `hackfarmer-db` | Backend needs this. |
    | `APPWRITE_ZIP_BUCKET_ID` | `generated-zips` | |
    | `ENVIRONMENT` | `production` | |
    | `FRONTEND_URL` | `https://hackfarmer-api.herokuapp.com` | **Update this** to match your `hackfarmer-api` URL. |
    | `SENTRY_DSN` | `...` | Backend error tracking. |
    | `FERNET_KEY` | `...` | Encryption key. |

    **Why?** The Python backend looks for `APPWRITE_API_KEY`. The frontend is already built and baked into the backend app by the time it reaches Heroku.

## 4. Deployment

1.  **Commit & Push:** Push your changes to the `main` branch.
2.  **Monitor Action:** Go to the **Actions** tab in your GitHub repository and watch the "Deploy HackFarmer" workflow.
    *   It will install dependencies, lint the backend, build the frontend, and deploy everything to Heroku.
    *   The deployment step now uses a robust `git push --force` method to ensure your latest code is always live, overwriting any history mismatches.
3.  **Verify:** Once the action completes successfully (green checkmark), your app is live.
4.  **Check Logs:** If needed, check the Heroku logs (`heroku logs --tail -a <your-app-name>`) to verify the backend started correctly and connected to Appwrite.

## 5. Storage (Buckets)

1.  **Create Bucket:** In Appwrite Console > Storage, create a bucket named `Generated ZIPs` (or similar).
2.  **Bucket ID:** Copy the Bucket ID.
3.  **Config:** If the ID is NOT `generated-zips`, update the `APPWRITE_ZIP_BUCKET_ID` Config Var in Heroku settings to match your new Bucket ID.
    *   *Default in code is `generated-zips`.*
