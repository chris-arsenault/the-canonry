/**
 * ChroniclePlanEditor - Review chronicle plans before expansion
 *
 * Displays the structured plan from Step 1 and lets the user:
 * - Review plan elements (entities, plot, sections)
 * - Regenerate the plan if needed
 * - Approve the plan to start section expansion
 *
 * See CHRONICLE_DESIGN.md for architecture documentation.
 */

import { useMemo } from 'react';

function resolveName(map, id) {
  if (!id) return '';
  return map?.get(id)?.name || id;
}

function resolveEvent(map, id) {
  if (!id) return '';
  return map?.get(id)?.headline || id;
}

function PlanHeader({ plan }) {
  const outline = plan.format === 'document' ? plan.documentOutline : plan.storyOutline;
  const summaryItems = [];
  if (plan.format === 'document' && outline?.purpose) {
    summaryItems.push({ label: 'Purpose', value: outline.purpose });
  }
  if (plan.format === 'story' && outline?.theme) {
    summaryItems.push({ label: 'Theme', value: outline.theme });
  }
  if (outline?.tone) {
    summaryItems.push({ label: 'Tone', value: outline.tone });
  }
  if (outline?.era) {
    summaryItems.push({ label: 'Era', value: outline.era });
  }

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Plan Title</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{plan.title}</div>
        </div>
        <span
          style={{
            fontSize: '10px',
            padding: '4px 8px',
            background: plan.format === 'document' ? '#059669' : 'var(--accent-primary)',
            color: 'white',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {plan.format}
        </span>
      </div>
      {summaryItems.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
          {summaryItems.map((item) => (
            <span key={item.label} style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              <strong>{item.label}:</strong> {item.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatEntityList(ids, entityMap, limit = 6) {
  if (!ids || ids.length === 0) return '(none)';
  const names = ids.map((id) => resolveName(entityMap, id));
  if (names.length <= limit) return names.join(', ');
  return `${names.slice(0, limit).join(', ')} +${names.length - limit} more`;
}

function FocusSummary({ plan, entityMap }) {
  const focus = plan.focus;
  if (!focus) return null;

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Focus</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Mode:</strong> {focus.mode}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Entrypoint:</strong> {resolveName(entityMap, focus.entrypointId)}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Primary Entities:</strong> {formatEntityList(focus.primaryEntityIds, entityMap)}
      </div>
      {focus.supportingEntityIds?.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          <strong>Supporting Entities:</strong> {formatEntityList(focus.supportingEntityIds, entityMap)}
        </div>
      )}
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        <strong>Selected Cast:</strong> {focus.selectedEntityIds.length} entities • {focus.selectedEventIds.length} events
      </div>
    </div>
  );
}

function OutlineSummary({ plan }) {
  if (plan.format === 'document') {
    const outline = plan.documentOutline;
    if (!outline) return null;

    const optionalMeta = [
      outline.veracity ? `Veracity: ${outline.veracity}` : '',
      outline.legitimacy ? `Legitimacy: ${outline.legitimacy}` : '',
      outline.audience ? `Audience: ${outline.audience}` : '',
      outline.authorProvenance ? `Provenance: ${outline.authorProvenance}` : '',
      outline.biasAgenda ? `Bias/Agenda: ${outline.biasAgenda}` : '',
      outline.intendedOutcome ? `Intended Outcome: ${outline.intendedOutcome}` : '',
    ].filter(Boolean);

    return (
      <div
        style={{
          padding: '16px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Document Outline</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          <strong>Purpose:</strong> {outline.purpose}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          <strong>Era:</strong> {outline.era}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          <strong>Tone:</strong> {outline.tone}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          <strong>Key Points:</strong>
          <ul style={{ margin: '6px 0 0 16px', fontSize: '12px' }}>
            {outline.keyPoints.map((point, idx) => (
              <li key={`${point}-${idx}`}>{point}</li>
            ))}
          </ul>
        </div>
        {optionalMeta.length > 0 && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Optional:</strong> {optionalMeta.join(' • ')}
          </div>
        )}
      </div>
    );
  }

  const outline = plan.storyOutline;
  if (!outline) return null;

  const optionalMeta = [
    outline.stakes ? `Stakes: ${outline.stakes}` : '',
    outline.transformation ? `Transformation: ${outline.transformation}` : '',
    outline.intendedImpact ? `Intended Impact: ${outline.intendedImpact}` : '',
  ].filter(Boolean);

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Story Outline</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Purpose:</strong> {outline.purpose}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Theme:</strong> {outline.theme}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Era:</strong> {outline.era}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Tone:</strong> {outline.tone}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Key Points:</strong>
        <ul style={{ margin: '6px 0 0 16px', fontSize: '12px' }}>
          {outline.keyPoints.map((point, idx) => (
            <li key={`${point}-${idx}`}>{point}</li>
          ))}
        </ul>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
        <strong>Emotional Beats:</strong>
        <ul style={{ margin: '6px 0 0 16px', fontSize: '12px' }}>
          {outline.emotionalBeats.map((beat, idx) => (
            <li key={`${beat}-${idx}`}>{beat}</li>
          ))}
        </ul>
      </div>
      {optionalMeta.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          <strong>Optional:</strong> {optionalMeta.join(' • ')}
        </div>
      )}
    </div>
  );
}

function PlotSummary({ plan }) {
  const plot = plan.plot;
  if (!plot) return null;

  const beats = plot.normalizedBeats || [];
  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>
        Structure ({plot.type})
      </div>
      {beats.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No structure beats defined.</div>
      ) : (
        <ol style={{ margin: '0 0 0 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {beats.map((beat, idx) => (
            <li key={`${beat.description}-${idx}`}>{beat.description}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

function EntityRoleList({ plan, entityMap }) {
  if (!plan.entityRoles || plan.entityRoles.length === 0) return null;

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Entities</div>
      {plan.entityRoles.map((role) => (
        <div
          key={role.entityId}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            marginBottom: '8px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
            {resolveName(entityMap, role.entityId)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Role:</strong> {role.role}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Contribution:</strong> {role.contribution}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionCard({ section, index, format, entityMap, eventMap }) {
  const entities = section.entityIds?.map((id) => resolveName(entityMap, id)) || [];
  const events = section.eventIds?.map((id) => resolveEvent(eventMap, id)) || [];

  return (
    <div
      style={{
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>
          Section {index + 1}: {section.name}
        </div>
        {section.optional && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-muted)',
            }}
          >
            optional
          </span>
        )}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
        <strong>Purpose:</strong> {section.purpose}
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
        <strong>Goal:</strong> {section.goal}
      </div>
      {section.wordCountTarget && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          <strong>Word Target:</strong> {section.wordCountTarget}
        </div>
      )}
      {format === 'story' && (
        <>
          {section.emotionalArc && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <strong>Emotional Arc:</strong> {section.emotionalArc}
            </div>
          )}
          {section.requiredElements && section.requiredElements.length > 0 && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              <strong>Required Elements:</strong> {section.requiredElements.join(', ')}
            </div>
          )}
        </>
      )}
      {format === 'document' && section.contentGuidance && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          <strong>Content Guidance:</strong> {section.contentGuidance}
        </div>
      )}
      {entities.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          <strong>Entities:</strong> {entities.join(', ')}
        </div>
      )}
      {events.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          <strong>Events:</strong> {events.join(', ')}
        </div>
      )}
    </div>
  );
}

function SectionsList({ plan, entityMap, eventMap }) {
  if (!plan.sections || plan.sections.length === 0) return null;

  return (
    <div>
      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>Sections</div>
      {plan.sections.map((section, index) => (
        <SectionCard
          key={section.id}
          section={section}
          index={index}
          format={plan.format}
          entityMap={entityMap}
          eventMap={eventMap}
        />
      ))}
    </div>
  );
}

export default function ChroniclePlanEditor({
  plan,
  entityMap,
  eventMap,
  onRegenerate,
  onApprove,
  isGenerating = false,
}) {
  const sectionCount = plan.sections?.length || 0;

  const eventStats = useMemo(() => {
    const eventIds = new Set();
    plan.sections?.forEach((section) => {
      section.eventIds?.forEach((id) => eventIds.add(id));
    });
    return eventIds.size;
  }, [plan.sections]);

  return (
    <div style={{ maxWidth: '900px' }}>
      <PlanHeader plan={plan} />
      <OutlineSummary plan={plan} />
      <FocusSummary plan={plan} entityMap={entityMap} />
      <PlotSummary plan={plan} />
      <EntityRoleList plan={plan} entityMap={entityMap} />

      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <strong>Sections:</strong> {sectionCount}
        </div>
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}
        >
          <strong>Referenced Events:</strong> {eventStats}
        </div>
      </div>

      <SectionsList plan={plan} entityMap={entityMap} eventMap={eventMap} />

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          marginTop: '24px',
        }}
      >
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="illuminator-button"
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            opacity: isGenerating ? 0.6 : 1,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          Regenerate Plan
        </button>
        <button
          onClick={onApprove}
          disabled={isGenerating}
          className="illuminator-button illuminator-button-primary"
          style={{
            padding: '10px 18px',
            fontSize: '13px',
            opacity: isGenerating ? 0.6 : 1,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
          }}
        >
          Approve Plan
        </button>
      </div>
    </div>
  );
}
