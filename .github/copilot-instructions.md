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
- Avoid advanced Docker networking; use default bridge or host network modes.
- Emphasize regular backups of `/volume1/docker/appdata` and media libraries.
- When suggesting commands, ensure compatibility with Synology's DSM environment.
- Avoid suggesting non-Docker installation methods for the services.
- When discussing resource usage, consider DS923+'s 4GB RAM and CPU limitations.
- When mentioning updates, recommend checking Synology's Package Center for Docker updates.
- Do not suggest using Kubernetes, Swarm, or other orchestration tools.
- When discussing storage, prefer Synology's Btrfs features (snapshots, integrity checks) if relevant.
- When mentioning logs, guide users to access them via DSM or mapped log directories.
- When providing examples, use realistic Synology paths and configurations.
- Keep the tone helpful and supportive for home media enthusiasts.
- Strive to make setup and management straightforward for users of varying technical expertise.

## File-Specific Guidelines

**Applies to:** `**/docker-compose.yml`, `**/README.md`

- Focus on Plex, Sonarr, and Radarr services only.
- Use shared data mounts and appropriate Synology host paths.
- Ensure compatibility with Synology DSM and hardware limitations.
- Emphasize security, backups, and resource considerations specific to the DS923+.
- Avoid piracy-related content and advanced Docker orchestration methods.
- Provide clear, Synology-specific instructions for setup, configuration, and maintenance.
- Use environment variables for user/group IDs and timezone settings.
- Recommend LAN-only access for management interfaces unless secure remote access methods are specified.
- When discussing updates or maintenance, reference Synology's Package Center and DSM features.
- Prioritize ease of use and clarity for users who may not be advanced Docker users.
- When mentioning storage options, highlight Synology's Btrfs capabilities where applicable.

## Script UX Guidelines

**Applies to:** `**/*.sh`

- Prefer idempotent scripts (safe to re-run).
- Support `--dry-run` plus a non-interactive `--yes` mode for SSH/automation.
- Print a clear “plan” up front (resolved paths, detected Docker Compose command).
- Avoid blocking prompts when stdin/stdout are not TTY; require explicit `--yes` to proceed.

Thank you for contributing to the Synology DS923+ media stack project!

