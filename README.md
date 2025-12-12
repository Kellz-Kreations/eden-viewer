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

## Synology DS923+ checklist (before deploy)

1) Create folders (SSH)

If you have SSH enabled on DSM, you can create the required folders like this:

```sh
sudo mkdir -p \
   /volume1/docker/appdata/plex \
   /volume1/docker/appdata/sonarr \
   /volume1/docker/appdata/radarr \
   /volume1/docker/transcode/plex \
   /volume1/data/media/movies \
   /volume1/data/media/tv \
   /volume1/data/incoming/movies \
   /volume1/data/incoming/tv
```

2) Confirm the container user’s PUID/PGID (SSH)

Replace `docker` with whatever DSM user you created for containers:

```sh
id docker
```

Use the reported UID/GID to set `PUID`/`PGID` in `.env`.

3) Set ownership + basic permissions (SSH)

Replace `docker:users` with your DSM user and group:

```sh
sudo chown -R docker:users /volume1/docker /volume1/data
sudo chmod -R u+rwX,g+rwX,o-rwx /volume1/docker /volume1/data
```

If you’d rather manage permissions in DSM UI, that’s fine too—just ensure your container user has read/write access to both `/volume1/docker` and `/volume1/data`.

## Deploy
### First run (recommended)
Generate your `.env` interactively (prompts for paths, PUID/PGID, and optional `PLEX_CLAIM`):

```powershell
pwsh -NoProfile -File .\scripts\setup.ps1
```

Tip: If you leave `PLEX_CLAIM` blank, the script can optionally open `https://plex.tv/link` and use the Plex API to obtain a one-time claim token (no password is entered into the script).

### First run (web UI)
If you prefer a browser-based setup, start the setup UI and download a generated `.env`:

```powershell
docker compose -f compose.setup.yaml up -d --build
```

Then open:
- **LAN access**: `http://<NAS-IP>:8081/`
- **Remote access**: Use Synology QuickConnect (see below)

The setup UI runs on HTTP by default (port 8081). For HTTPS, mount a trusted cert/key and set:
- `SETUP_UI_CERT_FILE`
- `SETUP_UI_KEY_FILE`

This setup-only compose file is intended for first run and does not require a `.env` to exist yet.

Download the `.env` file and place it next to `compose.yaml`, then redeploy your project.

If you used the setup-only compose file, stop it before starting the full stack (avoids port conflicts):

```powershell
docker compose -f compose.setup.yaml down
docker compose up -d
```

#### Remote access via Synology QuickConnect

To access the setup UI remotely without exposing it to the internet:

1. **Enable QuickConnect** in DSM:
   - Control Panel → QuickConnect → Enable
   - Note your QuickConnect ID (e.g., `your-nas-id`)

2. **Create a reverse proxy rule** in DSM:
   - Control Panel → Login Portal → Advanced → Reverse Proxy
   - Create a new rule:
     - Description: `Setup UI`
     - Source:
       - Protocol: `HTTPS`
       - Hostname: `your-nas-id.quickconnect.to`
       - Port: `443`
       - Enable HSTS: ✓
     - Destination:
       - Protocol: `HTTP`
       - Hostname: `localhost`
       - Port: `8081`

3. **Access remotely**:
   - Navigate to `https://your-nas-id.quickconnect.to/`
   - QuickConnect provides the SSL certificate automatically

**Security note**: The setup UI has no authentication layer. Only use QuickConnect during initial setup, then remove the reverse proxy rule and stop the setup-ui container.

Notes:
- `PLEX_CLAIM` is only needed for the initial Plex server claim; after Plex is claimed you can blank it out.
- This repo ignores `.env` via `.gitignore`.

### Deploy on DSM
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
