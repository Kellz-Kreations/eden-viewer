# Eden Viewer - Synology DS923+ Media Stack

A Docker Compose stack for Plex, Sonarr, and Radarr on Synology DS923+ NAS.

## Requirements

- Synology DS923+ (or compatible NAS with DSM 7.x)
- Docker package installed via Package Center
- Btrfs file system (recommended)

## Quick Start

```bash
# 1. Run setup script (use --dry-run first to preview)
./setup.sh --dry-run
./setup.sh

# 2. Configure environment
cp .env.example .env
nano .env  # Set PUID, PGID, TZ

# 3. Get Plex claim token (first-time setup only)
#    Visit https://www.plex.tv/claim/ and copy the token
#    Add to .env: PLEX_CLAIM=claim-xxxxxxxxxxxxxxxxxxxx
#    Token expires in 4 minutes - deploy quickly!

# 4. Deploy
sudo docker-compose up -d

# 5. Verify
sudo docker-compose ps
```

## Services & Ports

| Service | Port | URL |
|---------|------|-----|
| Plex (LAN fallback) | 32400 | `http://<NAS-IP>:32400/web` *(VPN/LAN only)* |
| Plex (TLS) | 443 | `https://<PLEX_DOMAIN>` |
| Sonarr | 8989 | `http://<NAS-IP>:8989` |
| Radarr | 7878 | `http://<NAS-IP>:7878` |

## Directory Structure

```text
/volume1/
├── data/
│   └── media/
│       ├── movies/    # Radarr managed
│       └── tv/        # Sonarr managed
└── docker/
    ├── appdata/
    │   ├── plex/      # Plex config & database
    │   ├── sonarr/    # Sonarr config
    │   └── radarr/    # Radarr config
    └── eden-viewer/   # This stack
```

## HTTPS & Reverse Proxy

We terminate HTTPS in front of Plex with a lightweight Caddy reverse proxy while Plex keeps listening on port **32400** for LAN clients and companion apps.

1. Set `PLEX_DOMAIN` and (optionally) `CADDY_ACME_EMAIL` in `.env`. The domain must resolve to your NAS public IP when requesting certificates.
2. Ensure ports **80** and **443** forward to the NAS or sit behind a VPN/reverse-proxy appliance that supports ACME HTTP-01 validation. Synology Application Portal or your edge firewall can proxy 80/443 if you do not forward directly.
3. Confirm `/volume1/docker/appdata/caddy` exists (created on first run) so certificates persist. Back this path up along with the rest of `/volume1/docker/appdata` before editing certificates.
4. Deploy with `docker compose up -d` (or Container Manager Project). The new `plex-proxy` service issues/renews certificates automatically and proxies traffic to Plex on 32400.

> **Legacy access:** Keep Plex’s port 32400 open only to trusted LAN or VPN networks. Do **not** expose 32400 directly to the internet once HTTPS on 443 is available.

## Remote Access

### Plex Remote Access (Built-in + TLS)

- For LAN/VPN clients, use `https://<PLEX_DOMAIN>` (terminates in Caddy on port 443) or `http://<NAS-IP>:32400/web` while on trusted networks.
- Plex still supports the built-in remote access workflow. Confirm remote access in Plex settings **after** the `plex-proxy` service finishes certificate provisioning so Plex sees the correct external URL.
- Legacy clients that insist on HTTP fallback continue working through the proxy thanks to the `X-Plex-Device` header handling.

### Sonarr/Radarr Remote Access (VPN Recommended)

**Do not expose Sonarr/Radarr directly to the internet.** Use one of these secure methods:

#### Option 1: Tailscale (Easiest)

```bash
# Install Tailscale on your NAS via Community Package
# Then on your remote device, install Tailscale and connect
# Access via Tailscale IP: http://100.x.x.x:8989
```

#### Option 2: Synology VPN Server

1. Install **VPN Server** from Package Center
2. Configure OpenVPN or L2TP/IPSec
3. Connect from remote device to your home VPN
4. Access services via LAN IP

#### Option 3: WireGuard (Advanced)

```bash
# Install WireGuard via Docker or community package
# Configure peer connections
# Access via WireGuard tunnel IP
```

### Security Best Practices

- ✅ Use VPN for remote access to Sonarr/Radarr
- ✅ Keep Plex remote access for streaming only
- ✅ Enable 2FA on Plex account
- ❌ Don't port-forward Sonarr/Radarr (8989, 7878)
- ❌ Don't expose management interfaces to internet

## DS923+ Considerations

- **No hardware transcoding**: Ryzen R1600 lacks Quick Sync; optimize for Direct Play
- **RAM**: 4GB stock; consider upgrade if running additional services
- **Storage**: Use Btrfs for snapshots and data integrity

## Backups

Regularly back up your configuration:

```bash
# Using Hyper Backup (recommended)
# Back up: /volume1/docker/appdata

# Or manual Btrfs snapshot
sudo btrfs subvolume snapshot /volume1/docker/appdata /volume1/docker/appdata-backup-$(date +%Y%m%d)
```

## Maintenance

```bash
# View logs
sudo docker-compose logs -f plex
sudo docker-compose logs -f sonarr
sudo docker-compose logs -f radarr

# Update containers
sudo docker-compose pull
sudo docker-compose up -d

# Check for Docker updates in Package Center
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Permission denied | Check PUID/PGID in `.env` matches your user |
| Container won't start | Check logs: `sudo docker-compose logs <service>` |
| Can't access web UI | Verify ports aren't blocked by DSM firewall |

---

> **Note**: For Azure-hosted deployment, see the [azure/](./azure/) directory.
