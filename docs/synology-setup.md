# Synology Setup Notes (DSM 7.x)

## Container Manager
- Use Container Manager Projects with Compose files for repeatability.

## Networking
- Plex uses `network_mode: host` for simpler discovery.
- Sonarr/Radarr use a bridge network and publish ports to LAN.

If you need remote access to Sonarr/Radarr, prefer VPN; otherwise put strong auth + TLS in front of any reverse proxy.

## Storage
- Keep a single data root (e.g. `/volume1/data`) and mount it as `/data` in *arr containers.
- Keep app configs in `/volume1/docker/appdata/<app>`.

## Performance
- Consider SSD/NVMe for Plex metadata if your DSM/storage setup supports it.
- Allocate a dedicated transcode folder with enough free space.
