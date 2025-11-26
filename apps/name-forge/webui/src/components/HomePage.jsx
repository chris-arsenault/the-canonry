function HomePage({ onNavigate }) {
  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)' }}>
        <h2 style={{
          fontSize: 'var(--text-2xl)',
          color: 'var(--gold-accent)',
          marginBottom: 'var(--space-sm)'
        }}>
          Welcome to Name Forge
        </h2>
        <p style={{
          fontSize: 'var(--text-lg)',
          color: 'var(--arctic-frost)',
          fontStyle: 'italic'
        }}>
          Because your fantasy names deserve enterprise-grade infrastructure
        </p>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ color: 'var(--arctic-light)', marginBottom: 'var(--space-md)' }}>
          What is this?
        </h3>
        <p style={{ color: 'var(--arctic-frost)', lineHeight: 1.7 }}>
          Name Forge is a dramatically over-engineered name generator for fantasy worlds, games,
          and fiction. Instead of a simple random name picker, we've built a system with
          phonological domains, context-free grammars, Markov chains, genetic algorithm optimization,
          and multi-culture support. You know, the essentials.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ color: 'var(--arctic-light)', marginBottom: 'var(--space-md)' }}>
          Features (Yes, All of Them)
        </h3>

        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            padding: 'var(--space-md)',
            borderRadius: '6px',
            borderLeft: '3px solid var(--arctic-ice)'
          }}>
            <strong style={{ color: 'var(--arctic-light)' }}>Multi-Culture Support</strong>
            <p style={{ color: 'var(--arctic-frost)', margin: 'var(--space-xs) 0 0 0', fontSize: 'var(--text-sm)' }}>
              Define distinct naming conventions for elves, dwarves, space corporations, or
              whatever cultures inhabit your world. Each gets its own phonology, grammars, and style rules.
            </p>
          </div>

          <div style={{
            background: 'rgba(147, 51, 234, 0.1)',
            padding: 'var(--space-md)',
            borderRadius: '6px',
            borderLeft: '3px solid rgb(167, 139, 250)'
          }}>
            <strong style={{ color: 'var(--arctic-light)' }}>Phonological Domains</strong>
            <p style={{ color: 'var(--arctic-frost)', margin: 'var(--space-xs) 0 0 0', fontSize: 'var(--text-sm)' }}>
              Control consonants, vowels, syllable structures, and forbidden clusters.
              Because "Xzqwrth" might be valid in Scrabble, but it's not a name.
            </p>
          </div>

          <div style={{
            background: 'rgba(34, 197, 94, 0.1)',
            padding: 'var(--space-md)',
            borderRadius: '6px',
            borderLeft: '3px solid rgb(74, 222, 128)'
          }}>
            <strong style={{ color: 'var(--arctic-light)' }}>Context-Free Grammars</strong>
            <p style={{ color: 'var(--arctic-frost)', margin: 'var(--space-xs) 0 0 0', fontSize: 'var(--text-sm)' }}>
              Chain production rules together like you're writing a compiler, but for names.
              Reference lexeme lists, other grammars, and phonotactic generators.
              It's grammars all the way down.
            </p>
          </div>

          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            padding: 'var(--space-md)',
            borderRadius: '6px',
            borderLeft: '3px solid var(--gold-accent)'
          }}>
            <strong style={{ color: 'var(--arctic-light)' }}>Strategy Profiles</strong>
            <p style={{ color: 'var(--arctic-frost)', margin: 'var(--space-xs) 0 0 0', fontSize: 'var(--text-sm)' }}>
              Mix phonotactic generation, grammar rules, and Markov chains with weighted probabilities.
              Add conditions for entity types, tags, and prominence levels.
              Finally, a name generator with strategy patterns.
            </p>
          </div>

          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            padding: 'var(--space-md)',
            borderRadius: '6px',
            borderLeft: '3px solid rgb(248, 113, 113)'
          }}>
            <strong style={{ color: 'var(--arctic-light)' }}>Optimization Algorithms</strong>
            <p style={{ color: 'var(--arctic-frost)', margin: 'var(--space-xs) 0 0 0', fontSize: 'var(--text-sm)' }}>
              Hill climbing, simulated annealing, genetic algorithms, and Bayesian optimization (TPE).
              Because manually tuning phoneme weights is for people with free time.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 style={{ color: 'var(--arctic-light)', marginBottom: 'var(--space-md)' }}>
          Getting Started
        </h3>
        <ol style={{
          color: 'var(--arctic-frost)',
          paddingLeft: 'var(--space-lg)',
          lineHeight: 1.8
        }}>
          <li>
            <strong>Schema</strong> - Define your world's entity types (NPCs, locations, factions)
            and create cultures
          </li>
          <li>
            <strong>Workshop</strong> - Configure each culture's domains, lexemes, grammars, and profiles
          </li>
          <li>
            <strong>Optimizer</strong> - Let algorithms tune your domain parameters (optional but fun)
          </li>
          <li>
            <strong>Generate</strong> - Produce names with full control over context and conditions
          </li>
        </ol>
      </div>

      <div style={{
        textAlign: 'center',
        padding: 'var(--space-lg)',
        background: 'rgba(30, 58, 95, 0.3)',
        borderRadius: '6px',
        border: '1px solid var(--card-border)'
      }}>
        <p style={{ color: 'var(--arctic-frost)', marginBottom: 'var(--space-md)' }}>
          Projects are stored locally in your browser. Export regularly if you value your work.
        </p>
        <button
          className="primary"
          onClick={() => onNavigate('schema')}
          style={{ marginRight: 'var(--space-sm)' }}
        >
          Get Started
        </button>
        <button
          className="secondary"
          onClick={() => onNavigate('workshop')}
        >
          Jump to Workshop
        </button>
      </div>

      <p style={{
        textAlign: 'center',
        color: 'var(--arctic-frost)',
        fontSize: 'var(--text-xs)',
        marginTop: 'var(--space-xl)',
        opacity: 0.6
      }}>
        Yes, this is probably overkill for generating fantasy names.
        No, we're not sorry.
      </p>
    </div>
  );
}

export default HomePage;
