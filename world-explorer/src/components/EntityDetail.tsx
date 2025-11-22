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
      <div className="w-96 h-full bg-gray-900 text-white p-6 overflow-y-auto flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">👈</div>
          <div>Select a node to view details</div>
        </div>
      </div>
    );
  }

  const entity = getEntityById(worldData, entityId);

  if (!entity) {
    return (
      <div className="w-96 h-full bg-gray-900 text-white p-6 overflow-y-auto">
        <div className="text-red-400">Entity not found</div>
      </div>
    );
  }

  const relatedEntities = getRelatedEntities(worldData, entityId);
  const relationships = getRelationships(worldData, entityId);

  const outgoingRels = relationships.filter(r => r.src === entityId);
  const incomingRels = relationships.filter(r => r.dst === entityId);

  const getRelatedEntity = (relId: string) => getEntityById(worldData, relId);

  return (
    <div className="w-96 h-full bg-gray-900 text-white p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-2xl font-bold">{entity.name}</h2>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            entity.prominence === 'mythic' ? 'bg-purple-600' :
            entity.prominence === 'renowned' ? 'bg-blue-600' :
            entity.prominence === 'recognized' ? 'bg-green-600' :
            entity.prominence === 'marginal' ? 'bg-yellow-600' :
            'bg-gray-600'
          }`}>
            {entity.prominence}
          </span>
        </div>
        <div className="flex gap-2 text-sm text-gray-400">
          <span className="capitalize">{entity.kind}</span>
          <span>•</span>
          <span className="capitalize">{entity.subtype}</span>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <p className="text-sm text-gray-300 leading-relaxed">{entity.description}</p>
      </div>

      {/* Status */}
      <div className="mb-6">
        <div className="text-sm font-medium text-gray-400 mb-1">Status</div>
        <div className="text-sm capitalize">{entity.status}</div>
      </div>

      {/* Tags */}
      {entity.tags.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-400 mb-2">Tags</div>
          <div className="flex flex-wrap gap-2">
            {entity.tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-gray-800 rounded text-xs">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="mb-6 text-xs text-gray-400">
        <div>Created at tick: {entity.createdAt}</div>
        <div>Last updated: {entity.updatedAt}</div>
      </div>

      {/* Outgoing Relationships */}
      {outgoingRels.length > 0 && (
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-400 mb-2">
            Relationships ({outgoingRels.length})
          </div>
          <div className="space-y-2">
            {outgoingRels.map((rel, i) => {
              const target = getRelatedEntity(rel.dst);
              return (
                <div key={i} className="text-sm bg-gray-800 p-2 rounded">
                  <div className="text-blue-400 text-xs mb-1">{rel.kind.replace(/_/g, ' ')}</div>
                  {target && (
                    <button
                      onClick={() => onRelatedClick(target.id)}
                      className="hover:text-blue-400 transition-colors text-left"
                    >
                      {target.name}
                      <span className="text-gray-500 text-xs ml-2">({target.kind})</span>
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
          <div className="text-sm font-medium text-gray-400 mb-2">
            Referenced By ({incomingRels.length})
          </div>
          <div className="space-y-2">
            {incomingRels.map((rel, i) => {
              const source = getRelatedEntity(rel.src);
              return (
                <div key={i} className="text-sm bg-gray-800 p-2 rounded">
                  <div className="text-green-400 text-xs mb-1">{rel.kind.replace(/_/g, ' ')}</div>
                  {source && (
                    <button
                      onClick={() => onRelatedClick(source.id)}
                      className="hover:text-green-400 transition-colors text-left"
                    >
                      {source.name}
                      <span className="text-gray-500 text-xs ml-2">({source.kind})</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Connection Summary */}
      <div className="pt-4 border-t border-gray-700 text-xs text-gray-400">
        <div>Total connections: {relationships.length}</div>
        <div>Connected entities: {relatedEntities.length}</div>
      </div>
    </div>
  );
}
