/**
 * HelpModal - Context-aware help modal showing detailed workflow for current screen
 */

import React, { useRef } from 'react';

// Accent colors for each screen (kept for dynamic theming)
const SCREEN_COLORS = {
  enumerist: '#f59e0b',
  names: '#3b82f6',
  cosmography: '#22c55e',
  simulation: '#a855f7',
};

// Detailed workflow content for each screen
const HELP_CONTENT = {
  enumerist: {
    title: 'Enumerist',
    color: SCREEN_COLORS.enumerist,
    description: `Enumerist is where you define the building blocks of your world. Before you can name things or place them on semantic planes, you need to decide what kinds of things exist, how they can relate to each other, and which cultures shape them. Think of it as the data model for your universe.`,
    workflow: [
      {
        title: 'Entity Kinds',
        desc: 'Start by defining what exists in your world:',
        items: [
          'Add entity kinds (npc, location, faction, item, etc.)',
          'Define subtypes for each kind (merchant, temple, guild)',
          'Set possible statuses (active, historical, legendary)',
          'Each kind can have multiple subtypes and statuses',
        ],
      },
      {
        title: 'Relationship Kinds',
        desc: 'Define how things connect to each other:',
        items: [
          'Create relationship kinds (mentor_of, located_in, member_of)',
          'Set valid source entity kinds for each relationship',
          'Set valid target entity kinds for each relationship',
          'Relationships become available in Cosmographer for connecting entities',
        ],
      },
      {
        title: 'Cultures',
        desc: 'Define the peoples and societies of your world:',
        items: [
          'Add cultures with names and descriptions',
          'Assign signature colors for visualization',
          'Cultures flow to Name Forge for naming conventions',
          'Cultures flow to Cosmographer for territorial biases',
        ],
      },
    ],
  },
  names: {
    title: 'Name Forge',
    color: SCREEN_COLORS.names,
    description: `Name Forge is a dramatically over-engineered name generator for fantasy worlds, games, and fiction. Instead of a simple random name picker, we've built a system with phonological domains, context-free grammars, Markov chains, genetic algorithm optimization, and multi-culture support. You know, the essentials.`,
    workflow: [
      {
        title: 'Workshop Tab',
        desc: 'Select a culture and configure its naming system:',
        items: [
          'Domain: Define consonants, vowels, syllable patterns, and forbidden clusters',
          'Lexemes: Create word lists that grammars can reference',
          'Grammars: Build name structure rules with production chains',
          'Profiles: Combine strategies (phonotactic, grammar, markov) with weights',
          'Add conditions for entity types, tags, and prominence levels',
        ],
      },
      {
        title: 'Optimizer Tab',
        desc: 'Auto-tune domain parameters for better results:',
        items: [
          'Hill Climbing: Simple local search, fast but can get stuck',
          'Simulated Annealing: Probabilistic jumps to escape local optima',
          'Genetic Algorithm: Evolve populations of parameter sets',
          'Bayesian (TPE): Smart exploration using probability models',
          'Watch fitness improve in real-time',
        ],
      },
      {
        title: 'Generate Tab',
        desc: 'Produce names with full control over context:',
        items: [
          'Select culture, entity kind, and subtype',
          'Filter by tags and prominence level',
          'Generate 1-100 names at once',
          'View which strategies were used for each name',
          'Copy results to clipboard',
        ],
      },
    ],
  },
  cosmography: {
    title: 'Cosmographer',
    color: SCREEN_COLORS.cosmography,
    description: `Cosmographer lets you place entities on semantic planes - 2D spaces where position has meaning. Instead of arbitrary coordinates, entities exist on axes like Lawful-Chaotic, Urban-Wild, or Sacred-Profane. Cultures claim territories on these planes, and the relationships between entities form the connective tissue of your world.`,
    workflow: [
      {
        title: 'Semantic Planes',
        desc: 'Configure the meaning space for each entity kind:',
        items: [
          'Each entity kind gets its own 2D plane',
          'Define axis labels (e.g., "Lawful" to "Chaotic")',
          'Draw regions that map positions to subtypes',
          'Regions can overlap for nuanced placement',
          'Position on the plane implies semantic meaning',
        ],
      },
      {
        title: 'Culture Biases',
        desc: 'Define where cultures tend to exist on each plane:',
        items: [
          'Set axis biases (e.g., Dwarves: +0.3 toward Lawful)',
          'Draw home regions for cultural territories',
          'Different biases per entity kind per culture',
          'Biases influence where generated entities appear',
        ],
      },
      {
        title: 'Entities',
        desc: 'Create the seed entities of your world:',
        items: [
          'Click on the semantic plane to place entities',
          'Assign culture, subtype, status, and tags',
          'Auto-generate names using the culture\'s naming config',
          'Edit entity details in the side panel',
          'Position determines semantic meaning',
        ],
      },
      {
        title: 'Relationships',
        desc: 'Connect entities into a world graph:',
        items: [
          'Create relationships between seed entities',
          'Use relationship kinds defined in Enumerist',
          'Build mentor chains, faction memberships, location hierarchies',
          'This forms the initial network for future simulation',
        ],
      },
    ],
  },
  simulation: {
    title: 'Lore Weave',
    color: SCREEN_COLORS.simulation,
    description: `Coming soon: Lore Weave will run simulations to generate world history, evolve relationships, and create emergent narratives from your seed entities.`,
    workflow: [
      {
        title: 'Era Configuration',
        desc: 'Define historical periods with different characteristics:',
        items: [
          'Create eras with names and descriptions',
          'Set different pressures and template weights per era',
          'Watch your world evolve through distinct periods',
        ],
      },
      {
        title: 'Templates & Systems',
        desc: 'Define how the world grows and changes:',
        items: [
          'Templates create batches of pre-connected entities',
          'Systems modify existing entities and form new relationships',
          'Configure which templates and systems run in each era',
        ],
      },
      {
        title: 'History Generation',
        desc: 'Run the simulation and explore the results:',
        items: [
          'Seed entities grow into a full world',
          'Relationships form and evolve over time',
          'Emergent stories arise from the simulation',
          'Export the generated history for your projects',
        ],
      },
    ],
  },
};

export default function HelpModal({ isOpen, onClose, activeTab }) {
  const mouseDownOnOverlay = useRef(false);

  const handleOverlayMouseDown = (e) => {
    mouseDownOnOverlay.current = e.target === e.currentTarget;
  };

  const handleOverlayClick = (e) => {
    if (mouseDownOnOverlay.current && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const content = HELP_CONTENT[activeTab] || HELP_CONTENT.enumerist;

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal help-modal">
        <div className="modal-header">
          <div className="modal-title" style={{ color: content.color }}>
            {content.title}
          </div>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body modal-body-single">
          {/* Description */}
          <div className="help-section">
            <h3 className="help-section-title">What is this?</h3>
            <p className="help-text">{content.description}</p>
          </div>

          {/* Workflow */}
          <div className="help-section">
            <h3 className="help-section-title">Workflow</h3>
            {content.workflow.map((step, index) => (
              <div
                key={index}
                className="workflow-step"
              >
                <div className="workflow-step-header">
                  <div
                    className="workflow-step-number"
                    style={{ backgroundColor: content.color }}
                  >
                    {index + 1}
                  </div>
                  <div className="workflow-step-title">{step.title}</div>
                </div>
                <p className="workflow-step-desc">{step.desc}</p>
                <ul className="workflow-step-list">
                  {step.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
