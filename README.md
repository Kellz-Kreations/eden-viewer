# Synology DS923+ Media Stack

Docker Compose stack for Plex, Sonarr, and Radarr on Synology DS923+.

## Quick Deploy

```bash
# 1. SSH into your Synology
ssh your-user@NAS_IP

# 2. Create directory structure
sudo mkdir -p /volume1/data/media/{movies,tv}
sudo mkdir -p /volume1/docker/appdata/{plex,sonarr,radarr}
sudo mkdir -p /volume1/docker/eden-viewer

# 3. Copy files to NAS (run from your local machine)
# scp -r .env docker-compose.yml your-user@NAS_IP:/volume1/docker/eden-viewer/

# 4. Get your PUID/PGID (on NAS)
id $(whoami)
# Example output: uid=1026(youruser) gid=100(users)

# 5. Update .env with your PUID/PGID values

# 6. Deploy
cd /volume1/docker/eden-viewer
sudo docker-compose up -d

# 7. Verify
sudo docker-compose ps
```

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

> 💡 The setup UI now defaults to a dark theme (with light fallback for daylight readers).

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

## Resource Considerations

- DS923+ has 4GB RAM (upgradable)
- Limit concurrent streams in Plex
- Avoid transcoding when possible

## Testing Your Setup

### 1. Verify containers are running

```bash
ssh your-user@NAS_IP
cd /volume1/docker/eden-viewer
sudo docker-compose ps
```

Expected output:
```
NAME      STATUS         PORTS
plex      Up             (host network)
sonarr    Up             0.0.0.0:8989->8989/tcp
radarr    Up             0.0.0.0:7878->7878/tcp
```

### 2. Access from LAN

From any device on your home network:

| Service | URL                        |
|---------|----------------------------|
| Plex    | `http://NAS_IP:32400/web`  |
| Sonarr  | `http://NAS_IP:8989`       |
| Radarr  | `http://NAS_IP:7878`       |

> **⚠️ First-time setup:** Configure authentication in Sonarr/Radarr immediately via **Settings → General → Security**.

## Remote Access (Outside Your Home)

| Method | Steps | Exposes |
|--------|-------|---------|
| **Synology VPN** (Recommended) | Package Center → VPN Server → Configure OpenVPN → Connect from device | All services via LAN IPs |
| **Plex Remote Access** | Plex → Settings → Remote Access → Enable | Plex only (secure) |
| **Synology QuickConnect** | DSM only | ❌ Not for Docker containers |

### Setting Up Synology VPN

1. **DSM → Package Center → Install VPN Server**
2. Open VPN Server → **OpenVPN** → Enable
3. Export configuration file
4. Forward **UDP 1194** on your router to NAS IP
5. Import config into OpenVPN client (phone/laptop)
6. Connect → Access `http://NAS_LAN_IP:8989` etc.

### Plex Remote Access (Plex Only)

1. Open `http://NAS_IP:32400/web`
2. **Settings → Remote Access → Enable**
3. Verify "Fully accessible outside your network"
4. Access from anywhere via `https://app.plex.tv`

### ❌ Not Recommended

- Port forwarding Sonarr/Radarr directly to internet
- Exposing management UIs without VPN or TLS + authentication

## Accessing from Outside Your Home

### Recommended: Synology VPN Server

1. **DSM → Package Center → Install VPN Server**
2. Enable OpenVPN or L2TP/IPSec
3. Configure port forwarding on your router (UDP 1194 for OpenVPN)
4. Export config and connect from your device
5. Once connected, access services via LAN IP

### Plex Only: Built-in Remote Access

1. Open Plex → **Settings → Remote Access**
2. Enable and verify port 32400 is reachable
3. Access from anywhere via `https://app.plex.tv`

### ❌ Not Recommended

Exposing Sonarr/Radarr directly to the internet without VPN or reverse proxy with TLS + authentication.

## Troubleshooting

| Issue | Command / Solution |
|-------|-------------------|
| Container not starting | `sudo docker-compose logs [service]` |
| Permission denied | Verify PUID/PGID: `id $(whoami)` |
| Can't reach UI | Check firewall: DSM → Control Panel → Security → Firewall |
| Plex not finding media | Verify path: `sudo docker exec plex ls /data/media` |
| Port already in use | `sudo netstat -tlnp \| grep [port]` |

## Azure VM Deployment

If hosting on an Azure VM instead of Synology:

### 1. Create Azure VM

- **Size:** Standard B2s (2 vCPU, 4GB RAM) minimum
- **OS:** Ubuntu 22.04 LTS
- **Disk:** 64GB+ Premium SSD for OS, attach data disk for media

### 2. Install Docker

```bash
# SSH into your Azure VM
ssh azureuser@<VM_PUBLIC_IP>

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo systemctl enable docker

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Logout and back in for group changes
exit
```

### 3. Create directories

```bash
sudo mkdir -p /data/media/{movies,tv}
sudo mkdir -p /docker/appdata/{plex,sonarr,radarr}
sudo chown -R $USER:$USER /data /docker
```

### 4. Update `.env` for Azure

```env
PUID=1000
PGID=1000
TZ=UTC
DATA_PATH=/data
APPDATA_PATH=/docker/appdata
```

### 5. Deploy

```bash
git clone <your-repo> ~/eden-viewer
cd ~/eden-viewer
docker compose up -d
```

### 6. Configure Azure Network Security Group (NSG)

Allow inbound traffic for services:

| Service | Port  | Source        |
|---------|-------|---------------|
| Plex    | 32400 | Your IP / Any |
| Sonarr  | 8989  | Your IP only  |
| Radarr  | 7878  | Your IP only  |

```bash
# Azure CLI example (restrict Sonarr/Radarr to your IP)
az network nsg rule create \
  --resource-group <RG> \
  --nsg-name <NSG_NAME> \
  --name AllowPlex \
  --priority 100 \
  --destination-port-ranges 32400 \
  --access Allow

az network nsg rule create \
  --resource-group <RG> \
  --nsg-name <NSG_NAME> \
  --name AllowSonarr \
  --priority 110 \
  --destination-port-ranges 8989 \
  --source-address-prefixes <YOUR_PUBLIC_IP> \
  --access Allow
```

### 7. Access from Browser

| Service | URL |
|---------|-----|
| Plex    | `http://<VM_PUBLIC_IP>:32400/web` |
| Sonarr  | `http://<VM_PUBLIC_IP>:8989` |
| Radarr  | `http://<VM_PUBLIC_IP>:7878` |

### ⚠️ Azure Security Best Practices

1. **Restrict NSG rules** to your public IP only
2. **Enable authentication** in Sonarr/Radarr immediately
3. **Use Azure Bastion or VPN** for management access
4. **Consider Cloudflare Tunnel** or Azure Application Gateway with TLS for production

### Test connectivity

```bash
# From your local machine
curl -I http://<VM_PUBLIC_IP>:32400/web
curl -I http://<VM_PUBLIC_IP>:8989
curl -I http://<VM_PUBLIC_IP>:7878
```
