````instructions
# Synology DS923+ Media Stack - Quick Start Guide

This guide provides a streamlined setup for Plex, Sonarr, and Radarr on your Synology DS923+ using Docker Compose.

## Prerequisites

- Synology DS923+ with DSM 7.1+
- Docker and Docker Compose installed
- Basic knowledge of SSH and command line usage

## 1. Prepare Your Synology

- Ensure your DSM is up to date.
- Install Docker from the Package Center.
- Enable SSH for terminal access (Control Panel > Terminal & SNMP).

## 2. Create Directories

SSH into your Synology and run:
```bash
mkdir -p /volume1/docker/appdata/plex
mkdir -p /volume1/docker/appdata/sonarr
mkdir -p /volume1/docker/appdata/radarr
```

## 3. Set Permissions

Adjust permissions for the `docker` group:
```bash
sudo chown -R $USER:docker /volume1/docker/appdata
```

## 4. Create a Docker Network

Create a dedicated Docker network for the media stack:
```bash
docker network create media-stack
```

## 5. Deploy Plex

Create a `docker-compose.yml` in `/volume1/docker/appdata/plex` with the following content:
```yaml
version: '3.8'
services:
  plex:
    image: plexinc/pms-docker
    container_name: plex
    network_mode: "host"
    environment:
      - PUID=1026
      - PGID=100
      - VERSION=docker
    volumes:
      - /volume1/docker/appdata/plex:/config
      - /volume1/data:/data
    restart: unless-stopped
```

Start Plex:
```bash
cd /volume1/docker/appdata/plex
docker-compose up -d
```

## 6. Deploy Sonarr

Create a `docker-compose.yml` in `/volume1/docker/appdata/sonarr` with the following content:
```yaml
version: '3.8'
services:
  sonarr:
    image: ghcr.io/linuxserver/sonarr
    container_name: sonarr
    network_mode: "host"
    environment:
      - PUID=1026
      - PGID=100
      - TZ=America/New_York
    volumes:
      - /volume1/docker/appdata/sonarr:/config
      - /volume1/data:/data
    restart: unless-stopped
```

Start Sonarr:
```bash
cd /volume1/docker/appdata/sonarr
docker-compose up -d
```

## 7. Deploy Radarr

Create a `docker-compose.yml` in `/volume1/docker/appdata/radarr` with the following content:
```yaml
version: '3.8'
services:
  radarr:
    image: ghcr.io/linuxserver/radarr
    container_name: radarr
    network_mode: "host"
    environment:
      - PUID=1026
      - PGID=100
      - TZ=America/New_York
    volumes:
      - /volume1/docker/appdata/radarr:/config
      - /volume1/data:/data
    restart: unless-stopped
```

Start Radarr:
```bash
cd /volume1/docker/appdata/radarr
docker-compose up -d
```

## 8. Accessing the Applications

- Plex: `http://<your-synology-ip>:32400`
- Sonarr: `http://<your-synology-ip>:8989`
- Radarr: `http://<your-synology-ip>:7878`

## 9. Setting Up Reverse Proxy (Optional)

For secure remote access, set up a reverse proxy with DSM's Application Portal:
- Enable Web Station and PHP 7.4+.
- Create reverse proxy rules for Plex, Sonarr, and Radarr.

## 10. Regular Maintenance

- Back up `/volume1/docker/appdata` regularly.
- Monitor container logs and performance.
- Update Docker images and containers as needed.

## Troubleshooting Tips

- Check container status: `docker ps -a`
- View logs: `docker logs <container_name>`
- Resource usage: `docker stats`

For detailed troubleshooting, refer to the [Docker documentation](https://docs.docker.com/engine/reference/commandline/cli/).

Thank you for using the Synology DS923+ Media Stack Quick Start Guide!
````

