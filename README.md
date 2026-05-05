# D.A.A.L (DevOps Automation Analysis Layer)

D.A.A.L is a formal static analysis engine and Language Server for Kubernetes YAML configurations. It utilizes a true compiler-design architecture:
- **Front-end (JS)**: Lexical and Syntax Analysis
- **Analysis Engine (JS)**: Semantic Analysis, Cycle Detection, and Security Scanning
- **Optional Native Addon (C)**: Reserved for future performance-critical phases

## Architecture

This project is built using a Client-Server Architecture:
1. **D.A.A.L Server (`server.js`)**: A lightweight HTTP server that hosts the engine. It receives YAML payloads and returns diagnostics.
2. **D.A.A.L Client (`client-stub.js`)**: A mock IDE extension that demonstrates how a developer's editor would interact with the server in real-time.

## Setup

### Prerequisites
- Node.js

### Installation
```bash
npm install
```

### Running the Server
```bash
npm run start
```

### Running the IDE Client Stub
In another terminal:
```bash
node src/js/client-stub.js path/to/your/deployment.yaml
```

### API
- `POST /compile` body: raw YAML
- response: `{ success: true, diagnostics: [...] }`

### CLI
```bash
daal path/to/file-or-folder --exit-code
```

### VS Code Extension (Dev Mode)
- Open [vscode-extension](file:///c:/Users/hp/Desktop/product/daal/vscode-extension) in VS Code
- Press F5 to launch an Extension Development Host

## Hosting (Linux VM)

### Backend as a service (systemd)
1. Install Node.js LTS on the VM
2. Copy the project folder to the VM (or clone it)
3. Create a service user:
```bash
sudo useradd -r -s /usr/sbin/nologin daal || true
```
4. Create a systemd unit at `/etc/systemd/system/daal.service`:
```ini
[Unit]
Description=D.A.A.L backend
After=network.target

[Service]
Type=simple
User=daal
WorkingDirectory=/opt/daal
Environment=PORT=3000
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node /opt/daal/src/js/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```
5. Enable + start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now daal
sudo systemctl status daal
```

If you need to access the VM from your laptop, set `HOST=0.0.0.0` and put Nginx/Caddy in front for HTTPS. If a browser client needs to call it, set `CORS_ORIGIN` to your frontend origin.

## Distribution

### CLI
- Recommended: publish to npm so users can install with `npm i -g <package-name>`
- Alternative: zip the repository (or a minimal bundle) and share it via GitHub Releases

### VS Code Extension
- For demo: run in dev mode (F5)
- For sharing: package it into a VSIX (VS Code extension package) and share the VSIX file

### Optional Native Addon
```bash
npm run build
```
