const { Lexer } = require('../compiler/lexer');
const { Parser } = require('../compiler/parser');

function parseYamlText(yamlText) {
    const lexer = new Lexer(yamlText);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
}

function isObjectLike(v) {
    return v !== null && typeof v === 'object';
}

function astToWrap(node) {
    if (!node) return { type: 'null', value: null, node: null };

    if (node.kind === 'Scalar') {
        return { type: 'scalar', value: node.value, node };
    }

    if (node.kind === 'Seq') {
        const items = node.children.map((item) => {
            const child = item && item.children ? item.children[0] : null;
            return astToWrap(child);
        });
        return { type: 'seq', items, node };
    }

    if (node.kind === 'Map') {
        const pairs = [];
        const map = new Map();
        for (const pairNode of node.children) {
            if (!pairNode || pairNode.kind !== 'Pair') continue;
            const keyNode = pairNode.children[0];
            const valNode = pairNode.children[1];
            const key = keyNode ? keyNode.value : null;
            const valueWrap = astToWrap(valNode);
            pairs.push({ key, keyNode, value: valueWrap, pairNode });
            if (typeof key === 'string' && !map.has(key)) {
                map.set(key, valueWrap);
            }
        }
        return { type: 'map', map, pairs, node };
    }

    if (node.kind === 'Document') {
        const child = node.children[0] || null;
        return astToWrap(child);
    }

    if (node.kind === 'Manifest') {
        const docs = node.children.map((d) => astToWrap(d));
        return { type: 'manifest', docs, node };
    }

    return { type: 'unknown', value: null, node };
}

function wrapToJs(wrap) {
    if (!wrap) return null;
    if (wrap.type === 'scalar') return wrap.value;
    if (wrap.type === 'seq') return wrap.items.map(wrapToJs);
    if (wrap.type === 'map') {
        const obj = {};
        for (const [k, v] of wrap.map.entries()) {
            obj[k] = wrapToJs(v);
        }
        return obj;
    }
    if (wrap.type === 'manifest') return wrap.docs.map(wrapToJs);
    return null;
}

function getPath(wrap, path) {
    let current = wrap;
    for (const key of path) {
        if (!current) return null;
        if (current.type === 'map') {
            current = current.map.get(key) || null;
            continue;
        }
        if (current.type === 'seq') {
            if (typeof key !== 'number') return null;
            current = current.items[key] || null;
            continue;
        }
        return null;
    }
    return current;
}

function rangeFromNode(node) {
    if (!node || !node.start || !node.end) {
        return { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };
    }
    return {
        start: { line: node.start.line, column: node.start.column },
        end: { line: node.end.line, column: node.end.column }
    };
}

function makeDiag(node, message, severity = 'error', code = null) {
    const range = rangeFromNode(node);
    const diag = { message, severity, range };
    if (code) diag.code = code;
    return diag;
}

function makeDiagFromRange(range, message, severity = 'error', code = null) {
    const r = range || { start: { line: 1, column: 1 }, end: { line: 1, column: 1 } };
    const diag = { message, severity, range: r };
    if (code) diag.code = code;
    return diag;
}

function parseErrorToDiag(err) {
    const msg = err && err.message ? err.message : String(err);
    const m = msg.match(/Line\s+(\d+)/i);
    const line = m ? Number(m[1]) : 1;
    const range = { start: { line, column: 1 }, end: { line, column: 1 } };
    return makeDiagFromRange(range, msg, 'error', 'DAAL900');
}

function selectorMatchesLabels(selectorObj, labelsObj) {
    if (!isObjectLike(selectorObj) || !isObjectLike(labelsObj)) return false;
    for (const [k, v] of Object.entries(selectorObj)) {
        if (labelsObj[k] !== v) return false;
    }
    return true;
}

