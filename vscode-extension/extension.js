const vscode = require('vscode');
const path = require('path');

const { analyzeYamlText } = require('./engine');
const timers = new Map();

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

    if (vscode.window.activeTextEditor) {
        analyzeDocument(vscode.window.activeTextEditor.document, collection);
    }

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument((doc) => analyzeDocument(doc, collection)));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((doc) => analyzeDocument(doc, collection)));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => scheduleAnalyze(e.document, collection)));
    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument((doc) => {
        const key = doc.uri.toString();
        const existing = timers.get(key);
        if (existing) clearTimeout(existing);
        timers.delete(key);
        collection.delete(doc.uri);
    }));
}

function deactivate() {}

module.exports = { activate, deactivate };
