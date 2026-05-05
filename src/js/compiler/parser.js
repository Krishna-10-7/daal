/**
 * Recursive Descent Parser for D.A.A.L
 * Consumes tokens from the Lexer and builds a Concrete Syntax Tree (CST)
 * based on the formal Context-Free Grammar.
 */

const { TokenType } = require('./lexer');

class ASTNode {
    constructor(kind, value = null, start = null, end = null) {
        this.kind = kind;
        this.value = value;
        this.children = [];
        this.start = start;
        this.end = end;
    }

    addChild(node) {
        if (node) this.children.push(node);
    }
}

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek() {
        if (this.pos >= this.tokens.length) return null;
        return this.tokens[this.pos];
    }

    peekN(n) {
        const idx = this.pos + n;
        if (idx >= this.tokens.length) return null;
        return this.tokens[idx];
    }

    advance() {
        if (this.pos < this.tokens.length) {
            this.pos++;
        }
        return this.peek();
    }

    match(type) {
        const token = this.peek();
        if (token && token.type === type) {
            this.advance();
            return token;
        }
        return null;
    }

    matchOneOf(types) {
        const token = this.peek();
        if (token && types.includes(token.type)) {
            this.advance();
            return token;
        }
        return null;
    }

    expect(type, errorMsg) {
        const token = this.match(type);
        if (!token) {
            const current = this.peek();
            throw new Error(`Parse Error [Line ${current ? current.line : 'EOF'}]: ${errorMsg}. Found ${current ? current.type : 'EOF'}`);
        }
        return token;
    }

    tokenStart(token) {
        if (!token) return null;
        return { line: token.line, column: token.column, offset: token.offset };
    }

    tokenEnd(token) {
        if (!token) return null;
        return { line: token.line, column: token.column, offset: token.endOffset };
    }

    skipNewlines() {
        while (this.match(TokenType.NEWLINE)) {}
    }

    isMappingStart() {
        const t0 = this.peek();
        const t1 = this.peekN(1);
        if (!t0 || !t1) return false;
        if (t0.type !== TokenType.IDENTIFIER && t0.type !== TokenType.STRING) return false;
        return t1.type === TokenType.COLON;
    }

    parse() {
        const first = this.peek();
        const root = new ASTNode('Manifest', null, this.tokenStart(first), this.tokenEnd(first));

        this.skipNewlines();
        while (this.peek() && this.peek().type !== TokenType.EOF) {
            while (this.match(TokenType.DOC_START)) {
                this.skipNewlines();
            }

            if (this.peek() && this.peek().type === TokenType.EOF) break;

            const start = this.tokenStart(this.peek());
            const node = this.parseNode();
            const doc = new ASTNode('Document', null, start, node ? node.end : start);
            doc.addChild(node);
            root.addChild(doc);

            root.end = doc.end;
            this.skipNewlines();
        }

        return root;
    }

    parseNode() {
        const token = this.peek();
        if (!token) return null;

        if (token.type === TokenType.DASH) {
            return this.parseSequence();
        }
        if (this.isMappingStart()) {
            return this.parseMapping();
        }
        return this.parseScalar();
    }

    parseMapping() {
        const startToken = this.peek();
        const node = new ASTNode('Map', null, this.tokenStart(startToken), this.tokenEnd(startToken));

        while (this.peek() && this.peek().type !== TokenType.EOF && this.peek().type !== TokenType.DEDENT && this.peek().type !== TokenType.DOC_START) {
            if (this.match(TokenType.NEWLINE)) continue;
            if (!this.isMappingStart()) break;
            const entry = this.parseMappingEntry();
            node.addChild(entry);
            node.end = entry.end;
        }

        return node;
    }

    parseMappingEntry() {
        const keyTok = this.matchOneOf([TokenType.IDENTIFIER, TokenType.STRING]);
        if (!keyTok) {
            const current = this.peek();
            throw new Error(`Parse Error [Line ${current ? current.line : 'EOF'}]: Expected mapping key. Found ${current ? current.type : 'EOF'}`);
        }
        const start = this.tokenStart(keyTok);
        this.expect(TokenType.COLON, "Expected ':' after key");

        const keyNode = new ASTNode('Key', keyTok.value, this.tokenStart(keyTok), this.tokenEnd(keyTok));
        let valueNode = null;

        if (this.match(TokenType.NEWLINE)) {
            if (this.match(TokenType.INDENT)) {
                valueNode = this.parseNode();
                this.expect(TokenType.DEDENT, "Expected Dedent after indented block");
            } else {
                valueNode = new ASTNode('Scalar', null, this.tokenEnd(keyTok), this.tokenEnd(keyTok));
            }
        } else {
            valueNode = this.parseScalar();
            this.match(TokenType.NEWLINE);
        }

        const pair = new ASTNode('Pair', null, start, valueNode ? valueNode.end : start);
        pair.addChild(keyNode);
        pair.addChild(valueNode);
        return pair;
    }

    parseSequence() {
        const startToken = this.peek();
        const node = new ASTNode('Seq', null, this.tokenStart(startToken), this.tokenEnd(startToken));

        while (this.peek() && this.peek().type === TokenType.DASH) {
            const dashTok = this.match(TokenType.DASH);
            const itemStart = this.tokenStart(dashTok);
            let itemNode = null;

            if (this.match(TokenType.NEWLINE)) {
                this.expect(TokenType.INDENT, "Expected Indent after list item");
                itemNode = this.parseNode();
                this.expect(TokenType.DEDENT, "Expected Dedent after list item block");
            } else if (this.isMappingStart()) {
                const mapNode = new ASTNode('Map', null, itemStart, itemStart);
                const firstEntry = this.parseMappingEntry();
                mapNode.addChild(firstEntry);
                mapNode.end = firstEntry.end;
                if (this.match(TokenType.INDENT)) {
                    const more = this.parseMapping();
                    more.children.forEach((c) => mapNode.addChild(c));
                    mapNode.end = more.end || mapNode.end;
                    this.expect(TokenType.DEDENT, "Expected Dedent after list item map block");
                }
                itemNode = mapNode;
            } else {
                itemNode = this.parseScalar();
                this.match(TokenType.NEWLINE);
            }

            while (this.match(TokenType.NEWLINE)) {}

            const item = new ASTNode('Item', null, itemStart, itemNode ? itemNode.end : itemStart);
            item.addChild(itemNode);
            node.addChild(item);
            node.end = item.end;
        }

        return node;
    }

    parseScalar() {
        const token = this.matchOneOf([TokenType.STRING, TokenType.INTEGER, TokenType.BOOLEAN, TokenType.NULL, TokenType.IDENTIFIER]);
        if (!token) {
            const current = this.peek();
            throw new Error(`Parse Error [Line ${current ? current.line : 'EOF'}]: Expected scalar. Found ${current ? current.type : 'EOF'}`);
        }

        let val = token.value;
        if (token.type === TokenType.INTEGER) val = parseInt(token.value, 10);
        if (token.type === TokenType.BOOLEAN) val = token.value === 'true';
        if (token.type === TokenType.NULL) val = null;

        return new ASTNode('Scalar', val, this.tokenStart(token), this.tokenEnd(token));
    }
}

module.exports = { Parser, ASTNode };
