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
- Print a clear "plan" up front (resolved paths, detected Docker Compose command).
- Avoid blocking prompts when stdin/stdout are not TTY; require explicit `--yes` to proceed.
- When using `set -u`, define variables like `SUDO` before any reference (including in Compose detection).

## Environment Variables

**Required `.env` variables:**

| Variable | Purpose | Example |
|----------|---------|---------|
| `PUID` | User ID for container processes | `1026` |
| `PGID` | Group ID for container processes | `100` |
| `TZ` | Timezone | `America/New_York` |
| `DATA_PATH` | Shared media root on host | `/volume1/data` |
| `APPDATA_PATH` | Container config root | `/volume1/docker/appdata` |

**Finding PUID/PGID on Synology:**
```bash
id <username>
```

## Health Checks & Monitoring

- Include `healthcheck` definitions in `docker-compose.yml` for each service.
- Use simple HTTP checks against each service's web UI port.
- Set reasonable intervals (60s) and timeouts (10s) to avoid false positives.
- Monitor container status via DSM's Docker UI or `docker ps`.
- Check logs at `/volume1/docker/appdata/<app>/logs` or via `docker logs <container>`.

## Troubleshooting Guidelines

**Common issues to address:**

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| Permission denied errors | PUID/PGID mismatch | Verify IDs match Synology user owning media folders |
| Container won't start | Port conflict | Check for existing services on ports 8989, 7878, 32400 |
| Slow library scans | Disk I/O bottleneck | Schedule scans during off-peak hours |
| High memory usage | Too many concurrent tasks | Limit import/scan workers in *arr settings |
| Plex buffering | Transcoding on Ryzen R1600 | Optimize for Direct Play; reduce remote streaming quality |

**Diagnostic commands:**
```bash
# Check container status
docker ps -a

# View container logs (last 100 lines)
docker logs --tail 100 <container_name>

# Check resource usage
docker stats --no-stream

# Verify volume mounts
docker inspect <container_name> | grep -A 10 "Mounts"
```

## Backup & Recovery

- Back up `/volume1/docker/appdata` regularly using Hyper Backup or Btrfs snapshots.
- Export *arr configurations via their System > Backup features.
- Store backups on a separate volume or off-site.
- Test recovery procedures periodically.
- Document the restore process in README.md.

**Recommended backup frequency:**
- Config databases: Daily
- Full appdata: Weekly
- Btrfs snapshot before major updates

## Updates & Maintenance

- Check Synology Package Center for Docker updates before updating containers.
- Pull new images during maintenance windows:
  ```bash
  docker-compose pull
  docker-compose up -d
  ```
- Review release notes for breaking changes before updating *arr apps.
- Create Btrfs snapshot before major version upgrades.
- Prune unused images periodically: `docker image prune -a`

## Performance Considerations

**DS923+ limitations:**
- 4GB RAM (expandable to 32GB) — monitor with `docker stats`
- Ryzen R1600 — no hardware transcoding; prioritize Direct Play
- 4-bay storage — balance RAID protection with capacity needs

**Optimization tips:**
- Limit concurrent downloads/imports in Sonarr/Radarr.
- Schedule library scans outside peak viewing hours.
- Use SSD cache for Docker volumes if available.
- Set Plex to "Make my CPU hurt" only if Direct Play fails.

## Security Best Practices

- Bind Sonarr/Radarr to LAN IPs only (avoid exposing to internet).
- Use strong, unique passwords for each service.
- Enable authentication on all web interfaces.
- If remote access is needed, use Synology VPN Server or Tailscale.
- Keep containers updated to patch vulnerabilities.
- Review DSM firewall rules periodically.

## Testing & Validation

**Before committing changes:**
- Validate `docker-compose.yml` syntax: `docker-compose config`
- Test scripts with `--dry-run` flag first.
- Verify environment variables resolve correctly.
- Check all services start and pass health checks.
- Confirm media libraries are accessible in each app.

**Validation checklist:**
- [ ] `.env` file contains all required variables
- [ ] Paths exist and have correct permissions
- [ ] Ports are not in use by other services
- [ ] Containers start without errors
- [ ] Web UIs are accessible on LAN
- [ ] Plex can see media libraries
- [ ] Sonarr/Radarr can write to media folders

Thank you for contributing to the Synology DS923+ media stack project!

