import type { EntityKind, Filters, Prominence, WorldState } from '../types/world.ts';
import { getAllTags } from '../utils/dataTransform.ts';

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  worldData: WorldState;
}

export default function FilterPanel({ filters, onChange, worldData }: FilterPanelProps) {
  const allTags = getAllTags(worldData);
  const maxTick = worldData.metadata.tick;

  const toggleKind = (kind: EntityKind) => {
    const kinds = filters.kinds.includes(kind)
      ? filters.kinds.filter(k => k !== kind)
      : [...filters.kinds, kind];
    onChange({ ...filters, kinds });
  };

  const toggleTag = (tag: string) => {
    const tags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onChange({ ...filters, tags });
  };

  const entityKinds: EntityKind[] = ['npc', 'faction', 'location', 'rules', 'abilities'];
  const prominenceLevels: Prominence[] = ['forgotten', 'marginal', 'recognized', 'renowned', 'mythic'];

  return (
    <div className="w-72 h-full text-white p-6 overflow-y-auto space-y-6 border-r border-blue-500/20 shadow-xl"
      style={{
        background: 'linear-gradient(180deg, #1e3a5f 0%, #0a1929 100%)'
      }}>
      <div>
        <h2 className="text-2xl font-bold mb-2 tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
          Filters
        </h2>
        <div className="h-1 w-16 rounded-full mt-2"
          style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }}>
        </div>
      </div>

      {/* Search */}
      <div>
        <label className="block text-sm font-semibold mb-3 text-blue-200 uppercase tracking-wide">Search</label>
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          placeholder="Search entities..."
          className="w-full px-4 py-3 rounded-lg text-sm border-2 transition-all"
          style={{
            background: 'rgba(10, 25, 41, 0.6)',
            borderColor: '#3b82f6',
            color: '#ffffff'
          }}
        />
      </div>

      {/* Entity Types */}
      <div>
        <label className="block text-sm font-semibold mb-3 text-blue-200 uppercase tracking-wide">Entity Types</label>
        <div className="space-y-2">
          {entityKinds.map(kind => (
            <label key={kind} className="flex items-center gap-3 cursor-pointer hover:bg-blue-900/20 p-2.5 rounded-lg transition-all">
              <input
                type="checkbox"
                checked={filters.kinds.includes(kind)}
                onChange={() => toggleKind(kind)}
                className="rounded"
              />
              <span className="text-sm capitalize font-medium">{kind}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Minimum Prominence */}
      <div>
        <label className="block text-sm font-semibold mb-3 text-blue-200 uppercase tracking-wide">Minimum Prominence</label>
        <select
          value={filters.minProminence}
          onChange={(e) => onChange({ ...filters, minProminence: e.target.value as Prominence })}
          className="w-full px-4 py-3 rounded-lg text-sm font-medium border-2 cursor-pointer transition-all"
          style={{
            background: 'rgba(10, 25, 41, 0.6)',
            borderColor: '#3b82f6',
            color: '#ffffff'
          }}
        >
          {prominenceLevels.map(level => (
            <option key={level} value={level} className="capitalize bg-gray-900">
              {level}
            </option>
          ))}
        </select>
      </div>

      {/* Time Range */}
      <div>
        <label className="block text-sm font-semibold mb-3 text-blue-200 uppercase tracking-wide">
          Time Range
        </label>
        <div className="bg-blue-950/30 rounded-lg p-4 border border-blue-500/20">
          <div className="flex justify-between text-xs mb-3 font-mono">
            <span className="text-blue-400">Start: <span className="text-white font-semibold">{filters.timeRange[0]}</span></span>
            <span className="text-blue-400">End: <span className="text-white font-semibold">{filters.timeRange[1]}</span></span>
          </div>
          <div className="space-y-3">
            <input
              type="range"
              min={0}
              max={maxTick}
              value={filters.timeRange[0]}
              onChange={(e) => onChange({
                ...filters,
                timeRange: [parseInt(e.target.value), filters.timeRange[1]]
              })}
              className="w-full"
            />
            <input
              type="range"
              min={0}
              max={maxTick}
              value={filters.timeRange[1]}
              onChange={(e) => onChange({
                ...filters,
                timeRange: [filters.timeRange[0], parseInt(e.target.value)]
              })}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-semibold mb-3 text-blue-200 uppercase tracking-wide">
          Tags <span className="text-blue-400 font-normal">({filters.tags.length} selected)</span>
        </label>
        <div className="max-h-56 overflow-y-auto space-y-1 bg-blue-950/20 rounded-lg p-4 border border-blue-500/20">
          {allTags.map(tag => (
            <label key={tag} className="flex items-center gap-3 cursor-pointer hover:bg-blue-900/20 p-2 rounded transition-all text-xs">
              <input
                type="checkbox"
                checked={filters.tags.includes(tag)}
                onChange={() => toggleTag(tag)}
                className="rounded"
              />
              <span className="font-medium">{tag}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => onChange({
          kinds: entityKinds,
          minProminence: 'forgotten',
          timeRange: [0, maxTick],
          tags: [],
          searchQuery: ''
        })}
        className="w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: '#ffffff'
        }}
      >
        Reset Filters
      </button>

      {/* Stats */}
      <div className="pt-4 border-t border-blue-500/20">
        <div className="text-xs font-semibold mb-3 text-blue-200 uppercase tracking-wide">World Stats</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-950/30 rounded-lg p-3 border border-blue-500/20">
            <div className="text-xs text-blue-400 mb-1">Entities</div>
            <div className="text-lg font-bold text-white">{worldData.metadata.entityCount}</div>
          </div>
          <div className="bg-blue-950/30 rounded-lg p-3 border border-blue-500/20">
            <div className="text-xs text-blue-400 mb-1">Relations</div>
            <div className="text-lg font-bold text-white">{worldData.metadata.relationshipCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
