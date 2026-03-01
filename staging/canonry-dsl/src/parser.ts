import peggy from 'peggy';
import { cannonGrammar } from './grammar';
import type { StatementNode } from './types';

const parser = peggy.generate(cannonGrammar, { output: 'parser' });

export function parseCanon(source: string, file: string): StatementNode[] {
  return parser.parse(source, { file }) as StatementNode[];
}
