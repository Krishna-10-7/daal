# D.A.A.L Project Explained in Simple English

## What this project is
D.A.A.L is a tool that checks Kubernetes YAML files and tells you what is wrong.
It works like a compiler:
1. It reads the text (lexer)
2. It understands the structure (parser)
3. It checks rules and logic (semantic analysis)

So instead of only checking YAML format, it also checks real DevOps mistakes.

## What the project can detect
The project can detect things like:
- Missing required fields like apiVersion, kind, metadata.name
- Broken references to ConfigMaps, Secrets, and Services
- Service selector mismatch
- Duplicate keys in YAML
- Security risks like privileged containers or runAsUser: 0
- Bad image tagging practices
- Secret-like values in plain text

## Main parts of the project
- CLI tool: run analysis from terminal
- Backend server: HTTP API endpoint at /compile
- VS Code extension: shows diagnostics inside editor
- Test fixtures: sample YAML files with known problems
- Deployment scripts: install and run on Azure VM

## What happened in this project (timeline)
1. Core analyzer and tests were built
2. npm package was published
3. VS Code extension was packaged and published
4. Backend was deployed on Azure VM
5. Caddy was used for HTTPS reverse proxy
6. Extension was updated to call server endpoint
7. Protocol mismatch was fixed (now uses text/yaml)
8. Version 0.1.2 was prepared and released
9. Presentation files were created for demo and explanation

## Azure deployment status
The backend is running on Azure VM and managed by systemd.
Caddy is running and serving HTTPS.
Server endpoint is working and returns diagnostics JSON.

## How to run locally
1. Install dependencies:
   npm install
2. Run tests:
   npm test
3. Start server:
   npm start
4. Test endpoint (example):
   curl -X POST http://localhost:3000/compile -H "Content-Type: text/yaml" -d "apiVersion: v1\nkind: Pod\nmetadata:\n  name: test"

## How to use the VS Code extension
1. Install extension
2. Open any .yaml or .yml file
3. Save file or click Run command
4. See warnings/errors in Problems panel

## Important real issue we found
There was a difference between local extension engine behavior and server behavior.
The server gives correct diagnostics for some fixtures, while live editor diagnostics can flash extra messages in one case.
This is known and can be fixed by aligning the bundled extension engine with server logic.

## Current outcome
- Project is functional
- Backend is deployed
- Extension is published and updated
- End-to-end flow works
- Documentation and presentation content are ready

## One-line summary
This project became a full working Kubernetes YAML analysis system with CLI, API, VS Code integration, Azure deployment, and publish-ready documentation.

## DAAL Code Meanings (Simple English)
These are the codes currently used by the analyzer.

- DAAL001: Missing apiVersion field
- DAAL002: Missing kind field
- DAAL003: Missing metadata.name field
- DAAL010: Duplicate Kubernetes resource (same kind/namespace/name already exists)
- DAAL011: Duplicate key in YAML map
- DAAL020: Service selector does not match any workload in the namespace

- DAAL030: Referenced ServiceAccount was not found
- DAAL040: Referenced ConfigMap in volume was not found
- DAAL041: Referenced Secret in volume was not found
- DAAL042: Referenced ConfigMap in envFrom was not found
- DAAL043: Referenced Secret in envFrom was not found
- DAAL044: Referenced ConfigMap in env.valueFrom was not found
- DAAL045: Referenced Secret in env.valueFrom was not found
- DAAL050: Referenced Service in Ingress backend was not found
- DAAL051: Referenced Service in Ingress rules/paths was not found

- DAAL101: hostNetwork is true (security risk)
- DAAL102: Container is privileged (security risk)
- DAAL103: allowPrivilegeEscalation is true (security risk)
- DAAL104: runAsUser is 0 (root user risk)
- DAAL105: Image tag missing or set to latest (security/best-practice risk)
- DAAL110: Secret-like pattern found in plain text

- DAAL200: Dependency cycle found between resources
- DAAL900: YAML parse/analyzer internal failure
- DAAL901: CLI runtime failure wrapper

## About DAAL005
Right now DAAL005 is not active in the current analyzer code.
So if you ask for DAAL005 meaning, the correct answer is: it is currently unused/reserved in this version.
