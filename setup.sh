#!/bin/bash
# Synology DS923+ Media Stack Setup Script

set -e

# Default paths
STACK_PATH="/volume1/docker/eden-viewer"
DATA_PATH="/volume1/data"
APPDATA_PATH="/volume1/docker/appdata"

echo "=== Synology Media Stack Setup ==="

# Create directory structure
echo "Creating directories..."
sudo mkdir -p "$DATA_PATH/media/movies"
sudo mkdir -p "$DATA_PATH/media/tv"
sudo mkdir -p "$APPDATA_PATH/plex"
sudo mkdir -p "$APPDATA_PATH/sonarr"
sudo mkdir -p "$APPDATA_PATH/radarr"
sudo mkdir -p "$STACK_PATH"

# Get PUID/PGID
echo ""
echo "Your user info:"
id $(whoami)
echo ""
echo "Update .env with PUID/PGID from above before deploying."

# Set permissions
echo "Setting permissions..."
sudo chown -R $(id -u):$(id -g) "$APPDATA_PATH"
sudo chown -R $(id -u):$(id -g) "$DATA_PATH/media"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy project files to: $STACK_PATH"
echo "  2. Edit .env with your PUID/PGID and timezone"
echo "  3. Deploy: cd $STACK_PATH && sudo docker-compose up -d"
echo "  4. Verify: sudo docker-compose ps"
