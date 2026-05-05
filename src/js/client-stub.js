const fs = require('fs');

const filePath = process.argv[2];
if (!filePath) {
    console.error("Usage: node client-stub.js <path-to-yaml>");
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');

fetch('http://localhost:3000/compile', {
    method: 'POST',
    headers: {
        'Content-Type': 'text/plain'
    },
    body: content
})
.then(res => res.json())
.then(data => {
    console.log("=== D.A.A.L IDE Client ===");
    if (data.diagnostics && data.diagnostics.length > 0) {
        data.diagnostics.forEach(d => {
            console.log(`\x1b[31m[ERROR]\x1b[0m ${d.message} (Line ${d.startPosition} - ${d.endPosition})`);
            // In a real IDE, this would render a squiggly line using the LSP API
        });
    } else {
        console.log("\x1b[32m[SUCCESS]\x1b[0m No semantic or security errors found.");
    }
})
.catch(err => {
    console.error("Server connection failed:", err.message);
});
