/**
 * RuleCardHeader - Collapsed summary display for a rule card.
 */

import React from "react";
import type { Rule } from "./types";

interface RuleCardHeaderProps {
  readonly rule: Rule;
  readonly expanded: boolean;
}

export function RuleCardHeader({ rule, expanded }: RuleCardHeaderProps) {
  const operator = rule.condition?.operator ?? ">=";
  const threshold = rule.condition?.threshold ?? "?";
  const actionType = rule.action?.type ?? "?";
  const delta = rule.action?.delta;
  const deltaSign = delta !== undefined && delta >= 0 ? "+" : "";
  const deltaDisplay = delta ?? "?";
  const probability = (rule.probability * 100).toFixed(0);

  return (
    <>
      <div className="item-card-icon cet-rule-icon">R</div>
      <div className="item-card-info">
        <div className="item-card-title">
          {operator} {threshold}
        </div>
        <div className="item-card-subtitle">
          {actionType} ({deltaSign}{deltaDisplay}) - {probability}% chance
        </div>
      </div>
      <div className="item-card-actions">
        <button className="btn-icon">{expanded ? "^" : "v"}</button>
      </div>
    </>
  );
}
