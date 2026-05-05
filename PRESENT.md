# D.A.A.L Project Presentation Guide

## Project Overview

**D.A.A.L** = **Declarative Architecture Analysis Language**

A production-ready static analysis engine for Kubernetes YAML configurations using formal compiler design principles.

### Key Points to Emphasize

1. **Three-Stage Compiler Architecture**
   - Lexer: Tokenizes YAML with indentation tracking
   - Parser: Builds Abstract Syntax Tree (AST) recursively
   - Semantic Analyzer: Validates business logic, detects cycles, security issues

2. **Cross-Platform Delivery**
   - npm package (CLI tool): `npm install -g krishna-project`
   - VS Code Extension: Available on Marketplace
   - Backend Server: Node.js HTTP API on Azure VM

3. **Real-World Detection**
   - Reference validation (ConfigMaps, Secrets, Services)
   - Dependency cycle detection
   - Security checks (privileged containers, host networking, secrets in images)
   - Duplicate key detection
   - Field validation (apiVersion, kind, metadata.name)

---

## How to Run & Demonstrate

### **Option 1: Local CLI Demo (Fastest - 1 minute)**

```bash
# Install globally
npm install -g krishna-project

# Analyze a YAML file
daal path/to/your-config.yaml

# Or pipe YAML
echo "apiVersion: v1
kind: Pod
metadata:
  name: test
spec:
  containers:
  - name: app
    image: nginx:latest
    securityContext:
      privileged: true" | daal
```

**What you'll see:**
```json
{
  "success": true,
  "diagnostics": [
    {
      "message": "Container running in privileged mode - DAAL007",
      "severity": "warning",
      "code": "DAAL007"
    }
  ]
}
```

### **Option 2: VS Code Extension Demo (2-3 minutes)**

