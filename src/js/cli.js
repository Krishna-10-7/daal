#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { analyzeYamlText } = require('./engine');

function usage() {
    const text = [
        'Usage:',
        '  daal <file|dir> [--json] [--exit-code]',
        '',
        'Examples:',
        '  daal k8s/deployment.yaml',
        '  daal k8s/ --json',
        '  daal k8s/ --exit-code'
    ].join('\n');
    process.stderr.write(text + '\n');
}

function isYamlFile(p) {
    const ext = path.extname(p).toLowerCase();
    return ext === '.yaml' || ext === '.yml';
}

function walk(dir) {
    const out = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            out.push(...walk(full));
        } else if (e.isFile() && isYamlFile(full)) {
            out.push(full);
        }
    }
    return out;
}

function formatDiag(file, d) {
    const sev = (d.severity || 'error').toUpperCase();
    const code = d.code ? ` ${d.code}` : '';
    const line = d.range && d.range.start ? d.range.start.line : 1;
    const col = d.range && d.range.start ? d.range.start.column : 1;
    return `${file}:${line}:${col} [${sev}]${code} ${d.message}`;
}

function main(argv) {
    const args = argv.slice(2);
    if (args.length === 0) {
        usage();
        process.exit(2);
    }

    const json = args.includes('--json');
    const exitCodeFlag = args.includes('--exit-code');
    const target = args.find((a) => !a.startsWith('--'));
    if (!target) {
        usage();
        process.exit(2);
    }

    const abs = path.resolve(process.cwd(), target);
    if (!fs.existsSync(abs)) {
        process.stderr.write(`Path not found: ${abs}\n`);
        process.exit(2);
    }

    const files = fs.statSync(abs).isDirectory() ? walk(abs) : [abs];
    const results = [];
    let errorCount = 0;
    let warnCount = 0;

    for (const f of files) {
        let diags = [];
        try {
            const text = fs.readFileSync(f, 'utf8');
            const r = analyzeYamlText(text);
            diags = r.diagnostics || [];
        } catch (e) {
            diags = [
                {
                    message: e.message,
                    severity: 'error',
                    code: 'DAAL901',
                    range: { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } }
                }
            ];
        }

        for (const d of diags) {
            if ((d.severity || 'error') === 'warning') warnCount++;
            else errorCount++;
        }
        results.push({ file: f, diagnostics: diags });
    }

    if (json) {
        process.stdout.write(JSON.stringify({ results }, null, 2) + '\n');
    } else {
        for (const r of results) {
            for (const d of r.diagnostics) {
                process.stderr.write(formatDiag(r.file, d) + '\n');
            }
        }
        process.stderr.write(`Checked ${files.length} file(s). Errors: ${errorCount}. Warnings: ${warnCount}.\n`);
    }

    if (exitCodeFlag) {
        process.exit(errorCount > 0 ? 1 : 0);
    }
}

main(process.argv);
