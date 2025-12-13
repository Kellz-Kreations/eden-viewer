#!/bin/bash
# Synology DS923+ Media Stack - Full Deployment Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_PATH="/volume1/docker/eden-viewer"

echo "=== Synology Media Stack Deployment ==="
echo ""

# Check if running on Synology
if [[ ! -d "/volume1" ]]; then
    echo "Error: /volume1 not found. Run this script on your Synology NAS."
    exit 1
fi

# Run setup first
echo "Step 1: Running setup..."
bash "$SCRIPT_DIR/setup.sh"

# Copy files if not already in place
if [[ "$SCRIPT_DIR" != "$STACK_PATH" ]]; then
    echo ""
    echo "Step 2: Copying files to $STACK_PATH..."
    sudo cp "$SCRIPT_DIR/docker-compose.yml" "$STACK_PATH/"
    sudo cp "$SCRIPT_DIR/.env.example" "$STACK_PATH/.env.example"
    
    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        sudo cp "$SCRIPT_DIR/.env" "$STACK_PATH/"
    else
        sudo cp "$SCRIPT_DIR/.env.example" "$STACK_PATH/.env"
        echo "Created .env from template - please edit before deploying!"
    fi
fi

# Validate .env
echo ""
echo "Step 3: Validating configuration..."
cd "$STACK_PATH"
if grep -q "1026" .env; then
    echo "Warning: .env contains default PUID (1026). Verify this matches your user."
    id "$(whoami)"
fi

# Dry run
echo ""
echo "Step 4: Dry run (validating docker-compose)..."
sudo docker-compose config --quiet && echo "✓ Configuration valid"

# Deploy prompt
echo ""
read -r -p "Step 5: Deploy containers now? (y/N): " confirm
if [[ "$confirm" =~ ^[Yy]$ ]]; then
    echo "Deploying..."
    sudo docker-compose up -d
    echo ""
    echo "Step 6: Verifying deployment..."
    sleep 5
    sudo docker-compose ps
    echo ""
    echo "=== Deployment Complete ==="
    echo ""
    echo "Access your services:"
    NAS_IP=$(hostname -I | awk '{print $1}')
    echo "  Plex:   http://$NAS_IP:32400/web"
    echo "  Sonarr: http://$NAS_IP:8989"
    echo "  Radarr: http://$NAS_IP:7878"
else
    echo "Skipped. Run manually: cd $STACK_PATH && sudo docker-compose up -d"
fi
