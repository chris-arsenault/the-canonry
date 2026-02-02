import peggy from 'peggy';
import { cannonGrammar } from './grammar.js';
import type { StatementNode } from './types.js';

const parser = peggy.generate(cannonGrammar, { output: 'parser' });

export function parseCanon(source: string, file: string): StatementNode[] {
  return parser.parse(source, { file }) as StatementNode[];
}
