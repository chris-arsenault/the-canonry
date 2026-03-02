/**
 * AxisRegistry types - Shared type definitions for axis registry components.
 */

import type { Optional } from "@the-canonry/shared-components";

export interface TagEntry {
  tag: string;
  description: Optional<string>;
  category: Optional<string>;
  isAxis: Optional<boolean>;
  mutuallyExclusiveWith: Optional<string[]>;
}

export interface AxisDefinition {
  id: string;
  name: string;
  description: Optional<string>;
  lowTag: string;
  highTag: string;
}

export interface AxisUsageEntry {
  kind: string;
  description: Optional<string>;
  axis: string;
}

export interface EntityKind {
  kind: string;
  description: Optional<string>;
  semanticPlane: Optional<{
    axes: Optional<Record<string, { axisId: Optional<string> }>>;
  }>;
}

export interface AxisFormData {
  id: string;
  name: string;
  description: string;
  lowTag: string;
  highTag: string;
}
