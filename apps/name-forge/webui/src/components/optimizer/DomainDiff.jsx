import React, { useMemo } from 'react';

/**
 * Compute diff between two domain configs
 * Returns an array of changes with path, old value, and new value
 */
export function computeDomainDiff(initial, optimized) {
  const changes = [];

  if (!initial || !optimized) return changes;

  // Helper to compare arrays
  const arrayDiff = (path, oldArr, newArr, labels) => {
    if (!oldArr && !newArr) return;
    if (!oldArr) {
      changes.push({ path, type: 'added', newValue: newArr });
      return;
    }
    if (!newArr) {
      changes.push({ path, type: 'removed', oldValue: oldArr });
      return;
    }

    // For weight arrays, show significant changes
    const changedIndices = [];
    const maxLen = Math.max(oldArr.length, newArr.length);
    for (let i = 0; i < maxLen; i++) {
      const oldVal = oldArr[i] ?? 0;
      const newVal = newArr[i] ?? 0;
      if (Math.abs(oldVal - newVal) > 0.01) {
        changedIndices.push({
          index: i,
          label: labels?.[i] || `[${i}]`,
          oldVal: typeof oldVal === 'number' ? oldVal.toFixed(2) : oldVal,
          newVal: typeof newVal === 'number' ? newVal.toFixed(2) : newVal,
        });
      }
    }
    if (changedIndices.length > 0) {
      changes.push({ path, type: 'weights', changes: changedIndices });
    }
  };

  // Helper to compare scalars
  const scalarDiff = (path, oldVal, newVal) => {
    if (oldVal === newVal) return;
    if (oldVal === undefined && newVal === undefined) return;

    const oldNum = typeof oldVal === 'number' ? oldVal : null;
    const newNum = typeof newVal === 'number' ? newVal : null;

    if (oldNum !== null && newNum !== null) {
      if (Math.abs(oldNum - newNum) < 0.001) return;
    }

    changes.push({
      path,
      type: 'scalar',
      oldValue: oldVal === undefined ? '(default)' : oldVal,
      newValue: newVal === undefined ? '(default)' : newVal,
    });
  };

  // Helper to compare string arrays (sets)
  const setDiff = (path, oldSet, newSet) => {
    if (!oldSet && !newSet) return;
    const oldItems = new Set(oldSet || []);
    const newItems = new Set(newSet || []);

    const added = [...newItems].filter(x => !oldItems.has(x));
    const removed = [...oldItems].filter(x => !newItems.has(x));

    if (added.length > 0 || removed.length > 0) {
      changes.push({ path, type: 'set', added, removed });
    }
  };

  // Compare phonology
  const ph = { old: initial.phonology, new: optimized.phonology };
  arrayDiff('phonology.consonantWeights', ph.old?.consonantWeights, ph.new?.consonantWeights, ph.old?.consonants);
  arrayDiff('phonology.vowelWeights', ph.old?.vowelWeights, ph.new?.vowelWeights, ph.old?.vowels);
  arrayDiff('phonology.templateWeights', ph.old?.templateWeights, ph.new?.templateWeights, ph.old?.syllableTemplates);
  scalarDiff('phonology.favoredClusterBoost', ph.old?.favoredClusterBoost, ph.new?.favoredClusterBoost);
  setDiff('phonology.favoredClusters', ph.old?.favoredClusters, ph.new?.favoredClusters);
  setDiff('phonology.consonants', ph.old?.consonants, ph.new?.consonants);
  setDiff('phonology.vowels', ph.old?.vowels, ph.new?.vowels);

  if (ph.old?.lengthRange && ph.new?.lengthRange) {
    if (ph.old.lengthRange[0] !== ph.new.lengthRange[0] || ph.old.lengthRange[1] !== ph.new.lengthRange[1]) {
      changes.push({
        path: 'phonology.lengthRange',
        type: 'scalar',
        oldValue: `[${ph.old.lengthRange[0]}, ${ph.old.lengthRange[1]}]`,
        newValue: `[${ph.new.lengthRange[0]}, ${ph.new.lengthRange[1]}]`,
      });
    }
  }

  // Compare morphology
  const mo = { old: initial.morphology, new: optimized.morphology };
  arrayDiff('morphology.prefixWeights', mo.old?.prefixWeights, mo.new?.prefixWeights, mo.old?.prefixes);
  arrayDiff('morphology.suffixWeights', mo.old?.suffixWeights, mo.new?.suffixWeights, mo.old?.suffixes);
  arrayDiff('morphology.structureWeights', mo.old?.structureWeights, mo.new?.structureWeights, mo.old?.structure);

  // Compare style
  const st = { old: initial.style || {}, new: optimized.style || {} };
  scalarDiff('style.apostropheRate', st.old.apostropheRate, st.new.apostropheRate);
  scalarDiff('style.hyphenRate', st.old.hyphenRate, st.new.hyphenRate);
  scalarDiff('style.targetLength', st.old.targetLength, st.new.targetLength);
  scalarDiff('style.lengthTolerance', st.old.lengthTolerance, st.new.lengthTolerance);
  scalarDiff('style.preferredEndingBoost', st.old.preferredEndingBoost, st.new.preferredEndingBoost);
  scalarDiff('style.capitalization', st.old.capitalization, st.new.capitalization);
  scalarDiff('style.rhythmBias', st.old.rhythmBias, st.new.rhythmBias);

  return changes;
}

/**
 * Domain Diff Component - Shows what changed in a collapsible format
 */
export default function DomainDiff({ initial, optimized }) {
  const changes = useMemo(() => computeDomainDiff(initial, optimized), [initial, optimized]);

  if (changes.length === 0) {
    return <div className="text-muted italic p-sm">No changes detected</div>;
  }

  return (
    <div className="text-small">
      {changes.map((change, i) => (
        <div key={i} className={`diff-row ${i % 2 === 0 ? 'alt' : ''}`}>
          <div className="diff-path">
            {change.path}
          </div>

          {change.type === 'scalar' && (
            <div className="flex align-center gap-sm">
              <span className="diff-old">{String(change.oldValue)}</span>
              <span className="text-muted">→</span>
              <span className="diff-new">{String(change.newValue)}</span>
            </div>
          )}

          {change.type === 'set' && (
            <div className="flex flex-wrap gap-xs">
              {change.removed.map((item, j) => (
                <span key={`r${j}`} className="diff-tag removed">-{item}</span>
              ))}
              {change.added.map((item, j) => (
                <span key={`a${j}`} className="diff-tag added">+{item}</span>
              ))}
            </div>
          )}

          {change.type === 'weights' && (
            <div className="flex flex-wrap gap-xs">
              {change.changes.slice(0, 8).map((c, j) => (
                <span key={j} className="diff-weight">
                  <strong className="text-gold">{c.label}</strong>: {c.oldVal}→{c.newVal}
                </span>
              ))}
              {change.changes.length > 8 && (
                <span className="text-muted text-small">
                  +{change.changes.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
