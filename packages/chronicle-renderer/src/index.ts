export {
  buildChronicleRender,
  attachImagesToSections,
  resolveHistorianNotes,
  type ChronicleRenderInput,
  type ChronicleRenderOutput,
} from "./buildSections";

export {
  resolveAnchorPhrase,
  type FuzzyAnchorResult,
} from "./fuzzyAnchor";

export type {
  WikiSection,
  WikiSectionImage,
  ChronicleImageRef,
  HistorianNoteInput,
  HistorianNoteResolved,
  EntityImageSource,
} from "./types";
