# D.A.A.L (DevOps Automation Analysis Layer)

D.A.A.L is a formal static analysis engine and Language Server for Kubernetes YAML configurations. It utilizes a true compiler-design architecture:
- **Front-end (JS)**: Lexical and Syntax Analysis
- **Back-end (Pure C)**: Semantic Analysis, Cycle Detection, and Security Scanning

## Architecture

This project is built using a Client-Server Architecture:
1. **D.A.A.L Server (`server.js`)**: An Express.js server that hosts the engine. It receives YAML payloads, tokenizes them, and passes the AST to the C backend via N-API.
2. **D.A.A.L Client (`client-stub.js`)**: A mock IDE extension that demonstrates how a developer's editor would interact with the server in real-time.

## Setup

### Prerequisites
- Node.js
- Visual Studio Build Tools (C++ Workload) for compiling the Pure C Native Addon on Windows.

### Installation
```bash
npm install
npm run build
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

*Note: If the C Addon fails to compile due to missing Visual Studio C++ Build Tools, the server will gracefully fallback and run the JS Lexer only.*
