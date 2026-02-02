/**
 * Coordinate Statistics Collector
 *
 * Tracks coordinate system usage during world generation to diagnose:
 * - Which placement paths are being used
 * - Whether culture context is being passed
 * - Region usage per entity kind
 * - Placement behavior
 */

export interface PlacementEvent {
  tick: number;
  entityKind: string;
  method: 'deriveCoordinatesWithCulture' | 'placeWithCulture' | 'placeNearEntity' | 'placeInRegion' | 'spawnEmergent';
  cultureId?: string;
  regionId?: string | null;
  hadReferenceEntities: boolean;
  coordinates: { x: number; y: number; z: number };
}

export interface CultureClusterStats {
  cultureId: string;
  entityCount: number;
  centroid: { x: number; y: number; z: number };
  spread: number; // Standard deviation from centroid
  kinds: Record<string, number>;
}

export interface CoordinateStatsSummary {
  totalPlacements: number;
  placementsByMethod: Record<string, number>;
  placementsByKind: Record<string, number>;
  placementsWithCulture: number;
  placementsWithoutCulture: number;
  regionsCreatedPerKind: Record<string, number>;
  regionUsagePerKind: Record<string, number>;
  cultureClusterStats: CultureClusterStats[];
  warnings: string[];
}

/**
 * Singleton statistics collector for coordinate system usage.
 */
class CoordinateStatisticsCollector {
  private placements: PlacementEvent[] = [];
  private regionCreations: Array<{ kind: string; regionId: string; tick: number }> = [];
  private warnings: string[] = [];
  private enabled: boolean = true;

  /**
   * Enable or disable statistics collection.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Reset all statistics.
   */
  reset(): void {
    this.placements = [];
    this.regionCreations = [];
    this.warnings = [];
  }

  /**
   * Record a placement event.
   */
  recordPlacement(event: PlacementEvent): void {
    if (!this.enabled) return;
    this.placements.push(event);
  }

  /**
   * Record a region creation.
   */
  recordRegionCreation(kind: string, regionId: string, tick: number): void {
    if (!this.enabled) return;
    this.regionCreations.push({ kind, regionId, tick });
  }

  /**
   * Add a warning.
   */
  warn(message: string): void {
    if (!this.enabled) return;
    this.warnings.push(message);
    console.warn(`[CoordinateStats] ${message}`);
  }

  /**
   * Get summary statistics.
   */
  getSummary(): CoordinateStatsSummary {
    const placementsByMethod: Record<string, number> = {};
    const placementsByKind: Record<string, number> = {};
    let placementsWithCulture = 0;
    let placementsWithoutCulture = 0;

    // Aggregate placement stats
    for (const p of this.placements) {
      placementsByMethod[p.method] = (placementsByMethod[p.method] || 0) + 1;
      placementsByKind[p.entityKind] = (placementsByKind[p.entityKind] || 0) + 1;

      if (p.cultureId) {
        placementsWithCulture++;
      } else {
        placementsWithoutCulture++;
      }
    }

    // Region creations per kind
    const regionsCreatedPerKind: Record<string, number> = {};
    for (const r of this.regionCreations) {
      regionsCreatedPerKind[r.kind] = (regionsCreatedPerKind[r.kind] || 0) + 1;
    }

    // Region usage per kind (from placements)
    const regionUsagePerKind: Record<string, number> = {};
    for (const p of this.placements) {
      if (p.regionId) {
        regionUsagePerKind[p.entityKind] = (regionUsagePerKind[p.entityKind] || 0) + 1;
      }
    }

    // Calculate culture clustering stats
    const cultureClusterStats = this.calculateCultureClustering();

    return {
      totalPlacements: this.placements.length,
      placementsByMethod,
      placementsByKind,
      placementsWithCulture,
      placementsWithoutCulture,
      regionsCreatedPerKind,
      regionUsagePerKind,
      cultureClusterStats,
      warnings: [...this.warnings]
    };
  }

