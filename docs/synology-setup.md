# Synology Setup Notes (DSM 7.x)

## Container Manager

- Use Container Manager Projects with Compose files for repeatability.
- Keep `docker-compose.yml` and `compose.yaml` in sync when you make edits so CLI and GUI deployments match.

## Networking

- Plex uses `network_mode: host` for simpler discovery and DLNA/companion features.
- The `plex-proxy` service runs Caddy in host networking to terminate HTTPS on 443 while forwarding to Plex on 32400.
- Sonarr/Radarr use a bridge network and publish ports to LAN.

> If you need remote access to Sonarr/Radarr, prefer VPN; otherwise put strong auth + TLS in front of any reverse proxy. Never forward 8989/7878 directly to the internet.

## TLS & Reverse Proxy

1. Set `PLEX_DOMAIN` (and optional `CADDY_ACME_EMAIL`) in `.env`. The domain must resolve to the NAS when requesting Let’s Encrypt certificates.
2. Forward ports **80** and **443** to the NAS or place the NAS behind a VPN/reverse-proxy that terminates those ports. Alternatively, publish via Synology Application Portal with a certificate.
3. Review `config/caddy/Caddyfile` if you need to add auth or tweak headers. Certificates and state live under `/volume1/docker/appdata/caddy`.
4. Keep Plex’s port 32400 restricted to LAN/VPN. Update firewall rules so only RFC1918 ranges reach Plex directly; everything else should arrive through Caddy.

Remember DS923+ lacks hardware transcoding, so TLS offload adds CPU load. Monitor `plex-proxy` container usage during high-traffic sessions and consider rate-limiting 4K transcodes if CPU becomes a bottleneck.

## Storage

- Keep a single data root (e.g. `/volume1/data`) and mount it as `/data` in *arr containers.
- Keep app configs in `/volume1/docker/appdata/<app>`.
- Add `/volume1/docker/appdata/caddy` to your backup plan to retain certificates.

## Performance

- Consider SSD/NVMe for Plex metadata if your DSM/storage setup supports it.
- Allocate a dedicated transcode folder with enough free space.
