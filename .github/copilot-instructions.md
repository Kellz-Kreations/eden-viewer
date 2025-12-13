# Copilot Instructions

## TLS Overview
- Focus on the Synology DS923+ home media stack (Plex, Sonarr, Radarr) and the optional Azure remote deployment that mirrors the same Docker Compose services.
- Prioritize LAN-only access for Synology; require VPN or authenticated reverse proxy + TLS before exposing *arr services externally.
- Document certificate handling for both Azure-managed endpoints and bring-your-own (BYO) certificates so contributors can maintain consistent HTTPS guidance.

## Synology DS923+
- Assume DSM 7.x with Docker (Container Manager) and Btrfs volumes under `/volume1`.
- Recommend VPN-first access (Tailscale, Synology VPN Server, WireGuard) instead of public exposure.
- If TLS is desired on Synology, describe reverse proxy patterns (e.g., DSM Application Portal, Caddy, Nginx) that terminate HTTPS locally while upstream containers stay on HTTP.
- Remind users of DS923+ hardware limits (Ryzen R1600, no Quick Sync) and keep TLS references mindful of CPU impact.
- Emphasize backups (`/volume1/docker/appdata`, media libraries) before any certificate or reverse proxy changes.

## Azure Remote Stack
- Azure Container Apps deploy Plex, Sonarr, and Radarr with HTTPS endpoints (`https://<service>.<region>.azurecontainerapps.io`).
- Outline certificate options: Azure-managed certs for custom domains, Azure DNS + Key Vault certificates, or manual PEM uploads.
- Mention that storage accounts already enforce HTTPS (`supportsHttpsTrafficOnly = true`, `minimumTlsVersion = TLS1_2`).
- Provide steps for binding custom domains, obtaining certificates, and renewing them (Key Vault automation or scheduled `az` CLI rotations).
- Reference `SETUP_UI_CERT_FILE` / `SETUP_UI_KEY_FILE` env vars for mounting certs into the setup UI container; note the self-signed fallback.

## Plex Ingress Policy
- Default Container Apps configuration sets `allowInsecure: true` to preserve compatibility with legacy Plex clients that prefer HTTP fallback.
- Document the trade-off: keeping HTTP simplifies discovery but leaves plaintext paths available; disabling (`allowInsecure: false`) enforces HTTPS-only access.
- Provide guidance: keep HTTP for lab/testing, but recommend turning it off in hardened environments once HTTPS + certificates are confirmed.

## Authoring Notes for Copilot
- When generating documentation or scripts, call out whether instructions target Synology LAN users or Azure remote deployments.
- Always reference `.env` variables for PUID/PGID/TZ and Synology path mappings (`/volume1/data`, `/volume1/docker/appdata`).
- Reinforce VPN + TLS requirements for Sonarr/Radarr when remote access is mentioned.
- Link to detailed steps in `azure/README.md`, `docs/synology-setup.md`, and setup UI docs after they are updated with TLS workflows.

