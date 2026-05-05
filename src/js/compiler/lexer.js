/**
 * Lexical Analyzer (Scanner) for D.A.A.L
 * Converts raw YAML text into a stream of tokens, including INDENT/DEDENT.
 */

const TokenType = {
    IDENTIFIER: 'IDENTIFIER',
    STRING: 'STRING',
    INTEGER: 'INTEGER',
    BOOLEAN: 'BOOLEAN',
    NULL: 'NULL',
    COLON: 'COLON',
    NEWLINE: 'NEWLINE',
    INDENT: 'INDENT',
    DEDENT: 'DEDENT',
    DASH: 'DASH',
    DOC_START: 'DOC_START',
    EOF: 'EOF'
};

class Token {
    constructor(type, value, line, column, offset, endOffset) {
        this.type = type;
        this.value = value;
        this.line = line;
        this.column = column;
        this.offset = offset;
        this.endOffset = endOffset;
    }
}

class Lexer {
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.line = 1;
        this.column = 1;
        this.indentStack = [0];
        this.tokens = [];
    }

    advance() {
        if (this.pos < this.input.length) {
            if (this.input[this.pos] === '\n') {
                this.line++;
                this.column = 0;
            }
            this.pos++;
            this.column++;
        }
    }

    peek() {
        if (this.pos >= this.input.length) return null;
        return this.input[this.pos];
    }

    peekNext() {
        if (this.pos + 1 >= this.input.length) return null;
        return this.input[this.pos + 1];
    }

    tokenize() {
        while (this.pos < this.input.length) {
            const char = this.peek();

            if (char === '\n') {
                this.tokens.push(new Token(TokenType.NEWLINE, '\n', this.line, this.column, this.pos, this.pos + 1));
                this.advance();
                this.handleIndentation();
                continue;
            }

            if (char === ' ' || char === '\r') {
                this.advance();
                continue;
            }

            if (char === ':') {
                const next = this.peekNext();
                const isKeySep = next === ' ' || next === '\n' || next === '\r' || next === '\t' || next === null;
                if (isKeySep) {
                    this.tokens.push(new Token(TokenType.COLON, ':', this.line, this.column, this.pos, this.pos + 1));
                    this.advance();
                } else {
                    const prev = this.tokens.length > 0 ? this.tokens[this.tokens.length - 1] : null;
                    if (prev && prev.type === TokenType.IDENTIFIER && prev.line === this.line && prev.endOffset === this.pos) {
                        prev.value += ':';
                        this.advance();
                        prev.endOffset = this.pos;
                        while (this.pos < this.input.length && /[a-zA-Z0-9_\-\.\/]/.test(this.peek())) {
                            prev.value += this.peek();
                            this.advance();
                            prev.endOffset = this.pos;
                        }
                    } else {
                        this.readBareScalar();
                    }
                }
                continue;
            }

            if (char === '-') {
                if (this.peekDocumentStart()) {
                    const startOffset = this.pos;
                    this.advance();
                    this.advance();
                    this.advance();
                    this.tokens.push(new Token(TokenType.DOC_START, '---', this.line, this.column - 3, startOffset, startOffset + 3));
                } else {
                    this.tokens.push(new Token(TokenType.DASH, '-', this.line, this.column, this.pos, this.pos + 1));
                    this.advance();
                }
                continue;
            }

            if (char === '"' || char === "'") {
                this.readString(char);
                continue;
            }

            if (/[a-zA-Z0-9_\-\.]/.test(char)) {
                this.readIdentifierOrNumber();
                continue;
            }

            if (char === '#') {
                this.skipComment();
                continue;
            }

            // Unknown character, skip or throw error
            this.advance();
        }

        // Process remaining dedents at EOF
        while (this.indentStack.length > 1) {
            this.indentStack.pop();
            this.tokens.push(new Token(TokenType.DEDENT, '', this.line, this.column, this.pos, this.pos));
        }

        this.tokens.push(new Token(TokenType.EOF, '', this.line, this.column, this.pos, this.pos));
        return this.tokens;
    }

    handleIndentation() {
        let spaces = 0;
        while (this.peek() === ' ') {
            spaces++;
            this.advance();
        }

        // If it's a blank line or comment, ignore indentation
        if (this.peek() === '\n' || this.peek() === '#' || this.peek() === '\r' || this.peek() === null) {
            return;
        }

        const currentIndent = this.indentStack[this.indentStack.length - 1];

        if (spaces > currentIndent) {
            this.indentStack.push(spaces);
            this.tokens.push(new Token(TokenType.INDENT, spaces.toString(), this.line, this.column, this.pos, this.pos));
        } else if (spaces < currentIndent) {
            while (this.indentStack.length > 1 && spaces < this.indentStack[this.indentStack.length - 1]) {
                this.indentStack.pop();
                this.tokens.push(new Token(TokenType.DEDENT, '', this.line, this.column, this.pos, this.pos));
            }
        }
    }

    readIdentifierOrNumber() {
        let result = '';
        const startCol = this.column;
        const startOffset = this.pos;
        while (this.pos < this.input.length && /[a-zA-Z0-9_\-\.\/]/.test(this.peek())) {
            result += this.peek();
            this.advance();
        }
        const endOffset = this.pos;

        if (/^[0-9]+$/.test(result)) {
            this.tokens.push(new Token(TokenType.INTEGER, result, this.line, startCol, startOffset, endOffset));
        } else if (result === 'true' || result === 'false') {
            this.tokens.push(new Token(TokenType.BOOLEAN, result, this.line, startCol, startOffset, endOffset));
        } else if (result === 'null' || result === '~') {
            this.tokens.push(new Token(TokenType.NULL, result, this.line, startCol, startOffset, endOffset));
        } else {
            this.tokens.push(new Token(TokenType.IDENTIFIER, result, this.line, startCol, startOffset, endOffset));
        }
    }

    readBareScalar() {
        let result = '';
        const startCol = this.column;
        const startOffset = this.pos;
        while (this.pos < this.input.length && /[a-zA-Z0-9_\-\.\/:]/.test(this.peek())) {
            result += this.peek();
            this.advance();
        }
        const endOffset = this.pos;
        this.tokens.push(new Token(TokenType.IDENTIFIER, result, this.line, startCol, startOffset, endOffset));
    }

    readString(quoteChar) {
        let result = '';
        const startCol = this.column;
        const startOffset = this.pos;
        this.advance(); // skip opening quote
        while (this.pos < this.input.length && this.peek() !== quoteChar) {
            result += this.peek();
            this.advance();
        }
        this.advance(); // skip closing quote
        const endOffset = this.pos;
        this.tokens.push(new Token(TokenType.STRING, result, this.line, startCol, startOffset, endOffset));
    }

    skipComment() {
        while (this.pos < this.input.length && this.peek() !== '\n') {
            this.advance();
        }
    }

    peekDocumentStart() {
        if (this.pos + 2 >= this.input.length) return false;
        if (this.input[this.pos] !== '-' || this.input[this.pos + 1] !== '-' || this.input[this.pos + 2] !== '-') return false;
        if (this.pos === 0) return true;
        const prev = this.input[this.pos - 1];
        if (prev !== '\n' && prev !== '\r') return false;
        const next = this.pos + 3 < this.input.length ? this.input[this.pos + 3] : '\n';
        return next === '\n' || next === '\r' || next === ' ' || next === '\t';
    }
}

module.exports = { Lexer, TokenType };
