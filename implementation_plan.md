# D.A.A.L Theoretical Compiler Implementation Plan

Based on the comprehensive theoretical design document provided, D.A.A.L is transitioning from a heuristic linter to a formal, multi-phase compiler for Kubernetes infrastructure.

## User Review Required

> [!IMPORTANT]
> **Custom Compiler Architecture:** We are fully abandoning the simple wrapping of `yaml-ast-parser`. Instead, we will implement a true **Lexer** (handling whitespace/indentation sensitivity) and a **Recursive Descent Parser** built on Extended Backus-Naur Form (EBNF) to construct a Concrete Syntax Tree (CST).
>
> Please review the expanded architecture below, particularly the introduction of the **Cactus Stack Symbol Table** and **CEL Evaluator**.

## Proposed Architecture & Phases

### Phase 1: Front-end (Lexical & Syntactic Analysis)
*Language: JavaScript/TypeScript*

#### [MODIFY] `src/js/compiler/lexer.js`
- Implements a state-based lexical analyzer.
- Tracks whitespace to generate `INDENT` and `DEDENT` tokens (crucial for YAML).
- Emits `<lexeme, kind>` pairs (e.g., Keywords like `metadata`, Operators like `==`, Identifiers).

#### [NEW] `src/js/compiler/parser.js`
- Implements a **Recursive Descent Parser** using mutually recursive procedures.
- Utilizes left factoring to prevent infinite loops.
- Constructs a high-fidelity Concrete Syntax Tree (CST) to preserve every character for LSP integration.

---

### Phase 2: Middle-end (Semantic Layer)
*Language: Pure C via N-API / WebAssembly Bridge*

#### [NEW] `src/c/symbol_table.c`
- Implements a **Cactus Stack** (parent-pointer tree of hash tables) to manage Global, Namespace, and Resource scopes.
- Uses the shifted sum of letters hash function: `Hash(s) = (Σ s[i] * 2^(n-1-i)) % HashSize`.
- Performs Redeclaration Checking, Type Checking, and Existence Validation.

#### [NEW] `src/c/cel_evaluator.c`
- Parses and evaluates Common Expression Language (CEL) validation rules directly within the semantic analysis phase.
- Ensures sandboxed execution to prevent infinite loops.

---

### Phase 3: Intermediate Representation & Optimization
*Language: Pure C*

#### [NEW] `src/c/ir_dag.c`
- Implements the **Nine-Step Graph Construction Logic** (Node Creation, Reference Analysis, Explicit Linking, Label Resolution, Provider Binding, Expansion, Contextual Injection, Pruning, Cycle Detection).
- Runs $O(V + E)$ Depth-First Search (DFS) for deadlock prevention.

---

### Phase 4: Advanced Security & RCA
*Language: Pure C / JavaScript*

#### [NEW] `src/c/taint_analysis.c`
- Performs **Taint Analysis** to track user-controlled inputs flowing into sensitive sinks.

#### [NEW] `src/js/rca_engine.js`
- Constructs the **StateGraph** and **MetaGraph** for Root Cause Analysis (RCA).
- Uses `PathQueryGen` to trace failures back to their source configuration.

## Verification Plan
1. **Lexer Verification**: Input raw YAML and output token stream arrays. Ensure `INDENT` and `DEDENT` tokens align with YAML block structures.
2. **Parser Verification**: Feed token streams into the recursive descent procedures and output the CST.
3. **Symbol Table Tests**: Validate that namespace-scoped lookups correctly fall back to global scope (Cactus Stack traversal).
4. **DAG Cycle Tests**: Provide a manifest with an intentional cycle and verify the $O(V+E)$ DFS traps it.
