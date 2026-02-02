import React from 'react';
import ReactDOM from 'react-dom/client';
import IlluminatorRemote from './IlluminatorRemote';
import './App.css';
import { exportImagePrompts, downloadImagePromptExport } from './lib/db/imageRepository';

// Standalone entry point for development
// In production, this is loaded via Module Federation from The Canonry

// Expose diagnostic functions on window for console access
window.illuminatorDebug = {
  /** Export all image prompt data (original, refined, revised) as array */
  exportImagePrompts,
  /** Download image prompt data as JSON file */
  downloadImagePromptExport,
};

const mockSchema = Object.freeze({
  entityKinds: [
    {
      kind: 'npc',
      description: 'Character',
      subtypes: [{ id: 'hero', name: 'Hero' }, { id: 'merchant', name: 'Merchant' }],
      statuses: [{ id: 'active', name: 'Active', isTerminal: false }, { id: 'historical', name: 'Historical', isTerminal: true }],
    },
    {
      kind: 'location',
      description: 'Location',
      subtypes: [{ id: 'settlement', name: 'Settlement' }, { id: 'landmark', name: 'Landmark' }],
      statuses: [{ id: 'active', name: 'Active', isTerminal: false }, { id: 'historical', name: 'Historical', isTerminal: true }],
    },
    {
      kind: 'faction',
      description: 'Faction',
      subtypes: [{ id: 'guild', name: 'Guild' }, { id: 'nation', name: 'Nation' }],
      statuses: [{ id: 'active', name: 'Active', isTerminal: false }, { id: 'historical', name: 'Historical', isTerminal: true }],
    },
  ],
  relationshipKinds: [
    { kind: 'leader_of', description: 'Leadership', srcKinds: ['npc'], dstKinds: ['faction'] },
    { kind: 'member_of', description: 'Membership', srcKinds: ['npc'], dstKinds: ['faction'] },
  ],
  cultures: [
    { id: 'northern', name: 'Northern Realm', description: 'Hardy folk from the frozen north', color: '#60a5fa' },
    { id: 'southern', name: 'Southern Empire', description: 'Sophisticated traders of the south', color: '#f59e0b' },
  ],
});

// Mock world data simulating lore-weave output
const mockWorldData = Object.freeze({
  schema: mockSchema,
  metadata: {
    tick: 120,
    epoch: 6,
    era: 'Age of Frost',
    entityCount: 4,
    relationshipCount: 0,
  },
  hardState: [
    { id: 'hero_001', kind: 'npc', subtype: 'hero', name: 'Grizzletooth the Bold', description: '', status: 'active', prominence: 5.0, culture: 'northern', tags: {}, coordinates: { x: 50, y: 50, z: 10 }, createdAt: 1, updatedAt: 10 },
    { id: 'hero_002', kind: 'npc', subtype: 'hero', name: 'Silverfin the Swift', description: '', status: 'active', prominence: 3.5, culture: 'southern', tags: {}, coordinates: { x: 60, y: 40, z: 5 }, createdAt: 2, updatedAt: 8 },
    { id: 'loc_001', kind: 'location', subtype: 'landmark', name: 'The Frozen Throne', description: '', status: 'active', prominence: 5.0, culture: 'northern', tags: {}, coordinates: { x: 45, y: 55, z: 15 }, createdAt: 1, updatedAt: 5 },
    { id: 'faction_001', kind: 'faction', subtype: 'nation', name: 'The Ice Confederacy', description: '', status: 'active', prominence: 3.5, culture: 'northern', tags: {}, coordinates: { x: 40, y: 50, z: 8 }, createdAt: 3, updatedAt: 12 },
  ],
  relationships: [],
  pressures: {},
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div style={{ height: '100vh', backgroundColor: '#1e1e2e' }}>
      <IlluminatorRemote
        projectId="mock-project"
        schema={mockSchema}
        worldData={mockWorldData}
        activeSection="configure"
        onSectionChange={(section) => console.log('Section changed:', section)}
      />
    </div>
  </React.StrictMode>
);
