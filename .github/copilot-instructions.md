---
description: Instructions for the Eden Viewer media stack - Synology DS923+ and Azure Container Apps deployments.
applyTo: "**"
---

# Copilot Instructions

## Project Overview
Eden Viewer is a media stack (Plex, Sonarr, Radarr) with:
- **Primary deployment**: Synology DS923+ (LAN-first, Docker Compose)
- **Secondary deployment**: Azure Container Apps (cloud mirror)
- **Setup UI**: Web-based OOBE wizard (Node.js/Express) for first-run configuration

## Current State (December 2025)
- Setup UI v3.0.0 running on port 8080 (HTTP) or 3000 (Docker/HTTPS)
- Azure Plex endpoint: `https://plex.calmsky-4c04ebcd.eastus.azurecontainerapps.io`
- GitHub Actions: `evaluation` workflow runs only on `evaluation/**` changes
- Plex claim flow: Use `az containerapp secret set` + `az containerapp update` with fresh token from plex.tv/claim

## TLS Overview
- Focus on the Synology DS923+ home media stack (Plex, Sonarr, Radarr) and the optional Azure remote deployment that mirrors the same Docker Compose services.
- Prioritize LAN-only access for Synology; require VPN or authenticated reverse proxy + TLS before exposing *arr services externally.
- Document certificate handling for both Azure-managed endpoints and bring-your-own (BYO) certificates so contributors can maintain consistent HTTPS guidance.

## Setup UI
- The Setup UI provides a web-based OOBE (Out-of-Box Experience) wizard at `http://localhost:8080`.
- Reference the Setup UI for first-run configuration of PUID/PGID/TZ, storage paths, and service selection.
- The `/api/plex-status` endpoint checks Plex connectivity using fallback candidates: domain (HTTPS/HTTP) → LAN host → Docker internal → localhost.
- Returns `{ online, claimed, machineIdentifier, version, url }` for UI to gate "Launch Plex" button.
- Support TLS for Setup UI via `SETUP_UI_CERT_FILE` and `SETUP_UI_KEY_FILE` environment variables.
- Force OOBE mode with `SETUP_UI_FIRST_RUN=true` for testing.
- Default port is 8080; auto-fallback to random port if busy.

## Azure Container Apps
- Resource group: `eden-viewer-rg` (eastus)
- Environment: `eden-viewer-env`
- Plex FQDN: `plex.calmsky-4c04ebcd.eastus.azurecontainerapps.io`
- Plex claim process:
  1. Get token from https://www.plex.tv/claim/ (expires in 4 min)
  2. `az containerapp secret set --resource-group eden-viewer-rg --name plex --secrets plex-claim="claim-xxx"`
  3. `az containerapp update --resource-group eden-viewer-rg --name plex --set-env-vars PLEX_CLAIM=secretref:plex-claim`
- Bicep template (`azure/main.bicep`) accepts `plexClaimToken` secure parameter

## Synology DS923+
- Assume DSM 7.x with Docker (Container Manager) and Btrfs volumes under `/volume1`.
- Recommend VPN-first access (Tailscale, Synology VPN Server, WireGuard) instead of public exposure.
- If TLS is desired on Synology, describe reverse proxy patterns (e.g., DSM Application Portal, Caddy, Nginx) that terminate HTTPS locally while upstream containers stay on HTTP.
- Remind users of DS923+ hardware limits (Ryzen R1600, no Quick Sync) and keep TLS references mindful of CPU impact.
- Emphasize backups (`/volume1/docker/appdata`, media libraries) before any certificate or reverse proxy changes.

## Plex Ingress Policy
- Default Container Apps configuration sets `allowInsecure: false` for HTTPS-only access.
- Document the trade-off: keeping HTTP simplifies discovery but leaves plaintext paths available.
- Provide guidance: keep HTTP for lab/testing, but recommend turning it off in hardened environments once HTTPS + certificates are confirmed.

## GitHub Actions
- `evaluation.yml`: Runs Python eval suite (chatbot + envgen) only when `evaluation/**` changes
- Path filtering prevents unnecessary runs on unrelated pushes
- Concurrency group auto-cancels in-progress runs on same ref
- 20-minute timeout prevents runaway jobs

## Key Files
- `setup-ui/server.js` - Express server with Plex probe, TLS support, rate limiting
- `setup-ui/public/index.html` - OOBE wizard with claim helpers
- `azure/main.bicep` - Infrastructure as Code for Container Apps
- `azure/deploy-apps.sh` - CLI deployment script with PLEX_CLAIM support
- `docker-compose.yml` - Local/Synology deployment
- `.env` - Environment variables (PUID, PGID, TZ, PLEX_CLAIM, PLEX_DOMAIN)

## Authoring Notes for Copilot
- When generating documentation or scripts, call out whether instructions target Synology LAN users or Azure remote deployments.
- Always reference `.env` variables for PUID/PGID/TZ and Synology path mappings (`/volume1/data`, `/volume1/docker/appdata`).
- Reinforce VPN + TLS requirements for Sonarr/Radarr when remote access is mentioned.
- Link to detailed steps in `azure/README.md`, `docs/synology-setup.md`, and setup UI docs after they are updated with TLS workflows.
- Use clear, concise language suitable for users with moderate technical skills familiar with Docker and Synology DSM.
- Encourage best practices around security, backups, and certificate management throughout the documentation.
- Test generated instructions against both Synology and Azure setups to ensure accuracy and completeness before finalizing.
- Avoid suggesting any properties other than `name`, `description`, and `applyTo` in the YAML front matter.
- Set `applyTo` to `**` to ensure the instructions apply to all files in the repository.
- Provide examples and code snippets where applicable to illustrate configuration steps.
- Highlight any potential pitfalls or common mistakes users might encounter during TLS setup and how to avoid them.

