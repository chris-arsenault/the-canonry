export interface SourceSpan {
  file: string;
  start: { line: number; column: number; offset: number };
  end: { line: number; column: number; offset: number };
}

export interface Diagnostic {
  message: string;
  span?: SourceSpan;
  severity: 'error' | 'warning';
}

export interface IdentifierValue {
  type: 'identifier';
  value: string;
  span: SourceSpan;
}

export interface ArrayValue {
  type: 'array';
  items: Value[];
  span: SourceSpan;
}

export interface ObjectEntry {
  key: string;
  value: Value;
  span: SourceSpan;
}

export interface ObjectValue {
  type: 'object';
  entries: ObjectEntry[];
  span: SourceSpan;
}

export interface CallValue {
  type: 'call';
  name: string;
  args: Value[];
  span: SourceSpan;
}

export type Value = string | number | boolean | null | IdentifierValue | ArrayValue | ObjectValue | CallValue;

export interface AttributeNode {
  type: 'attribute';
  key: string;
  value: Value;
  labels?: string[];
  span: SourceSpan;
}

export interface BlockNode {
  type: 'block';
  name: string;
  labels: string[];
  body: StatementNode[];
  span: SourceSpan;
}

export interface RelNode {
  type: 'rel';
  key: string;
  kind: string;
  src: string;
  dst: string;
  value: Value;
  span: SourceSpan;
}

export interface MutateNode {
  type: 'mutate';
  target: string;
  id: string;
  operator: '+=' | '-=';
  value: number;
  span: SourceSpan;
}

export interface PredicateNode {
  type: 'predicate';
  keyword: string;
  field?: string;
  subject: string;
  operator: string;
  value: number;
  span: SourceSpan;
}

export interface InNode {
  type: 'in';
  key: string;
  items: Value[];
  span: SourceSpan;
}

export interface FromNode {
  type: 'from';
  source: string;
  relationship?: string;
  direction?: string;
  span: SourceSpan;
}

export interface BareNode {
  type: 'bare';
  value: Value;
  span: SourceSpan;
}

export type StatementNode =
  | AttributeNode
  | BlockNode
  | RelNode
  | MutateNode
  | PredicateNode
  | InNode
  | FromNode
  | BareNode;

export interface AstFile {
  path: string;
  statements: StatementNode[];
}

export interface CompileResult<TConfig> {
  config: TConfig | null;
  diagnostics: Diagnostic[];
}

export interface StaticPagesCompileResult {
  pages: Record<string, unknown>[] | null;
  diagnostics: Diagnostic[];
}
