# PowerShell script to setup and start D.A.A.L on remote VM
# Usage: .\deploy\run_remote_setup.ps1
# Assumes:
#   - PEM file on Desktop at C:\Users\hp\Desktop\id_rsa.pem
#   - TLS cert/key at C:\Users\hp\Desktop\cert.pem and C:\Users\hp\Desktop\key.pem
#   - Repo already cloned on VM (e.g., /opt/daal)
#   - VM IP is 20.193.254.214
#   - SSH user is ubuntu (adjust below if needed)

param(
    [string]$VMUser = "ubuntu",
    [string]$VMIP = "20.193.254.214",
    [string]$PemPath = "C:\Users\hp\Desktop\id_rsa.pem",
    [string]$CertPath = "C:\Users\hp\Desktop\cert.pem",
    [string]$KeyPath = "C:\Users\hp\Desktop\key.pem",
    [string]$RepoDir = "/opt/daal"
)

$ErrorActionPreference = "Stop"

Write-Host "D.A.A.L Remote Setup Script" -ForegroundColor Green
Write-Host "VM: $VMIP | User: $VMUser | PEM: $PemPath"
Write-Host ""

# Verify PEM file exists
if (-not (Test-Path $PemPath)) {
    Write-Host "ERROR: PEM file not found at $PemPath" -ForegroundColor Red
    exit 1
}

# Verify cert/key exist
$hasCert = Test-Path $CertPath
$hasKey = Test-Path $KeyPath

if ($hasCert) {
    Write-Host "✓ Found TLS cert at $CertPath" -ForegroundColor Green
} else {
    Write-Host "⚠ TLS cert not found at $CertPath (optional)" -ForegroundColor Yellow
}

if ($hasKey) {
    Write-Host "✓ Found TLS key at $KeyPath" -ForegroundColor Green
} else {
    Write-Host "⚠ TLS key not found at $KeyPath (optional)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 1: Copy TLS files to VM..." -ForegroundColor Cyan

if ($hasCert) {
    Write-Host "  SCP cert.pem to $VMIP..."
    scp -i $PemPath $CertPath "${VMUser}@${VMIP}:/tmp/"
}

if ($hasKey) {
    Write-Host "  SCP key.pem to $VMIP..."
    scp -i $PemPath $KeyPath "${VMUser}@${VMIP}:/tmp/"
}

Write-Host ""
Write-Host "Step 2: Install certs, setup service, and start server..." -ForegroundColor Cyan

$remoteCommands = @"
set -euo pipefail
echo "=== Moving TLS certs to /etc/certs ==="
if [ -f /tmp/cert.pem ] && [ -f /tmp/key.pem ]; then
  sudo mkdir -p /etc/certs
  sudo mv /tmp/cert.pem /etc/certs/cert.pem
  sudo mv /tmp/key.pem  /etc/certs/key.pem
  sudo chown root:root /etc/certs/cert.pem /etc/certs/key.pem
  sudo chmod 644 /etc/certs/cert.pem
  sudo chmod 600 /etc/certs/key.pem
  echo "✓ Certs installed"
else
  echo "⚠ Cert files not found (Caddy may use default or self-signed)"
fi

echo ""
echo "=== Installing D.A.A.L systemd service ==="
cd $RepoDir
npm install --production 2>&1 | tail -5
sudo bash deploy/install_service.sh

echo ""
echo "=== Checking service status ==="
sudo systemctl status daal --no-pager

echo ""
echo "=== Restarting Caddy ==="
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager

echo ""
echo "=== Verifying endpoint ==="
curl -s http://localhost:3000/compile -X POST -H 'Content-Type: application/json' -d '{"text":"apiVersion: v1\nkind: Pod"}' | head -20
echo ""
echo "✓ Setup complete!"
"@

# Run remote commands via SSH
ssh -i $PemPath "${VMUser}@${VMIP}" $remoteCommands

Write-Host ""
Write-Host "Step 3: Verify endpoint from your workstation..." -ForegroundColor Cyan
Write-Host "  Testing https://${VMIP}/compile"

try {
    $response = curl -s -k "https://${VMIP}/compile" -X POST -H 'Content-Type: application/json' -d '{"text":"apiVersion: v1\nkind: Pod\nmetadata:\n  name: test"}'
    if ($response -match "diagnostics") {
        Write-Host "✓ Endpoint is responding with diagnostics" -ForegroundColor Green
    } else {
        Write-Host "⚠ Endpoint responded but format may differ:" -ForegroundColor Yellow
        Write-Host $response
    }
} catch {
    Write-Host "⚠ Could not verify endpoint (may be network/firewall): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Green
Write-Host "1. Configure VS Code extension setting:"
Write-Host '   "daal.serverUrl": "https://20.193.254.214/compile"'
Write-Host "2. Open a YAML file in VS Code"
Write-Host "3. Click the DAAL: Run button in the status bar or editor title"
Write-Host "4. Diagnostics should appear in the Problems panel"
Write-Host ""
Write-Host "Check VM logs with:"
Write-Host "  ssh -i $PemPath ${VMUser}@${VMIP} 'sudo journalctl -u daal -f'"
Write-Host ""
