export type {
  SourceSpan,
  Diagnostic,
  Value,
  BlockNode,
  StatementNode,
  AstFile,
  CompileResult,
  StaticPagesCompileResult
} from './types.js';

export { parseCanon } from './parser.js';
export { compileCanonProject, compileCanonStaticPages } from './compile.js';
export { serializeCanonProject, serializeCanonStaticPages } from './serialize.js';
export type { CanonFile, StaticPageRecord } from './serialize.js';
