export type SearchScope =
  | "chronicleContent"
  | "chronicleTitles"
  | "chronicleAnnotations"
  | "entityAnnotations"
  | "eraNarrativeContent";

export interface CorpusMatch {
  id: string;
  scope: SearchScope;
  sourceId: string;
  sourceName: string;
  noteId?: string;
  noteText?: string;
  /** For chronicle content: 'final' | 'assembled' | versionId */
  contentField?: string;
  contentFieldLabel?: string;
  position: number;
  contextBefore: string;
  matchedText: string;
  contextAfter: string;
  /** For LLM mode: batch correlation index */
  batchIndex?: number;
}

export type Phase =
  | "input"
  | "scanning"
  | "preview"
  | "generating"
  | "review"
  | "applying"
  | "done"
  | "empty";

export const CONTEXT_RADIUS = 80;
export const BATCH_SIZE = 8;

export const SCOPE_LABELS: Record<SearchScope, string> = {
  chronicleContent: "Chronicle Content",
  chronicleTitles: "Chronicle Titles",
  chronicleAnnotations: "Chronicle Annotations",
  entityAnnotations: "Entity Annotations",
  eraNarrativeContent: "Era Narratives",
};

export const ALL_SCOPES: SearchScope[] = [
  "chronicleContent",
  "chronicleTitles",
  "chronicleAnnotations",
  "entityAnnotations",
  "eraNarrativeContent",
];

export interface SourceGroupData {
  key: string;
  label: string;
  matches: CorpusMatch[];
}

export interface ScopeGroupData {
  scope: SearchScope;
  label: string;
  sourceGroups: SourceGroupData[];
}
