#!/usr/bin/env bash
# Install Node (uses NodeSource), install deps, and run the server once (dev mode)
set -euo pipefail

# Adjust NODE_VERSION if needed
NODE_VERSION=20
APP_DIR="/opt/daal"

echo "Running VM setup script"
if [ "$EUID" -ne 0 ]; then
  echo "This script should be run as root or with sudo. Re-run with sudo." >&2
  exit 1
fi

# Create app dir if missing
mkdir -p "$APP_DIR"
chown $SUDO_USER:$SUDO_USER "$APP_DIR" || true

# Install Node.js (NodeSource)
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js ${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs build-essential python3
else
  echo "Node is already installed: $(node -v)"
fi

# Pull application code (assumes repo already present, otherwise clone)
if [ ! -d "$APP_DIR/.git" ]; then
  echo "No git repo found at $APP_DIR. Cloning current repo into $APP_DIR"
  # You should replace the URL with your repo if necessary
  git clone https://github.com/Krishna-10-7/daal.git "$APP_DIR"
fi

cd "$APP_DIR"

# Install npm deps
echo "Installing npm dependencies..."
npm install --production || npm install

# Run server once (foreground) for testing
echo "Starting server in foreground (use Ctrl-C to stop)..."
node src/js/server.js

# End of script