  /**
   * Calculate culture clustering statistics.
   */
  private calculateCultureClustering(): CultureClusterStats[] {
    // Group placements by culture
    const byCulture = new Map<string, PlacementEvent[]>();
    for (const p of this.placements) {
      if (p.cultureId) {
        const list = byCulture.get(p.cultureId) || [];
        list.push(p);
        byCulture.set(p.cultureId, list);
      }
    }

    const stats: CultureClusterStats[] = [];

    for (const [cultureId, events] of byCulture) {
      if (events.length === 0) continue;

      // Calculate centroid
      let sumX = 0, sumY = 0, sumZ = 0;
      const kinds: Record<string, number> = {};

      for (const e of events) {
        sumX += e.coordinates.x;
        sumY += e.coordinates.y;
        sumZ += e.coordinates.z;
        kinds[e.entityKind] = (kinds[e.entityKind] || 0) + 1;
      }

      const n = events.length;
      const centroid = {
        x: sumX / n,
        y: sumY / n,
        z: sumZ / n
      };

      // Calculate spread (standard deviation)
      let sumSqDist = 0;
      for (const e of events) {
        const dx = e.coordinates.x - centroid.x;
        const dy = e.coordinates.y - centroid.y;
        const dz = e.coordinates.z - centroid.z;
        sumSqDist += dx * dx + dy * dy + dz * dz;
      }
      const spread = Math.sqrt(sumSqDist / n);

      stats.push({
        cultureId,
        entityCount: n,
        centroid,
        spread,
        kinds
      });
    }

    return stats;
  }

  /**
   * Print summary to console.
   */
  printSummary(): void {
    const summary = this.getSummary();

    console.log('\n' + '='.repeat(60));
    console.log('COORDINATE SYSTEM STATISTICS');
    console.log('='.repeat(60));

    console.log(`\nTotal placements: ${summary.totalPlacements}`);

    console.log('\n--- Placements by Method ---');
    for (const [method, count] of Object.entries(summary.placementsByMethod)) {
      const pct = ((count / summary.totalPlacements) * 100).toFixed(1);
      console.log(`  ${method}: ${count} (${pct}%)`);
    }

    console.log('\n--- Placements by Entity Kind ---');
    for (const [kind, count] of Object.entries(summary.placementsByKind)) {
      console.log(`  ${kind}: ${count}`);
    }

    console.log('\n--- Culture Context ---');
    console.log(`  With culture: ${summary.placementsWithCulture}`);
    console.log(`  Without culture: ${summary.placementsWithoutCulture}`);
    if (summary.placementsWithoutCulture > 0 && summary.totalPlacements > 0) {
      const pct = ((summary.placementsWithoutCulture / summary.totalPlacements) * 100).toFixed(1);
      console.log(`  ⚠️  ${pct}% of placements have no culture context!`);
    }

    console.log('\n--- Regions Created per Kind ---');
    const hasNonLocationRegions = Object.keys(summary.regionsCreatedPerKind).some(k => k !== 'location');
    if (Object.keys(summary.regionsCreatedPerKind).length === 0) {
      console.log('  No emergent regions created');
    } else {
      for (const [kind, count] of Object.entries(summary.regionsCreatedPerKind)) {
        console.log(`  ${kind}: ${count}`);
      }
    }
    if (!hasNonLocationRegions && Object.keys(summary.regionsCreatedPerKind).length > 0) {
      console.log('  ⚠️  Regions only created for "location" kind - other kinds have no regions!');
    }

    console.log('\n--- Culture Clustering ---');
    if (summary.cultureClusterStats.length === 0) {
      console.log('  No culture clustering data (no culture context used)');
    } else {
      for (const cs of summary.cultureClusterStats) {
        console.log(`  ${cs.cultureId}:`);
        console.log(`    Entities: ${cs.entityCount}`);
        console.log(`    Centroid: (${cs.centroid.x.toFixed(1)}, ${cs.centroid.y.toFixed(1)}, ${cs.centroid.z.toFixed(1)})`);
        console.log(`    Spread: ${cs.spread.toFixed(1)}`);
        console.log(`    Kinds: ${Object.entries(cs.kinds).map(([k, v]) => `${k}:${v}`).join(', ')}`);
      }
    }

    if (summary.warnings.length > 0) {
      console.log('\n--- Warnings ---');
      for (const w of summary.warnings.slice(0, 20)) {
        console.log(`  ⚠️  ${w}`);
      }
      if (summary.warnings.length > 20) {
        console.log(`  ... and ${summary.warnings.length - 20} more warnings`);
      }
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

// Singleton instance
export const coordinateStats = new CoordinateStatisticsCollector();
