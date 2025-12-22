# Teams SIP Ladder Viewer

A full-stack web experience that lets Microsoft Teams administrators visualize SIP signaling ladders for a given call ID using Microsoft Graph Call Records. The project contains a React + TypeScript frontend (`apps/web`) and an Express + TypeScript backend (`services/api`).

> **Quick demo mode:** The backend defaults to `GRAPH_MOCK_MODE=true` so you can explore the UI with sample data before registering an Azure AD application.

## Project Structure

```text
apps/web            # Vite + React frontend
services/api        # Express backend for Graph access
 docs/              # Architecture and design notes
```

## Prerequisites

- Node.js 20+
- npm 10+
- Microsoft 365 tenant with permissions to query Microsoft Graph Call Records (for live data)

## Getting Started

1. **Install dependencies**

   ```bash
   cd services/api && npm install
   cd ../../apps/web && npm install
   ```

2. **Configure environment variables**

   Copy the provided examples to local files and update as needed:

   ```bash
   cp services/api/.env.example services/api/.env.local
   cp apps/web/.env.example apps/web/.env.local
   ```

   When ready to use live data, set `GRAPH_MOCK_MODE=false` and provide Azure AD credentials (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`).

3. **Enable Microsoft sign-in (optional)**

   - Populate `apps/web/.env.local` with `VITE_AZURE_CLIENT_ID`, `VITE_AZURE_TENANT_ID`, and `VITE_REDIRECT_URI` that match your Azure AD application registration.
   - Until those values are defined, the UI stays in **mock mode** (no Microsoft login flow) and the **Sign in with Microsoft** button will display guidance when clicked.
   - After updating environment variables, restart both dev servers so Vite picks up the new configuration.

4. **Run the backend API**

   ```bash
   cd services/api
   npm run dev
   ```

   The API listens on `http://localhost:7071` by default and exposes:

   - `GET /healthz` – health probe
   - `POST /api/call-records/:callId` – returns normalized SIP ladder data

5. **Run the frontend app**

   ```bash
   cd apps/web
   npm run dev
   ```

   Open `http://localhost:5173` to load the web app.

## Troubleshooting Sign-in

- If the **Sign in with Microsoft** button immediately shows a configuration warning, double-check the values in `apps/web/.env.local` and `services/api/.env.local`.
- Ensure your Azure AD application includes the redirect URI used locally (default `http://localhost:5173`) and the delegated permission `CallRecords.Read.All`.
- After granting admin consent for the permission, sign out and back in from the app to refresh tokens.

## Authentication Flow

- The frontend authenticates users with MSAL (Authorization Code PKCE).
- The backend exchanges the user token for a Graph access token using the On-Behalf-Of (OBO) flow and queries `communications/callRecords/{callId}`.
- Responses are normalized into participant lanes and SIP signaling events suitable for ladder visualization.

## Customization

- Adjust the ladder visualization style via `apps/web/src/components/SipLadderDiagram.tsx` and accompanying CSS.
- Extend Graph data mappings in `services/api/src/utils/normalizeCallRecord.ts` to incorporate additional diagnostics.
- Persist lookup history or add collaborative features by connecting the backend to Azure Cosmos DB or Azure Storage.

## Testing with Sample Data

Leave `GRAPH_MOCK_MODE=true` and use the demo call ID `sample-call` to render the static sample flow located at `services/api/data/sample-call-record.json`.

---

See `docs/architecture.md` for deeper design details and future enhancement ideas.
