import type { WorldState } from '../types/world.ts';
import { getEntityById, getRelatedEntities, getRelationships } from '../utils/dataTransform.ts';

interface EntityDetailProps {
  entityId?: string;
  worldData: WorldState;
  onRelatedClick: (entityId: string) => void;
}

export default function EntityDetail({ entityId, worldData, onRelatedClick }: EntityDetailProps) {
  if (!entityId) {
    return (
      <div className="w-96 h-full text-white p-8 overflow-y-auto flex items-center justify-center border-l border-blue-500/20 shadow-xl"
        style={{
          background: 'linear-gradient(180deg, #1e3a5f 0%, #0a1929 100%)'
        }}>
        <div className="text-center">
          <div className="text-5xl mb-4" style={{ filter: 'drop-shadow(0 0 20px rgba(59, 130, 246, 0.4))' }}>👈</div>
          <div className="text-blue-300 font-medium">Select a node to view details</div>
        </div>
      </div>
    );
  }

  const entity = getEntityById(worldData, entityId);

  if (!entity) {
    return (
      <div className="w-96 h-full text-white p-8 overflow-y-auto border-l border-blue-500/20 shadow-xl"
        style={{
          background: 'linear-gradient(180deg, #1e3a5f 0%, #0a1929 100%)'
        }}>
        <div className="text-red-400 font-medium">Entity not found</div>
      </div>
    );
  }

  const relatedEntities = getRelatedEntities(worldData, entityId);
  const relationships = getRelationships(worldData, entityId);

  const outgoingRels = relationships.filter(r => r.src === entityId);
  const incomingRels = relationships.filter(r => r.dst === entityId);

  const getRelatedEntity = (relId: string) => getEntityById(worldData, relId);

  return (
    <div className="w-96 min-w-96 max-w-96 h-full text-white p-6 overflow-y-auto border-l border-blue-500/20 shadow-xl overflow-x-hidden"
      style={{
        background: 'linear-gradient(180deg, #1e3a5f 0%, #0a1929 100%)',
        wordWrap: 'break-word',
        overflowWrap: 'break-word'
      }}>
      {/* Header */}
      <div className="mb-6 pb-6 border-b border-blue-500/20">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-2xl font-bold leading-tight flex-1 break-words"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #93c5fd 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
            {entity.name}
          </h2>
          <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide shadow-lg flex-shrink-0 ${
            entity.prominence === 'mythic' ? 'bg-purple-600 text-purple-100' :
            entity.prominence === 'renowned' ? 'bg-blue-600 text-blue-100' :
            entity.prominence === 'recognized' ? 'bg-green-600 text-green-100' :
            entity.prominence === 'marginal' ? 'bg-yellow-600 text-yellow-100' :
            'bg-gray-600 text-gray-100'
          }`}>
            {entity.prominence}
          </span>
        </div>
        <div className="flex gap-3 text-sm flex-wrap">
          <span className="capitalize font-medium text-blue-300">{entity.kind}</span>
          <span className="text-blue-500">•</span>
          <span className="capitalize text-blue-200">{entity.subtype}</span>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6 bg-blue-950/30 rounded-lg p-5 border border-blue-500/20">
        <div className="text-xs font-semibold mb-3 text-blue-200 uppercase tracking-wide">Description</div>
        <p className="text-sm text-blue-100 leading-relaxed break-words whitespace-normal">{entity.description}</p>
      </div>

      {/* Status */}
      <div className="mb-6">
        <div className="text-xs font-semibold mb-3 text-blue-200 uppercase tracking-wide">Status</div>
        <div className="bg-blue-950/30 rounded-lg p-4 border border-blue-500/20">
          <div className="text-sm font-medium capitalize text-white break-words">{entity.status}</div>
        </div>
      </div>

      {/* Tags */}
      {entity.tags.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold mb-3 text-blue-200 uppercase tracking-wide">Tags</div>
          <div className="flex flex-wrap gap-2">
            {entity.tags.map(tag => (
              <span key={tag} className="px-3 py-1.5 rounded-full text-xs font-medium bg-blue-600/40 text-blue-100">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="mb-6 bg-blue-950/30 rounded-lg p-5 border border-blue-500/20">
        <div className="text-xs font-semibold mb-4 text-blue-200 uppercase tracking-wide">Timeline</div>
        <div className="space-y-2.5 text-xs font-mono">
          <div className="flex justify-between gap-4">
            <span className="text-blue-400">Created:</span>
            <span className="text-white font-semibold">Tick {entity.createdAt}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-blue-400">Updated:</span>
            <span className="text-white font-semibold">Tick {entity.updatedAt}</span>
          </div>
        </div>
      </div>

      {/* Outgoing Relationships */}
      {outgoingRels.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold mb-3 text-blue-200 uppercase tracking-wide">
            Relationships ({outgoingRels.length})
          </div>
          <div className="space-y-2.5">
            {outgoingRels.map((rel, i) => {
              const target = getRelatedEntity(rel.dst);
              return (
                <div key={i} className="bg-blue-950/30 border border-blue-500/20 rounded-lg p-4 hover:bg-blue-900/30 transition-all">
                  <div className="text-blue-400 text-xs mb-2.5 uppercase tracking-wide font-semibold">{rel.kind.replace(/_/g, ' ')}</div>
                  {target && (
                    <button
                      onClick={() => onRelatedClick(target.id)}
                      className="hover:text-blue-300 transition-colors text-left w-full font-medium text-sm break-words"
                    >
                      {target.name}
                      <span className="text-blue-500 text-xs ml-2">({target.kind})</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incoming Relationships */}
      {incomingRels.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold mb-3 text-blue-200 uppercase tracking-wide">
            Referenced By ({incomingRels.length})
          </div>
          <div className="space-y-2.5">
            {incomingRels.map((rel, i) => {
              const source = getRelatedEntity(rel.src);
              return (
                <div key={i} className="bg-green-950/30 border border-green-500/20 rounded-lg p-4 hover:bg-green-900/30 transition-all">
                  <div className="text-green-400 text-xs mb-2.5 uppercase tracking-wide font-semibold">{rel.kind.replace(/_/g, ' ')}</div>
                  {source && (
                    <button
                      onClick={() => onRelatedClick(source.id)}
                      className="hover:text-green-300 transition-colors text-left w-full font-medium text-sm break-words"
                    >
                      {source.name}
                      <span className="text-green-500 text-xs ml-2">({source.kind})</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connection Summary */}
      <div className="pt-6 border-t border-blue-500/20">
        <div className="text-xs font-semibold mb-4 text-blue-200 uppercase tracking-wide">Connection Summary</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-950/30 rounded-lg p-4 border border-blue-500/20">
            <div className="text-xs text-blue-400 mb-2">Connections</div>
            <div className="text-lg font-bold text-white">{relationships.length}</div>
          </div>
          <div className="bg-blue-950/30 rounded-lg p-4 border border-blue-500/20">
            <div className="text-xs text-blue-400 mb-2">Entities</div>
            <div className="text-lg font-bold text-white">{relatedEntities.length}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
