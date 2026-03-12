/**
 * StylePills — Shared component showing assigned artistic/composition/palette styles as colored pills.
 *
 * Used by both CurationImageSheet (chronicle images) and EntityImageSheet (entity images).
 */

import React from "react";
import "./StylePills.css";

export interface StyleNameMaps {
  artistic: Map<string, string>;
  composition: Map<string, string>;
  palette: Map<string, string>;
}

export default function StylePills({ artisticId, compositionId, paletteId, styleNames }: Readonly<{
  artisticId?: string;
  compositionId?: string;
  paletteId?: string;
  styleNames: StyleNameMaps;
}>) {
  const artistic = artisticId ? styleNames.artistic.get(artisticId) : undefined;
  const composition = compositionId ? styleNames.composition.get(compositionId) : undefined;
  const palette = paletteId ? styleNames.palette.get(paletteId) : undefined;

  if (!artistic && !composition && !palette) return null;

  return (
    <div className="cis-style-pills">
      {artistic && <span className="cis-pill cis-pill-artistic" title="Artistic style">{artistic}</span>}
      {composition && <span className="cis-pill cis-pill-composition" title="Composition">{composition}</span>}
      {palette && <span className="cis-pill cis-pill-palette" title="Color palette">{palette}</span>}
    </div>
  );
}
