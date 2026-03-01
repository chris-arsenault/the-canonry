/**
 * useEntityBrowserFilters - Filter logic extracted from EntityBrowser
 */

import { useMemo } from "react";
import { prominenceLabelFromScale } from "@canonry/world-schema";
import type { ProminenceScale } from "@canonry/world-schema";
import type { EntityNavItem } from "../../lib/db/entityNav";
import type { EntityFilters, FilterOptions, EnrichmentStatus, EntityBrowserConfig } from "../EntityBrowserTypes";

type GetStatusFn = (nav: EntityNavItem, type: string) => EnrichmentStatus;

function matchesStatusFilter(
  statusFilter: string,
  descStatus: EnrichmentStatus,
  imgStatus: EnrichmentStatus
): boolean {
  if (statusFilter === "all") return true;
  if (statusFilter === "missing") return descStatus === "missing" || imgStatus === "missing";
  if (statusFilter === "complete") return descStatus === "complete";
  if (statusFilter === "queued") return descStatus === "queued" || imgStatus === "queued";
  if (statusFilter === "running") return descStatus === "running" || imgStatus === "running";
  if (statusFilter === "error") return descStatus === "error" || imgStatus === "error";
  return true;
}

function matchesChronicleImageFilter(filter: string, nav: EntityNavItem): boolean {
  if (filter === "all") return true;
  if (filter === "none") return nav.backrefCount === 0;
  if (filter === "unconfigured") return nav.backrefCount > 0 && nav.unconfiguredBackrefCount > 0;
  if (filter === "configured") return nav.backrefCount > 0 && nav.unconfiguredBackrefCount === 0;
  return true;
}

export function useEntityBrowserFilters(
  navEntities: EntityNavItem[],
  filters: EntityFilters,
  hideCompleted: boolean,
  getStatus: GetStatusFn,
  prominenceScale: ProminenceScale,
  config: EntityBrowserConfig
): {
  filteredNavItems: EntityNavItem[];
  filterOptions: FilterOptions;
} {
  const filterOptions = useMemo<FilterOptions>(() => {
    const kinds = new Set<string>();
    const cultures = new Set<string>();

    for (const entity of navEntities) {
      kinds.add(entity.kind);
      if (entity.culture) cultures.add(entity.culture);
    }

    return {
      kinds: Array.from(kinds).sort(),
      cultures: Array.from(cultures).sort(),
    };
  }, [navEntities]);

  const filteredNavItems = useMemo(() => {
    return navEntities.filter((nav) => {
      if (filters.kind !== "all" && nav.kind !== filters.kind) return false;
      if (
        filters.prominence !== "all" &&
        prominenceLabelFromScale(nav.prominence, prominenceScale) !== filters.prominence
      ) {
        return false;
      }
      if (filters.culture !== "all" && nav.culture !== filters.culture) return false;

      const descStatus = getStatus(nav, "description");
      const imgStatus = getStatus(nav, "image");

      if (hideCompleted && descStatus === "complete" && imgStatus === "complete") return false;
      if (!matchesStatusFilter(filters.status, descStatus, imgStatus)) return false;
      if (!matchesChronicleImageFilter(filters.chronicleImage, nav)) return false;

      return true;
    });
  }, [navEntities, filters, hideCompleted, getStatus, prominenceScale]);

  return { filteredNavItems, filterOptions };
}
