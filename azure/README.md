# Eden Viewer – Azure VM Deployment Guide

> ⚠️ The Synology DS923+ stack remains the recommended deployment. Use this Azure VM guide only when you need a temporary remote instance running the same Plex/Sonarr/Radarr Docker Compose stack.

## Cost Snapshot (Central US)

| Item | Example SKU | Est. Monthly Cost* |
|------|-------------|--------------------|
| VM | Standard_D2s_v3 | $70 |
| 128 GB Premium SSD | P15 | $24 |
| 1 TB Standard HDD (data) | E10 | $45 |
| Public IP/DNS | Standard | $3 |
| **Approx. total** | | **~$140/month + egress** |

_*Pricing varies; use Azure Calculator for exact numbers._

## 1. Provision Azure Resources

```powershell
az group create --name rg-eden-viewer --location centralus

az vm create `
  --resource-group rg-eden-viewer `
  --name eden-viewer-vm `
  --location centralus `
  --image Ubuntu2204 `
  --size Standard_D2s_v3 `
  --os-disk-size-gb 128 `
  --public-ip-sku Standard `
  --admin-username azureuser `
  --generate-ssh-keys
```

Keep the output handy (public IP, NIC, NSG names).

## 2. Lock Down Networking

| Port | Use | Recommendation |
|------|-----|----------------|
| 22/TCP | SSH | Restrict to your IP (NSG rule) |
| 32400/TCP | Plex | Optional internet exposure |
| 7878/TCP | Radarr | **VPN-only** (do not expose) |
| 8989/TCP | Sonarr | **VPN-only** (do not expose) |

```powershell
# Allow Plex from anywhere
az vm open-port --resource-group rg-eden-viewer --name eden-viewer-vm --port 32400 --priority 100

# Allow SSH from a single IP
az network nsg rule create `
  --resource-group rg-eden-viewer `
  --nsg-name eden-viewer-vmNSG `
  --name Allow-SSH-MyIP `
  --priority 110 `
  --direction Inbound `
  --protocol Tcp `
  --source-address-prefixes <YOUR.IP.ADDR.0/32> `
  --destination-port-ranges 22 `
  --access Allow
```

Use Tailscale/WireGuard/Azure VPN Gateway when you need remote Sonarr/Radarr access.

## 3. Connect

```bash
ssh azureuser@<PUBLIC_IP>
```

(Optional) assign a DNS label:

```powershell
az network public-ip update `
  --resource-group rg-eden-viewer `
  --name eden-viewer-vmPublicIP `
  --dns-name viewer-kellzkreations

# FQDN: viewer-kellzkreations.centralus.cloudapp.azure.com
```

## 4. Install Docker Engine & Compose

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin

sudo usermod -aG docker azureuser
newgrp docker  # refresh group membership
sudo systemctl enable --now docker

docker --version
docker compose version
```

## 5. Prepare Directories

```bash
sudo mkdir -p /srv/eden-viewer/appdata/{plex,sonarr,radarr}
sudo mkdir -p /srv/eden-viewer/media/{movies,tv}
sudo chown -R azureuser:azureuser /srv/eden-viewer

mkdir -p ~/eden-viewer
```

## 6. Retrieve Project Files & Configure

```bash
cd ~/eden-viewer
git clone https://github.com/<your-repo>/eden-viewer.git .  # or scp from Synology

cp .env.example .env
nano .env
```

Example `.env` overrides for Azure:

```
PUID=1000
PGID=1000
TZ=America/New_York
DATA_PATH=/srv/eden-viewer
APPDATA_PATH=/srv/eden-viewer/appdata
```

Reuse your Synology media/appdata backups if desired (`rsync` or `scp`).

## 7. Deploy the Stack

```bash
cd ~/eden-viewer
docker compose pull
docker compose up -d

docker compose ps
```

## 8. Validate

- Plex: `http://<PUBLIC_IP>:32400/web`
- Sonarr/Radarr: tunnel via VPN → `http://<TUNNEL_IP>:8989` and `:7878`
- Logs: `docker compose logs -f plex` (swap service name)

Troubleshoot (`docker ps`, `docker logs <container>`, `systemctl status docker`) if services fail.

## 9. Optional: Custom DNS

```powershell
az network dns record-set a create --resource-group eden --zone-name kellzkreations.com --name viewer
az network dns record-set a add-record --resource-group eden --zone-name kellzkreations.com --record-set-name viewer --ipv4-address <PUBLIC_IP>
```

Flush local DNS or wait for TTL (default 3600 s).

## 10. Backups & Maintenance

- Snapshot VM disks: `az snapshot create ...`
- Export configs: `tar czf appdata-backup.tar.gz -C /srv/eden-viewer/appdata .`
- Update containers: `docker compose pull && docker compose up -d`
- System patches: `sudo apt update && sudo apt upgrade`
- Disable VM when idle: `az vm deallocate --resource-group rg-eden-viewer --name eden-viewer-vm`

Monitor costs (`az consumption usage list ...`) and remove unused resources:

```powershell
az group delete --name rg-eden-viewer --yes --no-wait
```

## Security Checklist

- Keep Sonarr/Radarr private (VPN or authenticated reverse proxy with TLS).
- Enable Plex account 2FA.
- Rotate Azure SSH keys and storage credentials.
- Monitor `docker compose logs` and `/var/log/syslog`.
- Consider Azure Firewall / Front Door for additional protection.

---

For everyday use, stay on the Synology DS923+ stack (direct play, Btrfs snapshots, Hyper Backup). Use this Azure VM guide only when remote hosting is absolutely required.
