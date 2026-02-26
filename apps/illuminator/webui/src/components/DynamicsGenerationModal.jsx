/**
 * DynamicsGenerationModal - Multi-turn conversation UI for generating world dynamics
 *
 * Shows a modal with:
 * - Conversation history (system context, LLM responses, user feedback)
 * - Current proposed dynamics
 * - Feedback input for steering
 * - Accept/cancel controls
 */

import React, { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import "./DynamicsGenerationModal.css";

// ============================================================================
// Message Display
// ============================================================================

function MessageBubble({ message }) {
  const isAssistant = message.role === "assistant";
  const isSystem = message.role === "system";

  // Parse assistant messages to extract reasoning
  let reasoning = "";
  if (isAssistant) {
    try {
      // eslint-disable-next-line sonarjs/slow-regex -- bounded LLM response text
      const json = JSON.parse(message.content.match(/\{[\s\S]*\}/)?.[0] || "{}");
      reasoning = json.reasoning || "";
    } catch {
      reasoning = message.content;
    }
  }

  if (isSystem) {
    return (
      <div className="dgm-bubble-system">
        <div className="dgm-bubble-system-heading">Initial Context</div>
        <div className="dgm-bubble-system-preview">{message.content.substring(0, 200)}...</div>
      </div>
    );
  }

  return (
    <div className={`dgm-bubble ${isAssistant ? "dgm-bubble-assistant" : "dgm-bubble-user"}`}>
      <div
        className={`dgm-bubble-role ${isAssistant ? "dgm-bubble-role-assistant" : "dgm-bubble-role-user"}`}
      >
        {isAssistant ? "Assistant" : "You"}
      </div>
      <div className="dgm-bubble-content">{isAssistant ? reasoning : message.content}</div>
    </div>
  );
}

// ============================================================================
// Proposed Dynamics Display
// ============================================================================

function ProposedDynamicsList({ dynamics }) {
  if (!dynamics || dynamics.length === 0) return null;

  return (
    <div className="dgm-proposed">
      <div className="dgm-proposed-heading">Proposed Dynamics ({dynamics.length})</div>
      {dynamics.map((d, i) => (
        <div key={i} className="dgm-proposed-item">
          <div>{d.text}</div>
          {(d.cultures?.length > 0 || d.kinds?.length > 0) && (
            <div className="dgm-proposed-meta">
              {d.cultures?.length > 0 && <span>Cultures: {d.cultures.join(", ")} </span>}
              {d.kinds?.length > 0 && <span>Kinds: {d.kinds.join(", ")}</span>}
            </div>
          )}
          {d.eraOverrides && Object.keys(d.eraOverrides).length > 0 && (
            <div className="dgm-proposed-overrides">
              {Object.entries(d.eraOverrides).map(([eraId, override]) => (
                <div key={eraId} className="dgm-proposed-override-item">
                  <span className="dgm-proposed-override-label">
                    {override.replace ? "[replaces]" : "[adds]"} {eraId}:
                  </span>{" "}
                  {override.text}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Modal
// ============================================================================

export default function DynamicsGenerationModal({
  run,
  isActive,
  onSubmitFeedback,
  onAccept,
  onCancel,
}) {
  const [feedback, setFeedback] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [run?.messages?.length, run?.proposedDynamics?.length]);

  if (!isActive || !run) return null;

  const isGenerating = run.status === "generating" || run.status === "pending";
  const isReviewable = run.status === "awaiting_review";
  const isFailed = run.status === "failed";

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) return;
    onSubmitFeedback(feedback.trim());
    setFeedback("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmitFeedback();
    }
  };

  const displayMessages = run.messages || [];

  return (
    <div className="dgm-overlay">
      <div className="dgm-dialog">
        {/* Header */}
        <div className="dgm-header">
          <div>
            <h2 className="dgm-title">Generate World Dynamics</h2>
            <p className="dgm-subtitle">
              Multi-turn conversation with the LLM to synthesize dynamics from lore
            </p>
          </div>
          <div className="dgm-header-actions">
            {run.totalActualCost > 0 && (
              <span className="dgm-cost">${run.totalActualCost.toFixed(4)}</span>
            )}
            <button
              onClick={onCancel}
              className="illuminator-button illuminator-button-secondary dgm-cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Scrollable content area: messages + proposed dynamics */}
        <div className="dgm-content">
          {displayMessages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {isGenerating && <div className="dgm-generating">Generating...</div>}

          {isFailed && <div className="dgm-failed">{run.error || "Generation failed"}</div>}

          {/* Proposed dynamics inside scrollable area */}
          {isReviewable && run.proposedDynamics && (
            <ProposedDynamicsList dynamics={run.proposedDynamics} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer: feedback input + actions (always visible) */}
        <div className="dgm-footer">
          {/* Feedback input */}
          {(isReviewable || isFailed) && (
            <div className="dgm-feedback-row">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isFailed
                    ? "Provide feedback and retry..."
                    : 'Steer the dynamics (e.g., "focus more on trade conflicts", "add era-specific tensions")...'
                }
                className="illuminator-input dgm-feedback-input"
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="dgm-actions">
            {(isReviewable || isFailed) && (
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedback.trim()}
                className="illuminator-button illuminator-button-secondary dgm-action-btn"
              >
                {isFailed ? "Retry with Feedback" : "Refine"}
              </button>
            )}
            {isReviewable && (
              <button
                onClick={onAccept}
                className="illuminator-button illuminator-button-primary dgm-action-btn"
              >
                Accept Dynamics ({run.proposedDynamics?.length || 0})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

MessageBubble.propTypes = {
  message: PropTypes.object.isRequired,
};

ProposedDynamicsList.propTypes = {
  dynamics: PropTypes.array,
};

DynamicsGenerationModal.propTypes = {
  run: PropTypes.object,
  isActive: PropTypes.bool,
  onSubmitFeedback: PropTypes.func.isRequired,
  onAccept: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