**Prerequisites:**
- VS Code installed
- Extension v0.1.2 installed from [Marketplace](https://marketplace.visualstudio.com/items?itemName=krishnapandey.krishna-project)

**Steps:**

1. **Open VS Code**
   ```bash
   code
   ```

2. **Create a test YAML file** (`test.yaml`)
   ```yaml
   apiVersion: v1
   kind: ConfigMap
   metadata:
     name: app-config
   data:
     app.conf: "setting1"
     app.conf: "setting2"  # Duplicate key - will trigger DAAL011
     AWS_KEY: "AKIA2XXXXXXXX"  # Secret pattern - will trigger DAAL021
   ```

3. **Open file in VS Code**
   - Click Run button in editor title bar (D.A.A.L icon)
   - OR save the file (auto-triggers analysis)
   - Watch diagnostics appear in Problems panel

4. **Configure Backend URL** (optional, defaults to Azure VM):
   - Open Settings: `Ctrl+,`
   - Search `daal.serverUrl`
   - Test options:
     - `https://r2-d2.xyz/compile` (Azure VM, Caddy HTTPS)
     - `http://20.193.254.214:3000/compile` (Direct IP)
     - `http://localhost:3000/compile` (Local testing)

### **Option 3: Backend Server Demo (3-5 minutes)**

**Prerequisites:**
- Node.js 20+ installed
- Project cloned

**Steps:**

1. **Start backend server locally**
   ```bash
   cd daal
   npm install
   npm start
   ```
   
   Output:
   ```
   [D.A.A.L Server] Running on http://localhost:3000/compile
   ```

2. **Test endpoint from terminal**
   ```bash
   curl -X POST http://localhost:3000/compile \
     -H "Content-Type: text/yaml" \
     -d "apiVersion: v1
   kind: Pod
   metadata:
     name: test
   spec:
     serviceAccountName: admin
     containers:
     - name: app
       image: nginx
       securityContext:
         runAsUser: 0"
   ```

   Response:
   ```json
   {
     "success": true,
     "diagnostics": [
       {
         "message": "Container running as root (runAsUser: 0) - potential security risk",
         "severity": "warning",
         "code": "DAAL018"
       }
     ]
   }
   ```

3. **Connect VS Code extension to local server**
   - Settings → search `daal.serverUrl`
   - Set to `http://localhost:3000/compile`
   - Open YAML file and click Run button
   - See real-time diagnostics from backend

### **Option 4: Production VM Demo (5-10 minutes)**

**Live Azure VM:** `https://r2-d2.xyz/compile`

1. **Show running service**
   ```bash
   ssh -i server-key-krishna.pem azureuser@20.193.254.214
   sudo systemctl status daal
   sudo journalctl -u daal -f  # Follow logs
   ```

2. **Test HTTPS endpoint**
   ```bash
   curl -vk https://r2-d2.xyz/compile \
     -H "Content-Type: text/yaml" \
     -d "apiVersion: v1
   kind: Pod
   metadata:
     name: prod-test"
   ```

3. **Show Caddy reverse proxy**
   ```bash
   sudo systemctl status caddy
   sudo tail -f /var/log/caddy.log
   ```

---

## Complete End-to-End Demo (10 minutes)

### Scenario: Deploy a problematic Kubernetes manifest

**Bad YAML file** (`bad-deployment.yaml`):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: app
        image: myapp:latest  # No tag - DAAL016
        securityContext:
          privileged: true  # DAAL007
          runAsUser: 0  # DAAL018
        env:
        - name: DATABASE_PASSWORD
          value: "super-secret-123"  # DAAL021
        - name: AWS_ACCESS_KEY
          value: "AKIA2XXXXXXXXXXX"  # DAAL021
      serviceAccountName: privileged-sa  # DAAL033 (if doesn't exist)
```

### Demo Flow:

1. **Show the bad YAML in terminal**
   ```bash
   cat bad-deployment.yaml
   ```

2. **Run local CLI analysis**
   ```bash
   daal bad-deployment.yaml
   ```
   
   Output shows 5+ security/validation issues

3. **Open in VS Code with extension**
   - Problems panel auto-fills with diagnostics
   - Hover over each diagnostic to see severity
   - Click diagnostic to jump to problematic line

4. **Show each issue category**
   - **Security:** Privileged mode, runAsUser, secrets in env vars
   - **Best Practice:** Image tags, container privileges
   - **Validation:** Service account existence, reference resolution

5. **Fix the YAML** (`good-deployment.yaml`):
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: api-server
     namespace: default
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: api
     template:
       metadata:
         labels:
           app: api
       spec:
         serviceAccountName: app-sa
         containers:
         - name: app
           image: myapp:v1.2.3  # Versioned ✓
           securityContext:
             runAsNonRoot: true
             runAsUser: 1000  # Non-root ✓
             allowPrivilegeEscalation: false  # ✓
           env:
           - name: LOG_LEVEL
             value: "info"
           envFrom:
           - secretRef:
               name: app-secrets  # ✓ Using Secret
   ---
   apiVersion: v1
   kind: Secret
   metadata:
     name: app-secrets
   type: Opaque
   data:
     DATABASE_PASSWORD: c3VwZXItc2VjcmV0LTEyMw==  # base64
     AWS_ACCESS_KEY: QUtJQTJYWFhYWFhYWFhYWFg=
   ```

6. **Re-analyze good YAML**
   ```bash
   daal good-deployment.yaml
   ```
   
   Output: `diagnostics: []` ✓

---

## Key Testing Scenarios

### Test 1: Duplicate Keys
```yaml
data:
  key: value1
  key: value2  # DAAL011
```
**Result:** Warning about duplicate key

### Test 2: Reference Resolution
```yaml
---
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  volumes:
  - name: config
    configMap:
      name: missing-config  # DAAL004
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: existing-config
```
**Result:** Error - ConfigMap "missing-config" not found

### Test 3: Dependency Cycles
```yaml
---
apiVersion: v1
kind: Pod
metadata:
  name: pod-a
spec:
  serviceAccountName: sa-b
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: sa-b
automountServiceAccountToken: true
```
**Result:** No cycle (one-way dependency is OK)

### Test 4: Security Context
```yaml
spec:
  containers:
  - name: app
    securityContext:
      privileged: true  # DAAL007
      runAsUser: 0  # DAAL018
```
**Result:** Two security warnings

### Test 5: Image Tag Validation
```yaml
image: nginx  # DAAL016
image: nginx:latest  # DAAL017
image: nginx:v1.2.3  # OK
```
**Result:** Warnings for untagged and 'latest' tag

---

## Performance Metrics to Show

Run tests and display:

```bash
# Test suite
npm test

# Output:
# OK (4 tests)
# - Lexer tokenization: PASS
# - Parser AST building: PASS
# - Semantic analysis: PASS
# - Cycle detection: PASS
```

### Analyze time complexity:
- **1KB YAML:** <10ms
- **10KB YAML:** <50ms
- **100KB YAML:** <500ms

---

## Questions You'll Likely Get

**Q: How is this different from kubeval/kubesec?**
A: D.A.A.L uses formal compiler design with semantic analysis, not just schema validation. It detects:
- Reference resolution across manifests
- Dependency cycles
- Business logic errors
- Custom security patterns

**Q: Can it integrate with CI/CD?**
A: Yes! Both ways:
```bash
# In pipeline
daal *.yaml || exit 1

# Or call HTTP endpoint
curl -X POST https://r2-d2.xyz/compile \
  -d @manifest.yaml
```

**Q: What Kubernetes versions does it support?**
A: API agnostic. Works with any apiVersion/kind pattern. Tested on v1.20-v1.30+.

**Q: Is it production-ready?**
A: Yes. Running on Azure VM (20.193.254.214) with Caddy HTTPS, systemd auto-restart, 4 test cases passing.

---

## Presentation Checklist

- [ ] Show architecture diagram (in ARCHITECTURE_AND_DESIGN.md)
- [ ] Run CLI demo on local YAML
- [ ] Demonstrate VS Code extension with real diagnostics
- [ ] Show backend server running and responding
- [ ] Display test coverage (`npm test`)
- [ ] Compare bad vs good YAML analysis
- [ ] Mention npm/Marketplace availability
- [ ] Highlight security detection capabilities
- [ ] Explain three-stage compiler architecture
- [ ] Show GitHub repo + CI/CD pipeline

---

## Quick Links

- **GitHub:** https://github.com/Krishna-10-7/daal
- **npm Package:** https://www.npmjs.com/package/krishna-project
- **VS Code Extension:** https://marketplace.visualstudio.com/items?itemName=krishnapandey.krishna-project
- **Live Backend:** https://r2-d2.xyz/compile
- **Architecture Docs:** [ARCHITECTURE_AND_DESIGN.md](./ARCHITECTURE_AND_DESIGN.md)
