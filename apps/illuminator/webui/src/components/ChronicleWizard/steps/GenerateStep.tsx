/**
 * GenerateStep - Step 5: Summary and generation confirmation
 *
 * Shows a summary of selections before generating.
 */

import { useWizard } from "../WizardContext";
import React from "react";
import "./GenerateStep.css";

interface GenerateStepProps {
  onGenerate: () => void;
}

export default function GenerateStep({ onGenerate: _onGenerate }: Readonly<GenerateStepProps>) {
  const { state, setNarrativeDirection } = useWizard();

  // Count primary vs supporting roles
  const primaryCount = state.roleAssignments.filter((a) => a.isPrimary).length;
  const supportingCount = state.roleAssignments.length - primaryCount;

  return (
    <div>
      {/* Header */}
      <div className="gs-header">
        <h4 className="gs-title">Generate Chronicle</h4>
        <p className="gs-subtitle">
          Review your selections and generate the chronicle.
        </p>
      </div>

      {/* Summary */}
      <div className="gs-summary">
        <div className="gs-summary-grid">
          {/* Style */}
          <div>
            <div className="gs-section-label">
              Narrative Style
            </div>
            <div className="gs-section-value">
              {state.narrativeStyle?.name}
              <span
                className={`gs-format-badge ${state.narrativeStyle?.format === "story" ? "gs-format-badge-story" : "gs-format-badge-document"}`}
              >
                {state.narrativeStyle?.format}
              </span>
            </div>
          </div>

          {/* Entry Point */}
          <div>
            <div className="gs-section-label">
              Entry Point
            </div>
            <div className="gs-section-value">
              {state.entryPoint?.name}
              <span className="gs-section-meta">
                ({state.entryPoint?.kind})
              </span>
            </div>
          </div>

          {/* Ensemble */}
          <div>
            <div className="gs-section-label">
              Ensemble
            </div>
            <div className="gs-section-value">
              {state.roleAssignments.length} entities
              <span className="gs-section-meta">
                ({primaryCount} primary, {supportingCount} supporting)
              </span>
            </div>
          </div>

          {/* Events & Relationships */}
          <div>
            <div className="gs-section-label">
              Context
            </div>
            <div className="gs-section-value">
              {state.selectedEventIds.size} events, {state.selectedRelationshipIds.size}{" "}
              relationships
            </div>
          </div>
        </div>

        {/* Narrative Lens */}
        {state.lens && (
          <div className="gs-lens-section">
            <div className="gs-section-label">
              Narrative Lens
            </div>
            <div className="gs-lens-chip">
              <span className="gs-lens-icon">&#x25C8;</span>
              <span className="gs-lens-name">{state.lens.entityName}</span>
              <span className="gs-lens-kind">
                ({state.lens.entityKind})
              </span>
            </div>
          </div>
        )}

        {/* Role Breakdown */}
        <div className="gs-roles-section">
          <div className="gs-roles-label">
            Role Assignments
          </div>
          <div className="gs-roles-list">
            {state.roleAssignments.map((assignment) => (
              <span
                key={`${assignment.role}-${assignment.entityId}`}
                className={`gs-role-chip ${assignment.isPrimary ? "gs-role-chip-primary" : "gs-role-chip-support"}`}
                style={{
                  '--gs-role-opacity': assignment.isPrimary ? 0.9 : 0.7,
                } as React.CSSProperties}
              >
                <span className="gs-role-name">{assignment.role}</span>
                <span className="gs-role-entity">
                  {assignment.entityName}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Narrative Direction */}
      <div className="gs-direction-section">
        <div className="gs-section-label">
          Narrative Direction
          <span className="gs-direction-optional">
            optional
          </span>
        </div>
        <p className="gs-direction-desc">
          Concrete story purpose that shapes perspective and generation. Leave empty for open-ended
          chronicles.
        </p>
        <textarea
          value={state.narrativeDirection}
          onChange={(e) => setNarrativeDirection(e.target.value)}
          placeholder='e.g. "This is the treaty document that ended the Faction Wars" or "An eyewitness account of the apocalyptic magic that ended the Orca Invasion"'
          className="gs-direction-textarea"
        />
      </div>

      {/* Info Box */}
      <div className="gs-info-box">
        <span className="gs-info-icon">💡</span>
        <span>
          Click &quot;Generate Chronicle&quot; to start generation. The complete chronicle will be ready in
          about 30-60 seconds.
        </span>
      </div>
    </div>
  );
}
