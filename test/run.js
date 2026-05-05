const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { analyzeYamlText } = require('../src/js/engine');

function load(name) {
    return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

function hasCode(diags, code) {
    return (diags || []).some((d) => d.code === code);
}

function testMissingName() {
    const r = analyzeYamlText(load('missing-name.yaml'));
    assert.ok(hasCode(r.diagnostics, 'DAAL003'));
}

function testMissingConfigMapRef() {
    const r = analyzeYamlText(load('missing-configmap-ref.yaml'));
    assert.ok(hasCode(r.diagnostics, 'DAAL040') || hasCode(r.diagnostics, 'DAAL042') || hasCode(r.diagnostics, 'DAAL044'));
}

function testServiceSelectorNoMatch() {
    const r = analyzeYamlText(load('service-selector-no-match.yaml'));
    assert.ok(hasCode(r.diagnostics, 'DAAL020'));
}

function testSecretPattern() {
    const r = analyzeYamlText(load('secret-pattern.yaml'));
    assert.ok(hasCode(r.diagnostics, 'DAAL110'));
}

function run() {
    const tests = [testMissingName, testMissingConfigMapRef, testServiceSelectorNoMatch, testSecretPattern];
    for (const t of tests) t();
    process.stdout.write(`OK (${tests.length} tests)\n`);
}

run();

