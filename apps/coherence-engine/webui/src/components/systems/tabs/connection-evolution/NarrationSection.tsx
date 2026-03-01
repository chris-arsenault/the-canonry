/**
 * NarrationSection - Narration template editor with syntax hint.
 */

import React, { useCallback } from "react";
import { LocalTextArea } from "../../../shared";
import type { Rule } from "./types";

interface NarrationSectionProps {
  readonly rule: Rule;
  readonly onChange: (rule: Rule) => void;
}

export function NarrationSection({ rule, onChange }: NarrationSectionProps) {
  const handleChange = useCallback(
    (value: string) =>
      onChange({ ...rule, narrationTemplate: value || undefined }),
    [onChange, rule],
  );

  return (
    <div className="mt-xl">
      <span className="label">Narration Template</span>
      <div className="section-desc mb-xs text-xs">
        Syntax: {"{$self.field}"}, {"{$member.field}"}, {"{$member2.field}"},{" "}
        {"{field|fallback}"}.
      </div>
      <LocalTextArea
        value={rule.narrationTemplate || ""}
        onChange={handleChange}
        placeholder="e.g., {$member.name} and {$member2.name} forged an alliance."
        rows={2}
        className="cet-narration-textarea"
      />
    </div>
  );
}
