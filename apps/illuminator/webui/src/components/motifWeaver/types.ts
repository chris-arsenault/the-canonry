export interface WeaveCandidate {
  id: string;
  batchIndex: number;
  entityId: string;
  entityName: string;
  /** The full sentence to rewrite */
  sentence: string;
  /** Character position of sentence start in description */
  sentenceStart: number;
  /** Character position of sentence end in description */
  sentenceEnd: number;
  /** What the regex matched within the sentence */
  matchedConcept: string;
  /** Context before the sentence */
  contextBefore: string;
  /** Context after the sentence */
  contextAfter: string;
}

export type Phase =
  | "scan"
  | "scanning"
  | "confirm"
  | "generating"
  | "review"
  | "applying"
  | "done"
  | "empty";

export interface EntityGroupData {
  entityId: string;
  entityName: string;
  candidates: WeaveCandidate[];
}
