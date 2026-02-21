/**
 * FinalEditTab — Corpus-wide editorial tools.
 *
 * Currently hosts CorpusFindReplace. Designed as a container for
 * additional post-production tools as needed.
 */

import CorpusFindReplace from './CorpusFindReplace';

export default function FinalEditTab() {
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '14px' }}>Corpus Find & Replace</h3>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted)' }}>
          Search and replace across chronicle content, chronicle annotations, and entity annotations
        </p>
      </div>
      <CorpusFindReplace />
    </div>
  );
}
