#!/bin/bash
# Synology DS923+ Media Stack - Full Deployment Script

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { printf "%b\n" "${GREEN}$*${NC}"; }
warn() { printf "%b\n" "${YELLOW}$*${NC}"; }
err()  { printf "%b\n" "${RED}$*${NC}" 1>&2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_PATH="${STACK_PATH:-/volume1/docker/eden-viewer}"
APPDATA_PATH="${APPDATA_PATH:-/volume1/docker/appdata}"
DATA_PATH="${DATA_PATH:-/volume1/data}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env}"

SUDO="sudo"
if [[ "$(id -u)" -eq 0 ]]; then
    SUDO=""
fi

COMPOSE_CMD=""
if command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
elif command -v docker >/dev/null 2>&1 && $SUDO docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
fi

usage() {
    cat <<USAGE
Usage: ${0##*/} [options]

Options:
  -n, --dry-run            Show what would be executed without making changes
  -y, --yes                Assume "yes" for prompts (non-interactive)
      --stack-path PATH    Override stack destination (default: $STACK_PATH)
      --compose-file FILE  Override compose file name (default: $COMPOSE_FILE)
      --env-file FILE      Override env file name (default: $ENV_FILE)
      --data-path PATH     Override media data path (default: $DATA_PATH)
      --appdata-path PATH  Override appdata root (default: $APPDATA_PATH)
  -h, --help               Show this help message
USAGE
}

run() {
    if [[ "${DRY_RUN}" == true ]]; then
        echo "  Would run: $*"
    else
        # shellcheck disable=SC2086
        $SUDO "$@"
    fi
}

is_tty() { [[ -t 0 && -t 1 ]]; }

DRY_RUN=false
YES=false

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
        --compose-file)
            COMPOSE_FILE="${2:?Missing value for --compose-file}"
            shift
            ;;
        --env-file)
            ENV_FILE="${2:?Missing value for --env-file}"
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

trap 'echo -e "${RED}Error:${NC} Command failed on line ${BASH_LINENO[0]}: ${BASH_COMMAND}" >&2' ERR

echo "=== Synology Media Stack Deployment ==="
echo ""

echo "Plan:"
echo "  Stack path:   $STACK_PATH"
echo "  Compose file: $COMPOSE_FILE"
echo "  Env file:     $ENV_FILE"
echo "  Data path:    $DATA_PATH"
echo "  Appdata path: $APPDATA_PATH"
echo "  Compose cmd:  ${COMPOSE_CMD:-<not found>}"
echo ""

if [[ ! -d "/volume1" ]]; then
    warn "Warning: /volume1 not found. Are you running on your Synology NAS?"
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

if ! command -v docker >/dev/null 2>&1; then
    err "Docker not found. Install Docker via Synology Package Center first."
    exit 1
fi

if [[ -z "$COMPOSE_CMD" ]]; then
    err "Docker Compose not found (docker-compose or docker compose)."
    exit 1
fi

STACK_COMPOSE_PATH="$STACK_PATH/$COMPOSE_FILE"

echo "Step 1: Running setup..."
SETUP_ARGS=("$SCRIPT_DIR/setup.sh")
[[ "${DRY_RUN}" == true ]] && SETUP_ARGS+=("--dry-run")
[[ "${YES}" == true ]] && SETUP_ARGS+=("--yes")
bash "${SETUP_ARGS[@]}"

if [[ "$SCRIPT_DIR" != "$STACK_PATH" ]]; then
    echo ""
    echo "Step 2: Copying files to $STACK_PATH..."
    run mkdir -p "$STACK_PATH"
    if [[ -f "$SCRIPT_DIR/$COMPOSE_FILE" ]]; then
        run cp "$SCRIPT_DIR/$COMPOSE_FILE" "$STACK_COMPOSE_PATH"
    else
        warn "Compose file '$COMPOSE_FILE' not found in $SCRIPT_DIR."
    fi

    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        run cp "$SCRIPT_DIR/.env" "$STACK_PATH/$ENV_FILE"
    else
        run cp "$SCRIPT_DIR/.env.example" "$STACK_PATH/$ENV_FILE"
        warn "Created $ENV_FILE from template - edit before deploying."
    fi

    if [[ -f "$SCRIPT_DIR/.env.example" ]]; then
        run cp "$SCRIPT_DIR/.env.example" "$STACK_PATH/.env.example"
    fi
fi

echo ""
echo "Step 3: Validating configuration..."
if [[ ! -f "$STACK_PATH/$ENV_FILE" ]]; then
    warn "Environment file '$ENV_FILE' not found at $STACK_PATH."
else
    if grep -q "^PUID=1026" "$STACK_PATH/$ENV_FILE"; then
        warn "'$ENV_FILE' still contains default PUID (1026). Update it to match your DSM user."
        id "$(id -un)"
    fi
fi

echo ""
echo "Step 4: Checking compose syntax..."
if [[ -f "$STACK_COMPOSE_PATH" ]]; then
    (cd "$STACK_PATH" && $SUDO $COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet)
    log "  ✓ Compose file validated"
else
    warn "Compose file '$STACK_COMPOSE_PATH' not found. Skipping validation."
fi

echo ""
echo "Step 5: Deploy containers?"
deploy_choice=""
if [[ "${DRY_RUN}" == true ]]; then
    echo "  Dry run requested - skipping deployment."
elif [[ "${YES}" == true ]]; then
    deploy_choice="Y"
else
    if is_tty; then
        read -r -p "Deploy now? [y/N]: " deploy_choice
    else
        err "Non-interactive shell detected. Re-run with --yes to deploy automatically."
        exit 1
    fi
fi

if [[ "${DRY_RUN}" == true || ! "$deploy_choice" =~ ^[Yy]$ ]]; then
    echo "Skipped. Run manually: cd $STACK_PATH && $SUDO $COMPOSE_CMD --env-file $ENV_FILE -f $COMPOSE_FILE up -d"
    exit 0
fi

echo "Deploying..."
$SUDO $COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
echo ""
echo "Step 6: Verifying deployment..."
sleep 5
$SUDO $COMPOSE_CMD --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
echo ""
echo "=== Deployment Complete ==="
echo ""

if command -v hostname >/dev/null 2>&1; then
    NAS_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    if [[ -n "${NAS_IP:-}" ]]; then
        echo "Access your services:"
        echo "  Plex:   http://$NAS_IP:32400/web"
        echo "  Sonarr: http://$NAS_IP:8989"
        echo "  Radarr: http://$NAS_IP:7878"
        echo ""
    fi
fi

echo "Remember to back up $APPDATA_PATH and your media library using Hyper Backup or Btrfs snapshots."
