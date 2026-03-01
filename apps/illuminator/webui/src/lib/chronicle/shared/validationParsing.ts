import type {
  CohesionReport,
  CohesionCheck,
  SectionGoalCheck,
  CohesionIssue,
  ChroniclePlan,
} from "../../chronicleTypes";

/**
 * Shape we expect from the LLM's JSON validation response.
 * All fields are optional/unknown because we normalise defensively.
 */
interface RawValidationResponse {
  overallScore?: unknown;
  checks?: {
    plotStructure?: unknown;
    entityConsistency?: unknown;
    sectionGoals?: unknown;
    resolution?: unknown;
    factualAccuracy?: unknown;
    themeExpression?: unknown;
  };
  issues?: unknown[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseValidationResponse(response: string, plan: ChroniclePlan): CohesionReport {
  let jsonStr = response;
  // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  const raw = JSON.parse(jsonStr.trim()) as unknown;
  const parsed: RawValidationResponse = isRecord(raw) ? raw : {};
  const checks = isRecord(parsed.checks) ? parsed.checks : {};

  const report: CohesionReport = {
    overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : 50,
    checks: {
      plotStructure: normalizeCheck(checks.plotStructure),
      entityConsistency: normalizeCheck(checks.entityConsistency),
      sectionGoals: normalizeSectionGoals(checks.sectionGoals, plan.sections),
      resolution: normalizeCheck(checks.resolution),
      factualAccuracy: normalizeCheck(checks.factualAccuracy),
      themeExpression: normalizeCheck(checks.themeExpression),
    },
    issues: (Array.isArray(parsed.issues) ? parsed.issues : []).map(normalizeIssue),
    generatedAt: Date.now(),
  };

  return report;
}

function normalizeCheck(check: unknown): CohesionCheck {
  if (!isRecord(check)) {
    return { pass: false, notes: "Not evaluated" };
  }
  return {
    pass: Boolean(check.pass),
    notes: typeof check.notes === "string" ? check.notes : "",
  };
}

function normalizeSectionGoals(goals: unknown, sections: { id: string }[]): SectionGoalCheck[] {
  if (!Array.isArray(goals)) {
    return sections.map((section) => ({
      sectionId: section.id,
      pass: false,
      notes: "Not evaluated",
    }));
  }

  return goals.map((g: unknown) => {
    if (!isRecord(g)) {
      return { sectionId: "unknown", pass: false, notes: "Invalid" };
    }
    return {
      sectionId: typeof g.sectionId === "string" ? g.sectionId : "unknown",
      pass: Boolean(g.pass),
      notes: typeof g.notes === "string" ? g.notes : "",
    };
  });
}

function normalizeIssue(issue: unknown): CohesionIssue {
  if (!isRecord(issue)) {
    return {
      severity: "minor",
      checkType: "unknown",
      description: "Invalid issue",
      suggestion: "",
    };
  }
  return {
    severity: issue.severity === "critical" ? "critical" : "minor",
    sectionId: typeof issue.sectionId === "string" ? issue.sectionId : undefined,
    checkType: typeof issue.checkType === "string" ? issue.checkType : "unknown",
    description: typeof issue.description === "string" ? issue.description : "",
    suggestion: typeof issue.suggestion === "string" ? issue.suggestion : "",
  };
}
