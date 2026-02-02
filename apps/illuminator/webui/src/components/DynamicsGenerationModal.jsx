/**
 * DynamicsGenerationModal - Multi-turn conversation UI for generating world dynamics
 *
 * Shows a modal with:
 * - Conversation history (system context, LLM responses, user feedback)
 * - Current proposed dynamics
 * - Feedback input for steering
 * - Accept/cancel controls
 */

import { useState, useRef, useEffect } from 'react';

// ============================================================================
// Message Display
// ============================================================================

function MessageBubble({ message }) {
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Parse assistant messages to extract reasoning
  let reasoning = '';
  if (isAssistant) {
    try {
      const json = JSON.parse(message.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
      reasoning = json.reasoning || '';
    } catch {
      reasoning = message.content;
    }
  }

  if (isSystem) {
    return (
      <div style={{
        padding: '8px 12px',
        fontSize: '11px',
        color: 'var(--text-muted)',
        background: 'var(--bg-tertiary)',
        borderRadius: '6px',
        marginBottom: '8px',
        maxHeight: '100px',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>Initial Context</div>
        <div style={{ opacity: 0.7 }}>
          {message.content.substring(0, 200)}...
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 12px',
      fontSize: '12px',
      background: isAssistant ? 'var(--bg-tertiary)' : 'transparent',
      borderRadius: '6px',
      borderLeft: isAssistant ? '3px solid var(--accent-color)' : isUser ? '3px solid var(--success-color, #22c55e)' : 'none',
      marginBottom: '8px',
    }}>
      <div style={{
        fontWeight: 600,
        marginBottom: '4px',
        fontSize: '11px',
        color: isAssistant ? 'var(--accent-color)' : 'var(--success-color, #22c55e)',
      }}>
        {isAssistant ? 'Assistant' : 'You'}
      </div>
      <div style={{ lineHeight: '1.5', color: 'var(--text-primary)' }}>
        {isAssistant ? reasoning : message.content}
      </div>
    </div>
  );
}

// ============================================================================
// Proposed Dynamics Display
// ============================================================================

function ProposedDynamicsList({ dynamics }) {
  if (!dynamics || dynamics.length === 0) return null;

  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: '6px',
      border: '1px solid var(--accent-color)',
      padding: '12px',
      marginBottom: '12px',
    }}>
      <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '13px' }}>
        Proposed Dynamics ({dynamics.length})
      </div>
      {dynamics.map((d, i) => (
        <div key={i} style={{
          padding: '8px 10px',
          background: 'var(--bg-secondary)',
          borderRadius: '4px',
          marginBottom: '6px',
          fontSize: '12px',
        }}>
          <div>{d.text}</div>
          {(d.cultures?.length > 0 || d.kinds?.length > 0) && (
            <div style={{ marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
              {d.cultures?.length > 0 && <span>Cultures: {d.cultures.join(', ')} </span>}
              {d.kinds?.length > 0 && <span>Kinds: {d.kinds.join(', ')}</span>}
            </div>
          )}
          {d.eraOverrides && Object.keys(d.eraOverrides).length > 0 && (
            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
              {Object.entries(d.eraOverrides).map(([eraId, override]) => (
                <div key={eraId} style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {override.replace ? '[replaces]' : '[adds]'} {eraId}:
                  </span>{' '}
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
  const [feedback, setFeedback] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [run?.messages?.length, run?.proposedDynamics?.length]);

  if (!isActive || !run) return null;

  const isGenerating = run.status === 'generating' || run.status === 'pending';
  const isReviewable = run.status === 'awaiting_review';
  const isFailed = run.status === 'failed';

  const handleSubmitFeedback = () => {
    if (!feedback.trim()) return;
    onSubmitFeedback(feedback.trim());
    setFeedback('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitFeedback();
    }
  };

  const displayMessages = run.messages || [];

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        width: '700px',
        maxWidth: '90vw',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px' }}>Generate World Dynamics</h2>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
              Multi-turn conversation with the LLM to synthesize dynamics from lore
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {run.totalActualCost > 0 && (
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                ${run.totalActualCost.toFixed(4)}
              </span>
            )}
            <button
              onClick={onCancel}
              className="illuminator-button illuminator-button-secondary"
              style={{ padding: '4px 12px', fontSize: '12px' }}
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Scrollable content area: messages + proposed dynamics */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px 20px',
          minHeight: 0,
        }}>
          {displayMessages.map((msg, i) => (
            <MessageBubble key={i} message={msg} />
          ))}

          {isGenerating && (
            <div style={{
              padding: '12px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              Generating...
            </div>
          )}

          {isFailed && (
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-tertiary)',
              borderRadius: '6px',
              borderLeft: '3px solid var(--danger)',
              fontSize: '12px',
              color: 'var(--danger)',
              marginBottom: '8px',
            }}>
              {run.error || 'Generation failed'}
            </div>
          )}

          {/* Proposed dynamics inside scrollable area */}
          {isReviewable && run.proposedDynamics && (
            <ProposedDynamicsList dynamics={run.proposedDynamics} />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Footer: feedback input + actions (always visible) */}
        <div style={{
          padding: '12px 20px 16px',
          borderTop: '1px solid var(--border-color)',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          {/* Feedback input */}
          {(isReviewable || isFailed) && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isFailed ? 'Provide feedback and retry...' : 'Steer the dynamics (e.g., "focus more on trade conflicts", "add era-specific tensions")...'}
                className="illuminator-input"
                style={{
                  flex: 1,
                  resize: 'vertical',
                  minHeight: '60px',
                  maxHeight: '120px',
                  fontSize: '12px',
                }}
              />
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
            {(isReviewable || isFailed) && (
              <button
                onClick={handleSubmitFeedback}
                disabled={!feedback.trim()}
                className="illuminator-button illuminator-button-secondary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                {isFailed ? 'Retry with Feedback' : 'Refine'}
              </button>
            )}
            {isReviewable && (
              <button
                onClick={onAccept}
                className="illuminator-button illuminator-button-primary"
                style={{ padding: '6px 16px', fontSize: '12px' }}
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
