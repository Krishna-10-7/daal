const http = require('http');
const { analyzeYamlText } = require('./engine');

const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

function sendJson(res, statusCode, body) {
    const json = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json; charset=utf-8' };
    if (CORS_ORIGIN) {
        headers['Access-Control-Allow-Origin'] = CORS_ORIGIN;
        headers['Access-Control-Allow-Headers'] = 'Content-Type';
        headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    }
    res.writeHead(statusCode, headers);
    res.end(json);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let data = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            data += chunk;
            if (data.length > 10 * 1024 * 1024) {
                reject(new Error('Payload too large'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(data));
        req.on('error', reject);
    });
}

const server = http.createServer(async (req, res) => {
    if (!req.url) return sendJson(res, 400, { error: 'Missing URL' });

    const url = new URL(req.url, 'http://localhost');

    if (CORS_ORIGIN && req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': CORS_ORIGIN,
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        });
        return res.end();
    }

    if (req.method === 'POST' && url.pathname === '/compile') {
        try {
            const ct = String(req.headers['content-type'] || '');
            if (ct && !(ct.startsWith('text/plain') || ct.startsWith('text/yaml') || ct.startsWith('application/x-yaml') || ct.startsWith('application/yaml'))) {
                return sendJson(res, 415, { error: 'Unsupported Content-Type' });
            }

            const yamlText = await readBody(req);
            if (!yamlText) return sendJson(res, 400, { error: 'Empty payload' });

            const result = analyzeYamlText(yamlText);
            return sendJson(res, 200, { success: true, diagnostics: result.diagnostics });
        } catch (e) {
            return sendJson(res, 500, { error: e.message });
        }
    }

    return sendJson(res, 404, { error: 'Not found' });
});

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
    console.log(`[D.A.A.L Server] Running on http://localhost:${PORT}/compile`);
});
