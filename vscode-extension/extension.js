const vscode = require('vscode');
const path = require('path');

const { analyzeYamlText } = require('./engine');
const timers = new Map();
let statusBarItem = null;

function isYamlDoc(doc) {
    const ext = path.extname(doc.fileName || '').toLowerCase();
    return doc.languageId === 'yaml' || ext === '.yaml' || ext === '.yml';
}

function toVscodeDiag(d) {
    const sLine = d.range && d.range.start ? Math.max(0, (d.range.start.line || 1) - 1) : 0;
    const sCol = d.range && d.range.start ? Math.max(0, (d.range.start.column || 1) - 1) : 0;
    const eLine = d.range && d.range.end ? Math.max(0, (d.range.end.line || 1) - 1) : sLine;
    const eCol = d.range && d.range.end ? Math.max(0, (d.range.end.column || 1) - 1) : sCol;

    const range = new vscode.Range(new vscode.Position(sLine, sCol), new vscode.Position(eLine, eCol));
    const vd = new vscode.Diagnostic(range, d.message || 'Unknown error', vscode.DiagnosticSeverity.Error);
    if ((d.severity || 'error') === 'warning') vd.severity = vscode.DiagnosticSeverity.Warning;
    if (d.code) vd.code = d.code;
    return vd;
}

async function analyzeDocument(doc, collection) {
    if (!isYamlDoc(doc)) return;
    if (doc.isUntitled) return;

    try {
        const r = analyzeYamlText(doc.getText());
        const diags = (r.diagnostics || []).map(toVscodeDiag);
        collection.set(doc.uri, diags);
    } catch (e) {
        const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));
        const d = new vscode.Diagnostic(range, e.message, vscode.DiagnosticSeverity.Error);
        collection.set(doc.uri, [d]);
    }
}

    async function postJson(urlString, body, timeoutMs = 8000) {
        const urlObj = new URL(urlString);
        const isHttps = urlObj.protocol === 'https:';
        const http = isHttps ? require('https') : require('http');

        const payload = JSON.stringify(body);
        const opts = {
            method: 'POST',
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + (urlObj.search || ''),
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        return new Promise((resolve, reject) => {
            const req = http.request(opts, (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data || '{}');
                        resolve(parsed);
                    } catch (e) {
                        reject(new Error('Invalid JSON from server'));
                    }
                });
            });
            req.on('error', (err) => reject(err));
            if (timeoutMs) req.setTimeout(timeoutMs, () => { req.destroy(new Error('Request timeout')); });
            req.write(payload);
            req.end();
        });
    }

    async function analyzeDocumentOnServer(doc, collection) {
        if (!isYamlDoc(doc)) return;
        try {
            const config = vscode.workspace.getConfiguration('daal');
            const serverUrl = config.get('serverUrl', 'http://localhost:3000/compile');
            if (!serverUrl) return analyzeDocument(doc, collection);

            statusBarItem && (statusBarItem.text = 'DAAL: Running...');

            const payload = { text: doc.getText(), fileName: doc.fileName };
            const res = await postJson(serverUrl, payload, 15000);
            const diags = (res && res.diagnostics ? res.diagnostics : []).map(toVscodeDiag);
            collection.set(doc.uri, diags);
            statusBarItem && (statusBarItem.text = 'DAAL: Done');
        } catch (e) {
            const range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(0, 1));
            const d = new vscode.Diagnostic(range, 'DAAL server error: ' + (e.message || String(e)), vscode.DiagnosticSeverity.Error);
            collection.set(doc.uri, [d]);
            statusBarItem && (statusBarItem.text = 'DAAL: Error');
        }

    }

function scheduleAnalyze(doc, collection) {
function scheduleAnalyze(doc, collection) {
    const key = doc.uri.toString();
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
        timers.delete(key);
        analyzeDocument(doc, collection);
    }, 350);
    timers.set(key, t);
}

function activate(context) {
    const collection = vscode.languages.createDiagnosticCollection('daal');
    context.subscriptions.push(collection);

    // Create a status bar Run button
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = 'DAAL: Ready';
    statusBarItem.command = 'daal.runOnServer';
    statusBarItem.tooltip = 'Run D.A.A.L analysis on configured server';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    if (vscode.window.activeTextEditor) {
        analyzeDocument(vscode.window.activeTextEditor.document, collection);
    }

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((doc) => analyzeDocument(doc, collection)));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => analyzeDocumentOnServer(doc, collection)));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => scheduleAnalyze(e.document, collection)));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        const key = doc.uri.toString();
        const existing = timers.get(key);
        if (existing) clearTimeout(existing);
        timers.delete(key);
        collection.delete(doc.uri);
    }));

    // Register command to run on server
    const runCmd = vscode.commands.registerCommand('daal.runOnServer', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return vscode.window.showInformationMessage('Open a YAML file to run D.A.A.L on server');
        const doc = editor.document;
        await analyzeDocumentOnServer(doc, collection);
    });
    context.subscriptions.push(runCmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
