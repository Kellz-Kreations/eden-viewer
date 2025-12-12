# Synology DS923+ Media Stack (Plex + Sonarr + Radarr)

This project provides a **DS923+-friendly** Docker Compose stack for:
- Plex
- Sonarr
- Radarr

Scope is intentionally limited to **library organization and container best practices**. It does not include piracy-related integrations.

## DS923+ note (important)
The DS923+ uses an AMD Ryzen R1600 and generally **does not have Intel Quick Sync** hardware video transcoding. Plan for **Direct Play** where possible.

## Folder layout (Synology host)
Create these folders on the NAS:
- `/volume1/docker/appdata/{plex,sonarr,radarr}`
- `/volume1/docker/transcode/plex`
- `/volume1/data/media/{movies,tv}`
- `/volume1/data/incoming/{movies,tv}`

Why a single `/data` mount for Sonarr/Radarr?
- Makes moves within the same filesystem (fast/atomic)
- Avoids painful remote-path mapping issues

## Permissions
Create a non-admin DSM user (example: `docker`) that owns `/volume1/docker` and `/volume1/data`.
Set `PUID`/`PGID` in `.env` to match that user.

## Deploy
1. Copy `.env.example` to `.env` and edit values for your NAS.
2. In Synology **Container Manager**:
   - Project → Create → Import
   - Select this folder and deploy `compose.yaml`

## Plex library paths
Inside Plex, add libraries using these container paths:
- Movies: `/data/media/movies`
- TV: `/data/media/tv`

## Updating
Recommended approach:
- Pull latest images
- Recreate containers

## Backups
Back up (small, important):
- `/volume1/docker/appdata/plex`
- `/volume1/docker/appdata/sonarr`
- `/volume1/docker/appdata/radarr`

Media backups depend on your capacity and recovery plan.
