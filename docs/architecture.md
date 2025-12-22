# Teams SIP Ladder Viewer Architecture

## Goals

- Allow authenticated Microsoft Teams users to request a SIP ladder diagram for a given `callId` fetched from Microsoft Graph Call Records.
- Keep Azure AD application secrets on the server while providing a responsive, modern frontend experience.
- Provide an extensible codebase suitable for future integrations (e.g., Cosmos DB persistence, advanced analytics).

## High-Level Components

- **Frontend SPA** (React 18 + Vite + TypeScript) – handles MSAL sign-in, call ID entry, SIP ladder rendering, and UX state.
- **Backend API** (Node.js 20 + Express + TypeScript) – manages On-Behalf-Of token exchange, Microsoft Graph requests, response normalization, and caching.
- **Visualization** (Recharts + custom layout utilities) – renders participants, SIP messages, timestamps, and metadata in a vertical ladder diagram.

## Authentication Flow

1. Frontend uses `@azure/msal-browser` with Authorization Code PKCE to sign in the Teams user.
2. Frontend posts the acquired user access token to `/api/call-records/:callId` (HTTPS only).
3. Backend uses `@azure/msal-node` confidential client to perform On-Behalf-Of (OBO) exchange, requesting `https://graph.microsoft.com/.default` scopes including `CallRecords.Read.All`.
4. Backend caches Graph access tokens per user session (memory cache initially, abstracted for future Redis/Azure Cache).
5. Graph responses are transformed into a normalized ladder model and returned to the frontend.

> **Note:** For testing without Azure AD credentials, the backend supports a `GRAPH_MOCK_MODE=true` switch that serves fixtures from `data/sample-call-record.json`.

## API Surface (Backend)

- `POST /api/auth/refresh` – optional endpoint to renew frontend session tokens.
- `POST /api/call-records/:callId` – main entry point for retrieving SIP ladder data. Requires bearer token (frontend user access token).
- `GET /healthz` – readiness probe for hosting environments.

## Frontend Pages & Routes

- `/` – Landing page with login button, recent searches, and call ID input form.
- `/ladder/:callId` – Ladder visualization page using React Router v6.
- Global state managed through Zustand to track authentication, loading status, and ladder data.

## Data Modeling

- `CallParticipant`: { id, displayName, endpointType }
- `SipEvent`: { id, fromParticipantId, toParticipantId, timestamp, messageType, details }
- `SipLadder`: { callId, startedAt, endedAt, participants: CallParticipant[], events: SipEvent[] }

## Visualization Strategy

- Use CSS grid to allocate columns per participant lane.
- Render SIP messages as absolute-positioned components with arrow connectors (SVG + React).
- Provide filtering toggles (e.g., signaling, media, diagnostics) and zoom controls.
- Display raw JSON below ladder for debugging.

## Configuration & Secrets

Environment variables (backend `.env.local` – not committed):

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `FRONTEND_BASE_URL`
- `GRAPH_ENABLE_BETA=false`
- `GRAPH_MOCK_MODE=false`

Frontend `.env.local` variables (non-secret):

- `VITE_AZURE_CLIENT_ID`
- `VITE_AZURE_TENANT_ID`
- `VITE_AUTHORITY=https://login.microsoftonline.com/{tenantId}`
- `VITE_REDIRECT_URI=https://localhost:5173/auth/callback`

## Development Workflow

1. Run backend (`npm run dev` inside `services/api`).
2. Run frontend (`npm run dev` inside `apps/web`).
3. Use ngrok or dev tunnel when testing with live Teams clients requiring HTTPS endpoints.

## Future Enhancements

- Persist ladder lookups to Azure Cosmos DB for audit trail.
- Add SignalR-based live updates when call progress events stream in.
- Integrate export to PDF and PNG for reports.
- Provide RBAC enforcement via Azure AD app roles.
