import type {
  ChroniclePlan,
  ChronicleGenerationContext,
  CohesionReport,
} from '../chronicleTypes';

function formatTags(tags?: Record<string, string>): string {
  if (!tags || Object.keys(tags).length === 0) return '(none)';
  return Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

export function formatFocusSummary(
  plan: ChroniclePlan,
  context: ChronicleGenerationContext
): string {
  const entityMap = new Map(context.entities.map((entity) => [entity.id, entity]));
  const nameForId = (id: string) => entityMap.get(id)?.name || id;

  const lines = [
    `Focus Mode: ${plan.focus.mode}`,
    `Entrypoint: ${nameForId(plan.focus.entrypointId)}`,
    plan.focus.primaryEntityIds?.length
      ? `Primary: ${plan.focus.primaryEntityIds.map(nameForId).join(', ')}`
      : '',
    plan.focus.supportingEntityIds?.length
      ? `Supporting: ${plan.focus.supportingEntityIds.map(nameForId).join(', ')}`
      : '',
  ].filter(Boolean);

  return lines.join('\n');
}

export function formatEntityRoster(
  plan: ChroniclePlan,
  context: ChronicleGenerationContext
): string {
  const entityMap = new Map(context.entities.map((entity) => [entity.id, entity]));

  if (!plan.entityRoles || plan.entityRoles.length === 0) {
    return '(none)';
  }

  return plan.entityRoles
    .map((role) => {
      const entity = entityMap.get(role.entityId);
      const name = entity?.name || role.entityId;
      const kind = entity?.kind || 'unknown';
      const subtype = entity?.subtype ? `/${entity.subtype}` : '';
      const culture = entity?.culture || '(none)';
      const tags = formatTags(entity?.tags);

      return `- ${name} (${kind}${subtype})
  Role: ${role.role}
  Contribution: ${role.contribution}
  Culture: ${culture}
  Tags: ${tags}`;
    })
    .join('\n');
}

export function formatIssueList(report: CohesionReport, plan?: ChroniclePlan): string {
  if (!report.issues || report.issues.length === 0) {
    return '(no issues listed)';
  }

  const sectionMap = new Map(plan?.sections?.map((s) => [s.id, s.name]) || []);

  return report.issues
    .map((issue, index) => {
      const sectionName = issue.sectionId
        ? sectionMap.get(issue.sectionId) || issue.sectionId
        : 'General';
      const suggestion = issue.suggestion ? `Suggestion: ${issue.suggestion}` : 'Suggestion: (none provided)';
      return `${index + 1}. [${issue.severity}] ${issue.checkType} (Section: ${sectionName})
   ${issue.description}
   ${suggestion}`;
    })
    .join('\n');
}
