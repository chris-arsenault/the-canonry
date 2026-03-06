/**
 * SubtypeBonusesSection - List of subtype bonus rows with add button.
 */

import React, { useCallback, useMemo } from "react";
import { ReferenceDropdown, NumberInput } from "../../../shared";
import type { SubtypeBonus, DropdownOption } from "./types";

// ---------------------------------------------------------------------------
// SubtypeBonusRow
// ---------------------------------------------------------------------------

interface SubtypeBonusRowProps {
  readonly bonus: SubtypeBonus;
  readonly index: number;
  readonly subtypeOptions: readonly DropdownOption[];
  readonly onUpdate: (index: number, bonus: SubtypeBonus) => void;
  readonly onRemove: (index: number) => void;
}

function SubtypeBonusRow({
  bonus,
  index,
  subtypeOptions,
  onUpdate,
  onRemove,
}: SubtypeBonusRowProps) {
  const handleSubtypeChange = useCallback(
    (v: string | undefined) => onUpdate(index, { ...bonus, subtype: v || "" }),
    [onUpdate, index, bonus],
  );

  const handleBonusChange = useCallback(
    (v: number | undefined) => onUpdate(index, { ...bonus, bonus: v ?? 0 }),
    [onUpdate, index, bonus],
  );

  const handleRemove = useCallback(
    () => onRemove(index),
    [onRemove, index],
  );

  return (
    <div className="item-card">
      <div className="py-lg px-xl">
        <div className="form-row-with-delete">
          <div className="form-row-fields">
            <ReferenceDropdown
              label="Subtype"
              value={bonus.subtype}
              onChange={handleSubtypeChange}
              options={subtypeOptions}
            />
            <div className="form-group">
              <label className="label">Bonus
              <NumberInput
                value={bonus.bonus}
                onChange={handleBonusChange}
              />
              </label>
            </div>
          </div>
          <button
            className="btn-icon btn-icon-danger"
            onClick={handleRemove}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubtypeBonusesSection
// ---------------------------------------------------------------------------

interface SubtypeBonusesSectionProps {
  readonly subtypeBonuses: readonly SubtypeBonus[];
  readonly selectionKind: string | undefined;
  readonly getSubtypeOptions: (kind: string | undefined) => DropdownOption[];
  readonly onAddBonus: () => void;
  readonly onUpdateBonus: (index: number, bonus: SubtypeBonus) => void;
  readonly onRemoveBonus: (index: number) => void;
}

export function SubtypeBonusesSection({
  subtypeBonuses,
  selectionKind,
  getSubtypeOptions,
  onAddBonus,
  onUpdateBonus,
  onRemoveBonus,
}: SubtypeBonusesSectionProps) {
  const subtypeOptions = useMemo(
    () => getSubtypeOptions(selectionKind),
    [getSubtypeOptions, selectionKind],
  );

  return (
    <div className="section">
      <div className="section-title">Subtype Bonuses ({subtypeBonuses.length})</div>
      <div className="section-desc">Bonuses added to metric value based on entity subtype.</div>

      {subtypeBonuses.map((bonus, index) => (
        <SubtypeBonusRow
          key={index}
          bonus={bonus}
          index={index}
          subtypeOptions={subtypeOptions}
          onUpdate={onUpdateBonus}
          onRemove={onRemoveBonus}
        />
      ))}

      <button className="btn-add" onClick={onAddBonus}>
        + Add Subtype Bonus
      </button>
    </div>
  );
}
