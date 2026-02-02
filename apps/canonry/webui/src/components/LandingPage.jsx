/**
 * LandingPage - Welcome screen with horizontal cards showing app overviews
 *
 * Shows The Canonry overview with detailed feature descriptions for each component.
 * Workflow details are in the HelpModal, not here.
 */

import React from 'react';
import { colors, typography, spacing, radius } from '../theme';

const styles = {
  container: {
    height: '100%',
    overflowY: 'auto',
    backgroundColor: colors.bgPrimary,
  },
  hero: {
    textAlign: 'center',
    padding: `${spacing.xxxl} ${spacing.xl}`,
    background: `linear-gradient(180deg, ${colors.bgSidebar} 0%, ${colors.bgPrimary} 100%)`,
  },
  title: {
    fontSize: '32px',
    fontWeight: typography.weightBold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: typography.sizeXl,
    color: colors.textSecondary,
    maxWidth: '700px',
    margin: '0 auto',
    lineHeight: 1.6,
  },
  tagline: {
    fontSize: typography.sizeSm,
    color: colors.textMuted,
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
  // Horizontal cards grid
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: spacing.xl,
    padding: `${spacing.xl} ${spacing.xl} ${spacing.xxxl}`,
    maxWidth: '1200px',
    margin: '0 auto',
  },
  // Card styles
  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.xl,
    border: `1px solid ${colors.border}`,
    overflow: 'hidden',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    padding: spacing.xl,
    borderBottom: `1px solid ${colors.border}`,
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cardIcon: {
    fontSize: '24px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    flexShrink: 0,
  },
  cardTitleGroup: {
    flex: 1,
  },
  cardTitle: {
    fontSize: typography.sizeXl,
    fontWeight: typography.weightSemibold,
    margin: 0,
  },
  cardTagline: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    fontStyle: 'italic',
    margin: 0,
  },
  cardBody: {
    padding: spacing.xl,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  cardDesc: {
    fontSize: typography.sizeMd,
    color: colors.textSecondary,
    lineHeight: 1.7,
    marginBottom: spacing.lg,
  },
  // Features list
  featuresGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    flex: 1,
  },
  feature: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeft: '3px solid',
  },
  featureTitle: {
    fontSize: typography.sizeSm,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: '2px',
  },
  featureDesc: {
    fontSize: typography.sizeXs,
    color: colors.textSecondary,
    lineHeight: 1.5,
    margin: 0,
  },
  // Footer
  footer: {
    textAlign: 'center',
    padding: `${spacing.xxl} ${spacing.xl}`,
    backgroundColor: colors.bgSidebar,
    borderTop: `1px solid ${colors.border}`,
  },
  footerTitle: {
    fontSize: typography.sizeXl,
    fontWeight: typography.weightSemibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  footerText: {
    fontSize: typography.sizeMd,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  footerHint: {
    fontSize: typography.sizeSm,
    color: colors.textMuted,
  },
};

// App card data with full detailed features (not shortened!)
const APP_CARDS = [
  {
    id: 'enumerist',
    icon: '{}',
    title: 'Enumerist',
    tagline: 'Schema Definition',
    color: colors.accentEnumerist,
    bgColor: 'rgba(108, 155, 255, 0.1)',
    description: `Enumerist is where you define the building blocks of your world. Before you can name things or place them on semantic planes, you need to decide what kinds of things exist, how they can relate to each other, and which cultures shape them. Think of it as the data model for your universe.`,
    features: [
      {
        title: 'Entity Kinds',
        desc: 'Define categories of things in your world: NPCs, Locations, Factions, Items, Events. Each kind can have subtypes (e.g., NPC subtypes: merchant, warrior, scholar) and statuses (active, deceased, legendary).',
        color: colors.highlightBlue,
        bg: 'rgba(108, 155, 255, 0.1)',
      },
      {
        title: 'Relationship Kinds',
        desc: 'Define how entities connect: mentor_of, located_in, member_of, rival_to, created_by. Specify which entity kinds can participate as source and target for each relationship type.',
        color: colors.highlightPurple,
        bg: 'rgba(167, 139, 250, 0.1)',
      },
      {
        title: 'Culture Definitions',
        desc: 'Create distinct cultures with names, descriptions, and signature colors. These cultures flow through to Name Forge (naming conventions) and Cosmographer (territorial biases).',
        color: colors.highlightGreen,
        bg: 'rgba(74, 222, 128, 0.1)',
      },
    ],
  },
  {
    id: 'names',
    icon: 'Aa',
    title: 'Name Forge',
    tagline: 'Because your fantasy names deserve enterprise-grade infrastructure',
    color: colors.accentNameForge,
    bgColor: 'rgba(255, 179, 102, 0.1)',
    description: `Name Forge is a dramatically over-engineered name generator for fantasy worlds, games, and fiction. Instead of a simple random name picker, we've built a system with phonological domains, context-free grammars, Markov chains, genetic algorithm optimization, and multi-culture support. You know, the essentials.`,
    features: [
      {
        title: 'Multi-Culture Support',
        desc: 'Define distinct naming conventions for elves, dwarves, space corporations, or whatever cultures inhabit your world. Each gets its own phonology, grammars, and style rules.',
        color: colors.highlightBlue,
        bg: 'rgba(108, 155, 255, 0.1)',
      },
      {
        title: 'Phonological Domains',
        desc: `Control consonants, vowels, syllable structures, and forbidden clusters. Because "Xzqwrth" might be valid in Scrabble, but it's not a name.`,
        color: colors.highlightPurple,
        bg: 'rgba(167, 139, 250, 0.1)',
      },
      {
        title: 'Context-Free Grammars',
        desc: `Chain production rules together like you're writing a compiler, but for names. Reference lexeme lists, other grammars, and phonotactic generators. It's grammars all the way down.`,
        color: colors.highlightGreen,
        bg: 'rgba(74, 222, 128, 0.1)',
      },
      {
        title: 'Strategy Profiles',
        desc: 'Mix phonotactic generation, grammar rules, and Markov chains with weighted probabilities. Add conditions for entity types, tags, and prominence levels. Finally, a name generator with strategy patterns.',
        color: colors.highlightOrange,
        bg: 'rgba(255, 179, 102, 0.1)',
      },
      {
        title: 'Optimization Algorithms',
        desc: 'Hill climbing, simulated annealing, genetic algorithms, and Bayesian optimization (TPE). Because manually tuning phoneme weights is for people with free time.',
        color: colors.highlightRed,
        bg: 'rgba(248, 113, 113, 0.1)',
      },
    ],
  },
  {
    id: 'cosmography',
    icon: '<>',
    title: 'Cosmographer',
    tagline: 'Semantic Placement & World Topology',
    color: colors.accentCosmographer,
    bgColor: 'rgba(102, 221, 179, 0.1)',
    description: `Cosmographer lets you place entities on semantic planes - 2D spaces where position has meaning. Instead of arbitrary coordinates, entities exist on axes like Lawful-Chaotic, Urban-Wild, or Sacred-Profane. Cultures claim territories on these planes, and the relationships between entities form the connective tissue of your world.`,
    features: [
      {
        title: 'Semantic Planes',
        desc: `Each entity kind gets its own 2D plane with meaningful axes. NPCs might live on Good-Evil vs Lawful-Chaotic. Locations might use Sacred-Profane vs Urban-Wild. The axes are yours to define.`,
        color: colors.highlightTeal,
        bg: 'rgba(102, 221, 179, 0.1)',
      },
      {
        title: 'Regions & Subtypes',
        desc: `Draw regions on the plane that map to subtypes or statuses. A "merchant" region in the Lawful-Neutral area. A "legendary" region at the extremes. Position implies identity.`,
        color: colors.highlightPurple,
        bg: 'rgba(167, 139, 250, 0.1)',
      },
      {
        title: 'Cultural Territories',
        desc: 'Define where each culture tends to exist on each plane. Dwarven NPCs cluster in the Lawful quadrant. Elven locations favor the Wild end. Cultures have home regions and axis biases.',
        color: colors.highlightBlue,
        bg: 'rgba(108, 155, 255, 0.1)',
      },
      {
        title: 'Seed Entities',
        desc: `Create the founding entities of your world with specific positions on their semantic planes. Names can be auto-generated using the culture's naming configuration from Name Forge.`,
        color: colors.highlightOrange,
        bg: 'rgba(255, 179, 102, 0.1)',
      },
      {
        title: 'Relationship Web',
        desc: 'Connect seed entities with the relationship kinds from your schema. Build mentor chains, faction memberships, location hierarchies. The initial web that simulation will evolve.',
        color: colors.highlightGreen,
        bg: 'rgba(74, 222, 128, 0.1)',
      },
    ],
  },
  {
    id: 'coherence',
    icon: '⚖️',
    title: 'Coherence Engine',
    tagline: 'Templates, pressures, and other levers for narrative gravity',
    color: colors.accentCoherence,
    bgColor: 'rgba(245, 158, 11, 0.1)',
    description: `Coherence Engine is where your world stops being a pile of JSON and starts behaving like a simulated ecosystem. It’s the control room for eras, pressures, growth templates, and systems. Think of it as the tuning console that keeps your procedural history from devolving into a krill fight in two ticks.`,
    features: [
      {
        title: 'Eras & Phase Control',
        desc: 'Define historical phases with template and system weights. Swing between “great thaw” and “faction wars” without rewriting everything.',
        color: colors.highlightOrange,
        bg: 'rgba(245, 158, 11, 0.1)',
      },
      {
        title: 'Pressures & Feedback',
        desc: 'Model conflict, scarcity, zeal, or whatever forces drive your world. Tune sources, sinks, and decay so your signals don’t saturate at 100 forever.',
        color: colors.highlightRed,
        bg: 'rgba(248, 113, 113, 0.1)',
      },
      {
        title: 'Templates & Systems',
        desc: 'Configure declarative growth templates and simulation systems—no TypeScript required. Wire in lineage, relationships, and tag dynamics from the UI.',
        color: colors.highlightPurple,
        bg: 'rgba(167, 139, 250, 0.1)',
      },
    ],
  },
  {
    id: 'simulation',
    icon: '▶',
    title: 'Lore Weave',
    tagline: 'Run the procedural history and watch penguins make questionable choices',
    color: colors.accentSimulation,
    bgColor: 'rgba(59, 130, 246, 0.1)',
    description: `Lore Weave executes your configuration: growth templates, pressures, systems, and seed entities collide to produce a living history. It’s the “Run” button with a dashboard, not a prayer.`,
    features: [
      {
        title: 'One-Click Simulation',
        desc: 'Run all epochs or step through them. See logs, progress, and distribution stats without dropping to a terminal.',
        color: colors.highlightBlue,
        bg: 'rgba(59, 130, 246, 0.1)',
      },
      {
        title: 'Coordinate & Pressure Aware',
        desc: 'Respects semantic planes, pressures, and template applicability. No more templates running in vacuum.',
        color: colors.highlightTeal,
        bg: 'rgba(102, 221, 179, 0.1)',
      },
      {
        title: 'Export & Handoff',
        desc: 'Push results directly to Archivist or sync JSON for downstream tools. World state, history, validation—all in one export.',
        color: colors.highlightGreen,
        bg: 'rgba(74, 222, 128, 0.1)',
      },
    ],
  },
  {
    id: 'archivist',
    icon: '🗄️',
    title: 'Archivist',
    tagline: 'Curation and smug visualization of everything you just simulated',
    color: colors.accentArchivist,
    bgColor: 'rgba(255, 255, 255, 0.05)',
    description: `Archivist is where your generated world gets a victory lap. Explore graphs in 2D or 3D, map entities on semantic planes, and skim timelines and stats like you’re doing a postmortem on penguin politics.`,
    features: [
      {
        title: 'Explorer Views',
        desc: 'Flip between 2D graph, 3D force layout, and coordinate maps. Hover, select, and trace relationships without getting snow blindness.',
        color: colors.highlightPurple,
        bg: 'rgba(167, 139, 250, 0.1)',
      },
      {
        title: 'Entity & Lore Panels',
        desc: 'Drill into entity details, lore snippets, and related media. See why that faction declared war on a fishing village.',
        color: colors.highlightBlue,
        bg: 'rgba(108, 155, 255, 0.1)',
      },
      {
        title: 'Timelines & Stats',
        desc: 'Scrub through ticks, filter by tags or prominence, and check validation/health stats. Because “it runs” isn’t the same as “it’s coherent.”',
        color: colors.highlightGreen,
        bg: 'rgba(74, 222, 128, 0.1)',
      },
    ],
  },
];

function AppCard({ app, onNavigate, hasProject }) {
  return (
    <div
      style={{
        ...styles.card,
        opacity: hasProject ? 1 : 0.7,
        cursor: hasProject ? 'pointer' : 'default',
      }}
      onClick={() => hasProject && onNavigate(app.id)}
      onMouseEnter={(e) => {
        if (hasProject) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = `0 8px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px ${app.color}40`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      title={hasProject ? `Open ${app.title}` : 'Select a project first'}
    >
      {/* Header */}
      <div
        style={{
          ...styles.cardHeader,
          background: `linear-gradient(135deg, ${app.color}15 0%, transparent 100%)`,
        }}
      >
        <div style={styles.cardHeaderRow}>
          <div
            style={{
              ...styles.cardIcon,
              backgroundColor: app.bgColor,
              color: app.color,
            }}
          >
            {app.icon}
          </div>
          <div style={styles.cardTitleGroup}>
            <h2 style={{ ...styles.cardTitle, color: app.color }}>{app.title}</h2>
            <p style={styles.cardTagline}>{app.tagline}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={styles.cardBody}>
        <p style={styles.cardDesc}>{app.description}</p>

        <div style={styles.featuresGrid}>
          {app.features.map((feature, idx) => (
            <div
              key={idx}
              style={{
                ...styles.feature,
                backgroundColor: feature.bg,
                borderLeftColor: feature.color,
              }}
            >
              <div style={styles.featureTitle}>{feature.title}</div>
              <p style={styles.featureDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onNavigate, hasProject }) {
  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.hero}>
        <h1 style={styles.title}>Welcome to The Canonry</h1>
        <p style={styles.subtitle}>
          A unified suite for procedural world-building. Define your schema, configure naming
          systems, place entities on semantic planes, and generate interconnected histories.
        </p>
        <p style={styles.tagline}>Yes, this is probably overkill. No, we're not sorry.</p>
      </div>

      {/* App Cards */}
      <div style={styles.cardsGrid}>
        {APP_CARDS.map((app) => (
          <AppCard key={app.id} app={app} onNavigate={onNavigate} hasProject={hasProject} />
        ))}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <h2 style={styles.footerTitle}>Get Started</h2>
        <p style={styles.footerText}>
          {hasProject
            ? 'Click on any card above to start working with your project.'
            : 'Create a new project or open an existing one using the project selector above.'}
        </p>
        <p style={styles.footerHint}>
          Projects are stored locally in your browser. Use Export to create backups.
        </p>
      </div>
    </div>
  );
}
