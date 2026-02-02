import type { CohesionReport, CohesionCheck, SectionGoalCheck, CohesionIssue, ChroniclePlan } from '../chronicleTypes';

export function parseValidationResponse(
  response: string,
  plan: ChroniclePlan
): CohesionReport {
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const parsed = JSON.parse(jsonStr.trim());

  const report: CohesionReport = {
    overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 50,
    checks: {
      plotStructure: normalizeCheck(parsed.checks?.plotStructure),
      entityConsistency: normalizeCheck(parsed.checks?.entityConsistency),
      sectionGoals: normalizeSectionGoals(parsed.checks?.sectionGoals, plan.sections),
      resolution: normalizeCheck(parsed.checks?.resolution),
      factualAccuracy: normalizeCheck(parsed.checks?.factualAccuracy),
      themeExpression: normalizeCheck(parsed.checks?.themeExpression),
    },
    issues: (parsed.issues || []).map(normalizeIssue),
    generatedAt: Date.now(),
  };

  return report;
}

function normalizeCheck(check: unknown): CohesionCheck {
  if (!check || typeof check !== 'object') {
    return { pass: false, notes: 'Not evaluated' };
  }
  const obj = check as Record<string, unknown>;
  return {
    pass: Boolean(obj.pass),
    notes: String(obj.notes || ''),
  };
}

function normalizeSectionGoals(
  goals: unknown,
  sections: { id: string }[]
): SectionGoalCheck[] {
  if (!Array.isArray(goals)) {
    return sections.map((section) => ({
      sectionId: section.id,
      pass: false,
      notes: 'Not evaluated',
    }));
  }

  return goals.map((g: unknown) => {
    if (!g || typeof g !== 'object') {
      return { sectionId: 'unknown', pass: false, notes: 'Invalid' };
    }
    const obj = g as Record<string, unknown>;
    return {
      sectionId: String(obj.sectionId || 'unknown'),
      pass: Boolean(obj.pass),
      notes: String(obj.notes || ''),
    };
  });
}

function normalizeIssue(issue: unknown): CohesionIssue {
  if (!issue || typeof issue !== 'object') {
    return {
      severity: 'minor',
      checkType: 'unknown',
      description: 'Invalid issue',
      suggestion: '',
    };
  }
  const obj = issue as Record<string, unknown>;
  return {
    severity: obj.severity === 'critical' ? 'critical' : 'minor',
    sectionId: obj.sectionId ? String(obj.sectionId) : undefined,
    checkType: String(obj.checkType || 'unknown'),
    description: String(obj.description || ''),
    suggestion: String(obj.suggestion || ''),
  };
}
