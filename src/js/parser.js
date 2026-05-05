const yaml = require('yaml-ast-parser');
const fs = require('fs');

/**
 * The Lexer & Parser Front-end.
 * Parses raw YAML text into an AST using yaml-ast-parser.
 */
function parseYaml(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Lexical and Syntax Analysis
    // yaml.load returns the root AST node
    const ast = yaml.load(content);
    
    // In a real compiler, we might do some AST normalization here.
    // For now, we return the raw AST and the original content 
    // so the C Semantic Analyzer can process it.
    return {
        ast: ast,
        rawContent: content,
        filePath: filePath
    };
}

/**
 * Helper to recursively serialize AST if we want to pass it as JSON string 
 * instead of direct N-API object traversal, to simplify the C implementation.
 */
function serializeAst(node) {
    if (!node) return null;
    
    const base = {
        kind: node.kind,
        startPosition: node.startPosition,
        endPosition: node.endPosition
    };

    // yaml-ast-parser kinds:
    // 0: SCALAR, 1: MAPPING, 2: MAP, 3: SEQ, 4: ANCHOR_REF, 5: INCLUDE
    if (node.kind === yaml.Kind.SCALAR) {
        base.value = node.value;
    } else if (node.kind === yaml.Kind.MAPPING) {
        base.key = serializeAst(node.key);
        base.value = serializeAst(node.value);
    } else if (node.kind === yaml.Kind.MAP) {
        base.mappings = (node.mappings || []).map(serializeAst);
    } else if (node.kind === yaml.Kind.SEQ) {
        base.items = (node.items || []).map(serializeAst);
    }
    
    return base;
}

function parseAndSerialize(filePath) {
    const parsed = parseYaml(filePath);
    return {
        ast: serializeAst(parsed.ast),
        filePath: parsed.filePath
    };
}

module.exports = {
    parseYaml,
    parseAndSerialize,
    serializeAst
};
