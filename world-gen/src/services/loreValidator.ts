import { HardState } from '../types/worldTypes';
import { LoreIndex } from '../types/lore';

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
}

export class LoreValidator {
  private loreIndex: LoreIndex;

  constructor(loreIndex: LoreIndex) {
    this.loreIndex = loreIndex;
  }

  validateEntity(entity: HardState, text?: string): ValidationResult {
    const warnings: string[] = [];

    // Names should roughly follow two-part pattern with separator
    if (entity.name && !/[ -]/.test(entity.name)) {
      warnings.push('Name may not include earned-name separator (space or hyphen).');
    }

    // Flag if description lacks any cultural cues
    if (text && !this.containsLoreCue(text)) {
      warnings.push('Description missing obvious lore cues.');
    }

    // Lightweight tech vs magic balance check
    if (entity.kind === 'abilities') {
      const hasMagicCue = this.loreIndex.magicNotes.some(note => text?.toLowerCase().includes('magic'));
      const hasTechCue = this.loreIndex.techNotes.some(note => text?.toLowerCase().includes('harpoon') || text?.toLowerCase().includes('tech'));

      if (!hasMagicCue && !hasTechCue) {
        warnings.push('Ability lacks clear magic/tech framing.');
      }
    }

    return { valid: warnings.length === 0, warnings };
  }

  private containsLoreCue(text: string): boolean {
    const cues = [
      'aurora',
      'ice',
      'berg',
      'fissure',
      'current',
      'frost',
      'glow',
      'krill',
      'coin',
      'sing'
    ];

    return cues.some(cue => text.toLowerCase().includes(cue));
  }
}
