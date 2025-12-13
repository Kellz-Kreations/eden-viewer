#!/bin/bash
# Synology DS923+ Media Stack Setup Script

set -e
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default paths (allow override via environment)
STACK_PATH="${STACK_PATH:-/volume1/docker/eden-viewer}"
DATA_PATH="${DATA_PATH:-/volume1/data}"
APPDATA_PATH="${APPDATA_PATH:-/volume1/docker/appdata}"

# Use sudo only when not running as root
SUDO="sudo"
if [[ "$(id -u)" -eq 0 ]]; then
    SUDO=""
fi

# Detect Compose command (DSM varies)
COMPOSE_CMD=""
if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1 && $SUDO docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
fi

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --dry-run    Show what would be done without making changes"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "This script sets up the directory structure for Plex, Sonarr, and Radarr"
    echo "on a Synology DS923+ NAS."
}

# Parse arguments
DRY_RUN=false
case "$1" in
    -n|--dry-run)
        DRY_RUN=true
        echo -e "${YELLOW}[DRY RUN MODE - No changes will be made]${NC}"
        echo ""
        ;;
    -h|--help)
        usage
        exit 0
        ;;
    "")
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        usage
        exit 1
        ;;
esac

echo -e "${GREEN}=== Synology Media Stack Setup ===${NC}"
echo ""

# Check if running on Synology DSM
if [[ ! -d "/volume1" ]]; then
    echo -e "${YELLOW}Warning: /volume1 not found. Are you running this on a Synology NAS?${NC}"
    read -p "Continue anyway? (y/N): " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH.${NC}"
    echo "Install Docker via Synology Package Center before running this script."
    exit 1
fi

# Check if Docker Compose is available (v1 or v2)
if [[ -z "$COMPOSE_CMD" ]]; then
    echo -e "${RED}Error: Docker Compose not found (neither 'docker-compose' nor 'docker compose').${NC}"
    echo "On DSM, ensure the Docker package is up to date in Package Center."
    exit 1
fi

# Create directory structure
echo "Creating directories..."
if [[ "$DRY_RUN" == true ]]; then
    echo "  Would create: $DATA_PATH/media/movies"
    echo "  Would create: $DATA_PATH/media/tv"
    echo "  Would create: $APPDATA_PATH/plex"
    echo "  Would create: $APPDATA_PATH/sonarr"
    echo "  Would create: $APPDATA_PATH/radarr"
    echo "  Would create: $STACK_PATH"
else
    $SUDO mkdir -p "$DATA_PATH/media/movies"
    $SUDO mkdir -p "$DATA_PATH/media/tv"
    $SUDO mkdir -p "$APPDATA_PATH/plex"
    $SUDO mkdir -p "$APPDATA_PATH/sonarr"
    $SUDO mkdir -p "$APPDATA_PATH/radarr"
    $SUDO mkdir -p "$STACK_PATH"
    echo -e "${GREEN}  Directories created.${NC}"
fi

# Get PUID/PGID
echo ""
echo "Your user info:"
id "$(id -un)"
echo ""
echo -e "${YELLOW}Update .env with PUID/PGID from above before deploying.${NC}"

CURRENT_UID="$(id -u)"
CURRENT_GID="$(id -g)"

# Set permissions (only for this stack's paths)
echo ""
echo "Setting permissions..."
if [[ "$DRY_RUN" == true ]]; then
    echo "  Would chown: $APPDATA_PATH/{plex,sonarr,radarr} to ${CURRENT_UID}:${CURRENT_GID}"
    echo "  Would chown: $DATA_PATH/media to ${CURRENT_UID}:${CURRENT_GID}"
else
    $SUDO chown -R "${CURRENT_UID}:${CURRENT_GID}" "$APPDATA_PATH/plex" "$APPDATA_PATH/sonarr" "$APPDATA_PATH/radarr"
    $SUDO chown -R "${CURRENT_UID}:${CURRENT_GID}" "$DATA_PATH/media"
    echo -e "${GREEN}  Permissions set.${NC}"
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Copy project files to: $STACK_PATH"
echo "  2. Edit .env with your PUID/PGID and timezone"
echo "  3. Deploy: cd $STACK_PATH && $SUDO $COMPOSE_CMD up -d"
echo "  4. Verify: $SUDO $COMPOSE_CMD ps"
echo ""
echo -e "${YELLOW}Reminder: Regularly back up $APPDATA_PATH using Hyper Backup or Btrfs snapshots.${NC}"
