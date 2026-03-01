// scripts/audit-optional-properties.ts
/**
 * Audit optional properties across strict-mode TypeScript packages.
 *
 * For each interface/type with optional properties (?:), finds all object
 * literal construction sites and checks whether the property is always assigned.
 * Properties assigned at 95%+ of sites are flagged as candidates for removal.
 *
 * Output: ranked list from most-always-assigned to least.
 *
 * Usage: pnpm audit:optionality
 */

import { Project, SyntaxKind, Node } from 'ts-morph';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Strict-mode source directories to scan
const SCAN_GLOBS = [
  'packages/*/src/**/*.ts',
  'packages/*/src/**/*.tsx',
  'apps/lore-weave/lib/**/*.ts',
  'apps/name-forge/lib/**/*.ts',
];

const THRESHOLD = 0.95; // flag if assigned in >=95% of sites

interface Finding {
  interfaceName: string;
  propertyName: string;
  file: string;
  assignedCount: number;
  totalCount: number;
  rate: number;
}

function collectOptionalProperties(node: Node): string[] {
  const props: string[] = [];
  if (Node.isInterfaceDeclaration(node)) {
    for (const member of node.getMembers()) {
      if (Node.isPropertySignature(member) && member.hasQuestionToken()) {
        props.push(member.getName());
      }
    }
  } else if (Node.isTypeAliasDeclaration(node)) {
    const typeNode = node.getTypeNode();
    if (typeNode && Node.isTypeLiteral(typeNode)) {
      for (const member of typeNode.getMembers()) {
        if (Node.isPropertySignature(member) && member.hasQuestionToken()) {
          props.push(member.getName());
        }
      }
    }
  }
  return props;
}

function findObjectLiteralsForDecl(decl: Node): Node[] {
  const objectLiterals: Node[] = [];
  const refs = (decl as any).findReferences?.() ?? [];
  for (const ref of refs) {
    for (const r of ref.getReferences()) {
      let current: Node | undefined = r.getNode().getParent();
      while (current) {
        if (Node.isObjectLiteralExpression(current)) {
          objectLiterals.push(current);
          break;
        }
        // Stop at statement boundaries
        if (
          Node.isStatement(current) ||
          Node.isSourceFile(current) ||
          Node.isArrowFunction(current) ||
          Node.isFunctionDeclaration(current)
        ) {
          break;
        }
        current = current.getParent();
      }
    }
  }
  return objectLiterals;
}

async function main() {
  console.log('Loading project...');

  const project = new Project({
    compilerOptions: {
      strict: true,
      skipLibCheck: true,
    },
    skipAddingFilesFromTsConfig: true,
  });

  for (const glob of SCAN_GLOBS) {
    project.addSourceFilesAtPaths(path.join(ROOT, glob));
  }

  const sourceFiles = project.getSourceFiles();
  console.log(`Scanning ${sourceFiles.length} source files...\n`);

  const findings: Finding[] = [];

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();
    const relPath = path.relative(ROOT, filePath);

    const decls = [
      ...sourceFile.getInterfaces(),
      ...sourceFile.getTypeAliases(),
    ];

    for (const decl of decls) {
      const optionalProps = collectOptionalProperties(decl);
      if (optionalProps.length === 0) continue;

      const declName = decl.getName() ?? '(anonymous)';
      const objectLiterals = findObjectLiteralsForDecl(decl);

      if (objectLiterals.length < 3) continue; // need enough sites to be meaningful

      for (const propName of optionalProps) {
        let assigned = 0;
        for (const literal of objectLiterals) {
          if (Node.isObjectLiteralExpression(literal)) {
            const hasIt = literal.getProperties().some(
              (p) => Node.isPropertyAssignment(p) && p.getName() === propName
            );
            if (hasIt) assigned++;
          }
        }

        const total = objectLiterals.length;
        const rate = assigned / total;

        if (rate >= THRESHOLD) {
          findings.push({
            interfaceName: declName,
            propertyName: propName,
            file: relPath,
            assignedCount: assigned,
            totalCount: total,
            rate,
          });
        }
      }
    }
  }

  findings.sort((a, b) => b.rate - a.rate || b.totalCount - a.totalCount);

  if (findings.length === 0) {
    console.log('No high-confidence unnecessary optional properties found.');
    return;
  }

  console.log(`Found ${findings.length} properties that are optional but always (or near-always) assigned:\n`);
  const header =
    'Rate    '.padEnd(8) +
    'Sites   '.padEnd(10) +
    'Interface'.padEnd(36) +
    'Property'.padEnd(28) +
    'File';
  console.log(header);
  console.log('-'.repeat(100));

  for (const f of findings) {
    const rate = `${(f.rate * 100).toFixed(0)}%`.padEnd(8);
    const sites = `${f.assignedCount}/${f.totalCount}`.padEnd(10);
    const iface = f.interfaceName.slice(0, 35).padEnd(36);
    const prop = f.propertyName.slice(0, 27).padEnd(28);
    console.log(`${rate}${sites}${iface}${prop}${f.file}`);
  }

  console.log(`\nThreshold: >=${THRESHOLD * 100}% assignment rate across >=3 construction sites.`);
  console.log('Consider removing ? from these property signatures and making them required.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
