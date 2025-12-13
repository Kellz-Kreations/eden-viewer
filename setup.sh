#!/bin/bash
# Synology DS923+ Media Stack Setup Script

set -e
set -o pipefail
set -u

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default paths (allow override via environment)
STACK_PATH="${STACK_PATH:-/volume1/docker/eden-viewer}"
DATA_PATH="${DATA_PATH:-/volume1/data}"
APPDATA_PATH="${APPDATA_PATH:-/volume1/docker/appdata}"

# Compose file (allow override; default matches common Compose v2 naming)
COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml}"

# Use sudo only when not running as root (must be defined before first use; set -u is on)
SUDO="sudo"
if [[ "$(id -u)" -eq 0 ]]; then
    SUDO=""
fi

# Non-interactive confirmation
YES=false

# Detect Compose command (DSM varies) (requires SUDO to be defined)
COMPOSE_CMD=""
if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1 && $SUDO docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
fi

# Better error context (line + failing command)
trap 'echo -e "${RED}Error:${NC} Command failed on line ${BASH_LINENO[0]}: ${BASH_COMMAND}" >&2' ERR

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --dry-run            Show what would be done without making changes"
    echo "  -y, --yes                Non-interactive; assume 'yes' for prompts"
    echo "      --stack-path PATH    Override stack path (default: $STACK_PATH)"
    echo "      --data-path PATH     Override data path (default: $DATA_PATH)"
    echo "      --appdata-path PATH  Override appdata path (default: $APPDATA_PATH)"
    echo "  -f, --compose-file FILE  Override compose file name (default: $COMPOSE_FILE)"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "This script sets up the directory structure for Plex, Sonarr, and Radarr"
    echo "on a Synology DS923+ NAS."
}

log()  { printf "%b\n" "${GREEN}$*${NC}"; }
warn() { printf "%b\n" "${YELLOW}$*${NC}"; }
err()  { printf "%b\n" "${RED}$*${NC}" 1>&2; }

run() {
    if [[ "${DRY_RUN}" == true ]]; then
        echo "  Would run: $*"
    else
        # shellcheck disable=SC2086
        $SUDO "$@"
    fi
}

is_tty() { [[ -t 0 && -t 1 ]]; }

# Parse arguments (support multiple)
DRY_RUN=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--dry-run)
            DRY_RUN=true
            ;;
        -y|--yes)
            YES=true
            ;;
        --stack-path)
            STACK_PATH="${2:?Missing value for --stack-path}"
            shift
            ;;
        --data-path)
            DATA_PATH="${2:?Missing value for --data-path}"
            shift
            ;;
        --appdata-path)
            APPDATA_PATH="${2:?Missing value for --appdata-path}"
            shift
            ;;
        -f|--compose-file)
            COMPOSE_FILE="${2:?Missing value for --compose-file}"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            err "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
    shift
done

if [[ "${DRY_RUN}" == true ]]; then
    warn "[DRY RUN MODE - No changes will be made]"
    echo ""
fi

log "=== Synology Media Stack Setup ==="
echo ""

# Print plan early (UX)
echo "Plan:"
echo "  Stack path:   $STACK_PATH"
echo "  Data path:    $DATA_PATH"
echo "  Appdata path: $APPDATA_PATH"
echo "  Compose file: $COMPOSE_FILE"
echo "  Compose cmd:  ${COMPOSE_CMD:-<not found yet>}"
echo ""

# Optional UX hint: compose file isn't required for setup, but will be for deploy
if [[ ! -f "$STACK_PATH/$COMPOSE_FILE" ]]; then
    warn "Note: '$STACK_PATH/$COMPOSE_FILE' not found yet. Copy your compose file there before deploying."
    echo ""
fi

# Check if running on Synology DSM
if [[ ! -d "/volume1" ]]; then
    warn "Warning: /volume1 not found. Are you running this on a Synology NAS?"
    if [[ "${YES}" == true ]]; then
        warn "Continuing because --yes flag was supplied."
    elif is_tty; then
        read -r -p "Continue anyway? [y/N]: " reply
        if [[ ! "$reply" =~ ^[Yy]$ ]]; then
            err "Aborting at user request."
            exit 1
        fi
    else
        err "Non-interactive shell detected. Re-run with --yes to continue."
        exit 1
    fi
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    err "Error: Docker is not installed or not in PATH."
    echo "Install Docker via Synology Package Center before running this script."
    exit 1
fi

# Check if Docker Compose is available (v1 or v2)
if [[ -z "$COMPOSE_CMD" ]]; then
    err "Error: Docker Compose not found (neither 'docker-compose' nor 'docker compose')."
    echo "On DSM, ensure the Docker package is up to date in Package Center."
    exit 1
fi

# Create directory structure
echo "Creating directories..."
dirs=(
  "$DATA_PATH/media/movies"
  "$DATA_PATH/media/tv"
  "$APPDATA_PATH/plex"
  "$APPDATA_PATH/sonarr"
  "$APPDATA_PATH/radarr"
  "$STACK_PATH"
)
for d in "${dirs[@]}"; do
    run mkdir -p "$d"
done
if [[ "$DRY_RUN" != true ]]; then
    log "  Directories created."
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
run chown -R "${CURRENT_UID}:${CURRENT_GID}" "$APPDATA_PATH/plex" "$APPDATA_PATH/sonarr" "$APPDATA_PATH/radarr"
run chown -R "${CURRENT_UID}:${CURRENT_GID}" "$DATA_PATH/media"
if [[ "$DRY_RUN" != true ]]; then
    log "  Permissions set."
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Copy project files to: $STACK_PATH"
echo "  2. Edit .env with your PUID/PGID and timezone"
echo "  3. Deploy: cd $STACK_PATH && $SUDO $COMPOSE_CMD --env-file .env -f $COMPOSE_FILE up -d"
echo "  4. Verify: $SUDO $COMPOSE_CMD --env-file .env -f $COMPOSE_FILE ps"
echo ""
warn "Reminder: Regularly back up $APPDATA_PATH using Hyper Backup or Btrfs snapshots."
