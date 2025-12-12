# Media Server Stack for Synology NAS

**Turn your Synology DS923+ into a personal Netflix!**

This project helps you set up:
- 🎬 **Plex** - Stream your movies and TV shows to any device
- 📺 **Sonarr** - Automatically organize your TV show library
- 🎥 **Radarr** - Automatically organize your movie library

## What You Need

✅ A Synology DS923+ NAS (or similar model)  
✅ Docker installed on your NAS (via Container Manager)  
✅ Some media files (movies/TV shows) you want to organize

## What This Does

- Creates a web interface to manage your media library
- Organizes your files automatically with proper naming
- Lets you stream to phones, tablets, smart TVs, etc.
- All runs on your own hardware - no monthly subscriptions!

## Quick Start (Easiest Way)

**Step 1:** Download this project to your computer

**Step 2:** Open a terminal/PowerShell and run:
```bash
docker compose -f compose.setup.yaml up -d --build
```

**Step 3:** Open your web browser and go to:
```
http://localhost:8080
```
(If on a different computer, replace `localhost` with your NAS's IP address)

**Step 4:** Fill in the simple form and click **Start**

**Step 5:** Done! Access your services:
- Plex: `http://your-nas-ip:32400/web`
- Sonarr: `http://your-nas-ip:8989`
- Radarr: `http://your-nas-ip:7878`

## What's Happening Behind the Scenes?

The setup creates these folders on your NAS:
- `/volume1/docker/appdata/` - Where Plex/Sonarr/Radarr save their settings
- `/volume1/docker/transcode/` - Temporary files when converting videos
- `/volume1/data/media/movies` - Put your movie files here
- `/volume1/data/media/tv` - Put your TV show files here

## Need Help? Common Questions

**Q: What's a PUID/PGID?**  
A: These are just numbers that tell Docker which user owns the files. The setup wizard finds these automatically - you usually don't need to worry about them!

**Q: Do I need to set up anything manually?**  
A: Nope! The web setup wizard creates all the folders and settings for you.

**Q: Will this work on other Synology models?**  
A: Probably! It's designed for DS923+, but should work on most Synology NAS devices with Docker support.

**Q: Is this legal?**  
A: Yes! This is just software to organize and stream your own media files. What you do with it is up to you.

**Q: What if I want to stop everything?**  
A: Just run: `docker compose down`

## Advanced Options

<details>
<summary>Manual Setup (SSH Required)</summary>

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
