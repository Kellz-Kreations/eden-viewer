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

</details>

<details>
<summary>PowerShell Setup Script (Alternative)</summary>

```powershell
pwsh -NoProfile -File .\scripts\setup.ps1
```

The script will ask you questions and generate your configuration file.

</details>

<details>
<summary>Using Synology Container Manager</summary>

1. Copy `.env.example` to `.env` and edit the values
2. Open Synology **Container Manager**
3. Click: Project → Create → Import
4. Select this folder and deploy `compose.yaml`

</details>

## Important Technical Notes

**DS923+ Hardware:**  
The DS923+ uses an AMD Ryzen R1600 processor and does **not** have Intel Quick Sync for hardware video transcoding. For best performance, use files that can Direct Play (don't need conversion).

**Folder Structure:**  
Using a single `/data` folder for everything makes file moves fast and avoids path mapping headaches.

## Managing Your Server

**Update everything:**
```bash
docker compose pull
docker compose up -d
```

**Stop everything:**
```bash
docker compose down
```

**View logs:**
```bash
docker compose logs -f
```

## What to Back Up

These folders are small but critical (they contain all your settings):
- `/volume1/docker/appdata/plex`
- `/volume1/docker/appdata/sonarr`
- `/volume1/docker/appdata/radarr`

Your media files (`/volume1/data/media/`) should be backed up based on your own backup plan.

## Adding Your Media to Plex

After setup, add libraries in Plex using these paths:
- **Movies:** `/data/media/movies`
- **TV Shows:** `/data/media/tv`

---

**Questions? Issues?** Check [TESTING.md](TESTING.md) for troubleshooting steps or open an issue on GitHub!
