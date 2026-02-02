/**
 * TestTab - Test name generation for a profile
 */

import { useState } from 'react';
import { NumberInput } from '@penguin-tales/shared-components';
import { generateTestNames } from '../../../../../lib/browser-generator.js';

export default function TestTab({ profile, cultureConfig }) {
  const [testNames, setTestNames] = useState([]);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState(null);
  const [strategyUsage, setStrategyUsage] = useState(null);
  const [count, setCount] = useState(10);

  const handleTestNames = async () => {
    if (!profile || !cultureConfig) return;

    setTestLoading(true);
    setTestError(null);
    setTestNames([]);
    setStrategyUsage(null);

    try {
      const result = await generateTestNames({
        culture: cultureConfig,
        profileId: profile.id,
        count,
        seed: `test-${Date.now()}`,
      });

      setTestNames(result.names || []);
      setStrategyUsage(result.strategyUsage || null);
    } catch (err) {
      setTestError(err.message);
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="profile-test-tab">
      <div className="test-controls">
        <div className="test-count-control">
          <label>Count:</label>
          <NumberInput
            min={1}
            max={100}
            value={count}
            onChange={(v) => setCount(v ?? 10)}
            integer
          />
        </div>
        <button
          className="primary"
          onClick={handleTestNames}
          disabled={testLoading}
        >
          {testLoading ? 'Generating...' : 'Generate Names'}
        </button>
      </div>

      {testError && (
        <div className="error-box">{testError}</div>
      )}

      {strategyUsage && Object.keys(strategyUsage).length > 0 && (
        <div className="strategy-usage-summary">
          <span className="usage-label">Strategy usage:</span>
          {Object.entries(strategyUsage)
            .filter(([, cnt]) => cnt > 0)
            .map(([strategy, cnt]) => (
              <span key={strategy} className="usage-item">
                <span className="usage-strategy">{strategy}</span>
                <span className="usage-count">{cnt}</span>
              </span>
            ))}
        </div>
      )}

      {testNames.length > 0 ? (
        <div className="test-results">
          <div className="results-header">
            <span className="results-count">{testNames.length} names generated</span>
          </div>
          <div className="test-names-grid">
            {testNames.map((name, i) => (
              <div key={i} className="test-name-card">
                {name}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-test-state">
          <p>Click "Generate Names" to test this profile</p>
        </div>
      )}
    </div>
  );
}
