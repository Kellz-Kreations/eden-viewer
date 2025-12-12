# Copilot Instructions (Synology Media Stack)

- Keep scope to the Synology DS923+ home entertainment stack using Docker Compose.
- Services: Plex, Sonarr, Radarr only.
- Do not add torrent/indexer/tracker configuration or piracy-related guidance.
- Prefer a single shared data mount inside *arr containers (e.g. `/data`).
- Keep per-app configs in `/volume1/docker/appdata/<app>`.
- Prefer LAN-only access for Sonarr/Radarr; if remote access is mentioned, recommend VPN or strong auth + TLS.
- Note DS923+ (Ryzen R1600) has no Intel Quick Sync; plan around Direct Play.
- Use `.env` variables for PUID/PGID/TZ and Synology host paths.
- Provide safe defaults and `-WhatIf`/dry-run guidance when applicable.
