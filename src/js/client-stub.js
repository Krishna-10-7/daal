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
            const severity = d.severity ? d.severity.toUpperCase() : 'ERROR';
            const startLine = d.range && d.range.start ? d.range.start.line : d.startPosition;
            const startCol = d.range && d.range.start ? d.range.start.column : 0;
            const code = d.code ? ` ${d.code}` : '';
            console.log(`\x1b[31m[${severity}]${code}\x1b[0m ${d.message} (Line ${startLine}, Col ${startCol})`);
            // In a real IDE, this would render a squiggly line using the LSP API
        });
    } else {
        console.log("\x1b[32m[SUCCESS]\x1b[0m No semantic or security errors found.");
    }
})
.catch(err => {
    console.error("Server connection failed:", err.message);
});
