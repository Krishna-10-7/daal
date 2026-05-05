const express = require('express');
const cors = require('cors');
const parser = require('./parser');
const fs = require('fs');
const path = require('path');

let daalEngine;
try {
    daalEngine = require('../../build/Release/daal_engine.node');
} catch (e) {
    console.warn("[WARNING] Could not load the compiled C Semantic Analyzer.");
    console.warn("Please run 'npm run build' with Visual Studio Build Tools installed.");
    console.warn("Falling back to JS-only Lexical Analysis for demonstration.");
}

const app = express();
app.use(cors());
app.use(express.text({ type: '*/*' })); // Accept raw text payloads

app.post('/compile', (req, res) => {
    try {
        const yamlText = req.body;
        if (!yamlText) {
            return res.status(400).json({ error: "Empty payload" });
        }
        
        const yaml = require('yaml-ast-parser');
        const ast = yaml.load(yamlText);
        
        const serializedAst = parser.serializeAst(ast);
        
        let diagnostics = [];
        if (daalEngine) {
            diagnostics = daalEngine.analyzeAst(serializedAst);
        } else {
            diagnostics.push({
                startPosition: 0,
                endPosition: 0,
                message: "Engine not compiled. Lexical parsing successful."
            });
        }
        
        res.json({
            success: true,
            diagnostics: diagnostics
        });

    } catch (error) {
        console.error("Compilation Error:", error);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[D.A.A.L Server] Language Server Protocol endpoint running on http://localhost:${PORT}/compile`);
});
