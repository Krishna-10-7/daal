#!/usr/bin/env bash
# Install systemd service for D.A.A.L and start it
set -euo pipefail

APP_DIR="/opt/daal"
SERVICE_NAME=daal
SERVICE_FILE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"

if [ "$EUID" -ne 0 ]; then
  echo "Run with sudo" >&2
  exit 1
fi

if [ ! -d "$APP_DIR" ]; then
  echo "$APP_DIR does not exist. Please clone or move the repo there first." >&2
  exit 1
fi

# Copy provided service file from repo deploy folder if present
if [ -f "$APP_DIR/deploy/daal.service" ]; then
  cp "$APP_DIR/deploy/daal.service" "$SERVICE_FILE_PATH"
else
  cat > "$SERVICE_FILE_PATH" <<'EOF'
[Unit]
Description=D.A.A.L Analysis Service
After=network.target

[Service]
Type=simple
User=nobody
WorkingDirectory=/opt/daal
ExecStart=/usr/bin/node src/js/server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
fi

systemctl daemon-reload
systemctl enable --now "$SERVICE_NAME"
systemctl status --no-pager "$SERVICE_NAME"

echo "Service installed and started. Check logs with: sudo journalctl -u ${SERVICE_NAME} -f"
