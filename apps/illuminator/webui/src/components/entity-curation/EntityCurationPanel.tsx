/**
 * EntityCurationPanel — Two-rail entity image curation workspace.
 *
 * Left: EntityCurationNavigator (kind/culture groups)
 * Center: EntityImageSheet (entity cards with style pills + thumbnail strips)
 */

import React, { useState, useMemo, useCallback } from "react";
import type { StyleLibrary } from "@canonry/world-schema";
import { useEntityStore } from "../../lib/db/entityStore";
import EntityCurationNavigator from "./EntityCurationNavigator";
import EntityImageSheet from "./EntityImageSheet";
import "./EntityCurationPanel.css";

interface Props {
  styleLibrary: StyleLibrary | null;
}

export default function EntityCurationPanel({ styleLibrary }: Readonly<Props>) {
  const navItems = useEntityStore((s) => s.navItems);
  const entityNavItems = useMemo(
    () => Array.from(navItems.values()),
    [navItems],
  );

  const [selectedKind, setSelectedKind] = useState<string | null>(null);
  const [selectedCulture, setSelectedCulture] = useState<string | null>(null);

  // Build style ID → name lookup maps
  const styleNames = useMemo(() => {
    const artistic = new Map<string, string>();
    const composition = new Map<string, string>();
    const palette = new Map<string, string>();
    if (styleLibrary) {
      for (const s of styleLibrary.artisticStyles) artistic.set(s.id, s.name);
      for (const s of styleLibrary.compositionStyles) composition.set(s.id, s.name);
      for (const p of styleLibrary.colorPalettes) palette.set(p.id, p.name);
    }
    return { artistic, composition, palette };
  }, [styleLibrary]);

  // Filter entities by kind/culture selection
  const filteredEntities = useMemo(() => {
    let items = entityNavItems;
    if (selectedKind) items = items.filter((e) => e.kind === selectedKind);
    if (selectedCulture)
      items = items.filter((e) => e.culture === selectedCulture);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [entityNavItems, selectedKind, selectedCulture]);

  const handleSelectGroup = useCallback(
    (kind: string | null, culture: string | null) => {
      setSelectedKind(kind);
      setSelectedCulture(culture);
    },
    [],
  );

  return (
    <div className="ecp-workspace">
      <div className="ecp-left-rail">
        <EntityCurationNavigator
          entityNavItems={entityNavItems}
          selectedKind={selectedKind}
          selectedCulture={selectedCulture}
          onSelect={handleSelectGroup}
        />
      </div>
      <div className="ecp-center-rail">
        <EntityImageSheet
          entities={filteredEntities}
          styleNames={styleNames}
        />
      </div>
    </div>
  );
}