function detectCycles(nodes, edges) {
    const visiting = new Set();
    const visited = new Set();
    const stack = [];
    const cycles = [];

    const dfs = (id) => {
        if (visiting.has(id)) {
            const idx = stack.indexOf(id);
            if (idx >= 0) cycles.push(stack.slice(idx).concat([id]));
            return;
        }
        if (visited.has(id)) return;
        visiting.add(id);
        stack.push(id);
        const next = edges.get(id) || [];
        for (const n of next) dfs(n);
        stack.pop();
        visiting.delete(id);
        visited.add(id);
    };

    for (const n of nodes) dfs(n);
    return cycles;
}

function analyzeYamlText(yamlText) {
    const input = String(yamlText || '').replace(/\r\n/g, '\n');
    let manifestAst;
    try {
        manifestAst = parseYamlText(input);
    } catch (e) {
        return { ast: null, diagnostics: [parseErrorToDiag(e)], documents: [] };
    }
    const manifestWrap = astToWrap(manifestAst);
    const docs = manifestWrap.type === 'manifest' ? manifestWrap.docs : [];
    const diagnostics = [];

    const addDuplicateKeyDiagnostics = (w) => {
        if (!w) return;
        if (w.type === 'seq') {
            for (const it of w.items) addDuplicateKeyDiagnostics(it);
            return;
        }
        if (w.type !== 'map') return;

        const seen = new Set();
        for (const p of w.pairs) {
            if (typeof p.key === 'string') {
                if (seen.has(p.key)) {
                    diagnostics.push(makeDiag(p.keyNode || w.node, `Duplicate key: ${p.key}`, 'warning', 'DAAL011'));
                } else {
                    seen.add(p.key);
                }
            }
            addDuplicateKeyDiagnostics(p.value);
        }
    };

    const resources = [];
    for (let i = 0; i < docs.length; i++) {
        const docWrap = docs[i];
        if (!docWrap || docWrap.type !== 'map') continue;
        addDuplicateKeyDiagnostics(docWrap);

        const apiVersion = getPath(docWrap, ['apiVersion']);
        const kind = getPath(docWrap, ['kind']);
        const name = getPath(docWrap, ['metadata', 'name']);
        const namespace = getPath(docWrap, ['metadata', 'namespace']);

        if (!apiVersion) diagnostics.push(makeDiag(docWrap.node, "Missing required field: apiVersion", 'error', 'DAAL001'));
        if (!kind) diagnostics.push(makeDiag(docWrap.node, "Missing required field: kind", 'error', 'DAAL002'));
        if (!name) diagnostics.push(makeDiag(docWrap.node, "Missing required field: metadata.name", 'error', 'DAAL003'));

        const kindStr = kind && kind.type === 'scalar' ? String(kind.value) : null;
        const nameStr = name && name.type === 'scalar' ? String(name.value) : null;
        const nsStr = namespace && namespace.type === 'scalar' ? String(namespace.value) : 'default';
        const id = kindStr && nameStr ? `${nsStr}/${kindStr}/${nameStr}` : `doc:${i}`;

        resources.push({ id, docIndex: i, wrap: docWrap, kind: kindStr, name: nameStr, namespace: nsStr });
    }

    const sym = new Map();
    for (const r of resources) {
        if (!r.kind || !r.name) continue;
        const key = `${r.namespace}/${r.kind}/${r.name}`;
        if (sym.has(key)) {
            diagnostics.push(makeDiag(r.wrap.node, `Duplicate resource: ${key}`, 'error', 'DAAL010'));
        } else {
            sym.set(key, r);
        }
    }

    const configMaps = new Map();
    const secrets = new Map();
    const serviceAccounts = new Map();

    for (const r of resources) {
        if (!r.kind || !r.name) continue;
        const key = `${r.namespace}/${r.name}`;
        if (r.kind === 'ConfigMap') configMaps.set(key, r);
        if (r.kind === 'Secret') secrets.set(key, r);
        if (r.kind === 'ServiceAccount') serviceAccounts.set(key, r);
    }

    const podLabelSets = [];
    for (const r of resources) {
        const labels = getPath(r.wrap, ['metadata', 'labels']);
        const tplLabels = getPath(r.wrap, ['spec', 'template', 'metadata', 'labels']);
        const labelsObj = wrapToJs(tplLabels || labels);
        if (isObjectLike(labelsObj)) podLabelSets.push({ r, labelsObj, node: (tplLabels || labels || r.wrap).node });
    }

    for (const r of resources) {
        if (r.kind !== 'Service') continue;
        const selectorWrap = getPath(r.wrap, ['spec', 'selector']);
        const selectorObj = wrapToJs(selectorWrap);
        if (!isObjectLike(selectorObj)) continue;
        const matches = podLabelSets.some((p) => selectorMatchesLabels(selectorObj, p.labelsObj));
        if (!matches) {
            diagnostics.push(makeDiag(selectorWrap ? selectorWrap.node : r.wrap.node, `Service selector matches no workloads in namespace ${r.namespace}`, 'warning', 'DAAL020'));
        }
    }

    const edges = new Map();
    for (const r of resources) edges.set(r.id, []);

    const addEdge = (fromId, toId) => {
        if (!edges.has(fromId)) edges.set(fromId, []);
        edges.get(fromId).push(toId);
    };

    const findByKindName = (ns, kind, name) => {
        const key = `${ns}/${kind}/${name}`;
        return sym.get(key) || null;
    };

    const requireRef = (from, kind, nameWrap, codeMissing) => {
        const nameVal = nameWrap && nameWrap.type === 'scalar' ? nameWrap.value : null;
        if (!nameVal) return;
        const dep = findByKindName(from.namespace, kind, String(nameVal));
        if (!dep) {
            diagnostics.push(makeDiag(nameWrap.node, `Missing reference: ${kind} ${from.namespace}/${nameVal}`, 'error', codeMissing));
            return;
        }
        addEdge(from.id, dep.id);
    };

    const scanPodSpecSecurity = (r, podSpecWrap) => {
        const hostNetwork = getPath(podSpecWrap, ['hostNetwork']);
        if (hostNetwork && hostNetwork.type === 'scalar' && hostNetwork.value === true) {
            diagnostics.push(makeDiag(hostNetwork.node, "Security risk: hostNetwork is true", 'warning', 'DAAL101'));
        }

        const sa = getPath(podSpecWrap, ['serviceAccountName']);
        if (sa) requireRef(r, 'ServiceAccount', sa, 'DAAL030');

        const containers = getPath(podSpecWrap, ['containers']);
        if (containers && containers.type === 'seq') {
            for (const c of containers.items) {
                const image = getPath(c, ['image']);
                if (image && image.type === 'scalar' && typeof image.value === 'string') {
                    const s = image.value;
                    if (!s.includes(':') || s.endsWith(':latest')) {
                        diagnostics.push(makeDiag(image.node, "Security risk: container image tag is missing or uses latest", 'warning', 'DAAL105'));
                    }
                }

                const sc = getPath(c, ['securityContext']);
                const privileged = getPath(sc, ['privileged']);
                if (privileged && privileged.type === 'scalar' && privileged.value === true) {
                    diagnostics.push(makeDiag(privileged.node, "Security risk: privileged container", 'warning', 'DAAL102'));
                }
                const ape = getPath(sc, ['allowPrivilegeEscalation']);
                if (ape && ape.type === 'scalar' && ape.value === true) {
                    diagnostics.push(makeDiag(ape.node, "Security risk: allowPrivilegeEscalation is true", 'warning', 'DAAL103'));
                }
                const runAsUser = getPath(sc, ['runAsUser']);
                if (runAsUser && runAsUser.type === 'scalar' && Number(runAsUser.value) === 0) {
                    diagnostics.push(makeDiag(runAsUser.node, "Security risk: runAsUser is 0", 'warning', 'DAAL104'));
                }

                const envFrom = getPath(c, ['envFrom']);
                if (envFrom && envFrom.type === 'seq') {
                    for (const ef of envFrom.items) {
                        const cm = getPath(ef, ['configMapRef', 'name']);
                        if (cm) requireRef(r, 'ConfigMap', cm, 'DAAL042');
                        const sec = getPath(ef, ['secretRef', 'name']);
                        if (sec) requireRef(r, 'Secret', sec, 'DAAL043');
                    }
                }

                const env = getPath(c, ['env']);
                if (env && env.type === 'seq') {
                    for (const e of env.items) {
                        const cm = getPath(e, ['valueFrom', 'configMapKeyRef', 'name']);
                        if (cm) requireRef(r, 'ConfigMap', cm, 'DAAL044');
                        const sec = getPath(e, ['valueFrom', 'secretKeyRef', 'name']);
                        if (sec) requireRef(r, 'Secret', sec, 'DAAL045');
                    }
                }
            }
        }

        const volumes = getPath(podSpecWrap, ['volumes']);
        if (volumes && volumes.type === 'seq') {
            for (const v of volumes.items) {
                const cm = getPath(v, ['configMap', 'name']);
                if (cm) requireRef(r, 'ConfigMap', cm, 'DAAL040');
                const sec = getPath(v, ['secret', 'secretName']);
                if (sec) requireRef(r, 'Secret', sec, 'DAAL041');
            }
        }
    };

    for (const r of resources) {
        if (!r.kind) continue;

        if (r.kind === 'Pod') {
            const podSpec = getPath(r.wrap, ['spec']);
            if (podSpec) scanPodSpecSecurity(r, podSpec);
        } else {
            const podSpec = getPath(r.wrap, ['spec', 'template', 'spec']);
            if (podSpec) scanPodSpecSecurity(r, podSpec);
        }

        const ingressBackendSvc = getPath(r.wrap, ['spec', 'backend', 'service', 'name']);
        if (ingressBackendSvc) requireRef(r, 'Service', ingressBackendSvc, 'DAAL050');
        const ingressRules = getPath(r.wrap, ['spec', 'rules']);
        if (ingressRules && ingressRules.type === 'seq') {
            for (const rule of ingressRules.items) {
                const http = getPath(rule, ['http', 'paths']);
                if (!http || http.type !== 'seq') continue;
                for (const p of http.items) {
                    const s = getPath(p, ['backend', 'service', 'name']);
                    if (s) requireRef(r, 'Service', s, 'DAAL051');
                }
            }
        }
    }

    const secretPatterns = [
        { re: /AKIA[0-9A-Z]{16}/, msg: 'Potential AWS access key detected' },
        { re: /-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY-----/, msg: 'Potential private key material detected' },
        { re: /\bghp_[A-Za-z0-9]{36}\b/, msg: 'Potential GitHub token detected' },
        { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, msg: 'Potential Slack token detected' }
    ];

    const walkWrap = (w) => {
        if (!w) return;
        if (w.type === 'scalar' && typeof w.value === 'string') {
            for (const p of secretPatterns) {
                if (p.re.test(w.value)) {
                    diagnostics.push(makeDiag(w.node, `Security error: ${p.msg}`, 'error', 'DAAL110'));
                    break;
                }
            }
            return;
        }
        if (w.type === 'seq') {
            for (const it of w.items) walkWrap(it);
            return;
        }
        if (w.type === 'map') {
            for (const v of w.map.values()) walkWrap(v);
            return;
        }
    };

    for (const r of resources) walkWrap(r.wrap);

    const nodeIds = resources.map((r) => r.id);
    const cycles = detectCycles(nodeIds, edges);
    for (const c of cycles) {
        const msg = `Dependency cycle detected: ${c.join(' -> ')}`;
        const firstId = c[0];
        const r = resources.find((x) => x.id === firstId);
        diagnostics.push(makeDiag(r ? r.wrap.node : manifestWrap.node, msg, 'error', 'DAAL200'));
    }

    return { ast: manifestAst, diagnostics, documents: docs.map(wrapToJs) };
}

module.exports = {
    analyzeYamlText,
    parseYamlText,
    astToWrap,
    wrapToJs
};
