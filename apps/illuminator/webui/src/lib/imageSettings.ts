/**
 * Image generation settings constants
 *
 * Shared configuration for image model, size, and quality options.
 * Used by ConfigPanel for global settings and EntityBrowser for per-entity overrides.
 */

export const IMAGE_MODELS = [
  { value: 'gpt-image-1.5', label: 'GPT Image 1.5' },
  { value: 'gpt-image-1', label: 'GPT Image 1' },
  { value: 'dall-e-3', label: 'DALL-E 3' },
  { value: 'dall-e-2', label: 'DALL-E 2 (cheaper)' },
] as const;

// Model-specific size options
export const IMAGE_SIZES_BY_MODEL: Record<string, Array<{ value: string; label: string }>> = {
  'gpt-image-1.5': [
    { value: 'auto', label: 'Auto' },
    { value: '1024x1024', label: '1024x1024 (Square)' },
    { value: '1536x1024', label: '1536x1024 (Landscape)' },
    { value: '1024x1536', label: '1024x1536 (Portrait)' },
  ],
  'gpt-image-1': [
    { value: 'auto', label: 'Auto' },
    { value: '1024x1024', label: '1024x1024 (Square)' },
    { value: '1536x1024', label: '1536x1024 (Landscape)' },
    { value: '1024x1536', label: '1024x1536 (Portrait)' },
  ],
  'dall-e-3': [
    { value: '1024x1024', label: '1024x1024 (Square)' },
    { value: '1792x1024', label: '1792x1024 (Landscape)' },
    { value: '1024x1792', label: '1024x1792 (Portrait)' },
  ],
  'dall-e-2': [
    { value: '1024x1024', label: '1024x1024' },
    { value: '512x512', label: '512x512' },
    { value: '256x256', label: '256x256' },
  ],
};

// Model-specific quality options
export const IMAGE_QUALITY_BY_MODEL: Record<string, Array<{ value: string; label: string }>> = {
  'gpt-image-1.5': [
    { value: 'auto', label: 'Auto' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ],
  'gpt-image-1': [
    { value: 'auto', label: 'Auto' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ],
  'dall-e-3': [
    { value: 'standard', label: 'Standard' },
    { value: 'hd', label: 'HD' },
  ],
  'dall-e-2': [
    { value: 'standard', label: 'Standard' },
  ],
};

/**
 * Get size options for a given model
 */
export function getSizeOptions(model: string): Array<{ value: string; label: string }> {
  return IMAGE_SIZES_BY_MODEL[model] || IMAGE_SIZES_BY_MODEL['dall-e-3'];
}

/**
 * Get quality options for a given model
 */
export function getQualityOptions(model: string): Array<{ value: string; label: string }> {
  return IMAGE_QUALITY_BY_MODEL[model] || IMAGE_QUALITY_BY_MODEL['dall-e-3'];
}

/**
 * Get the default size for a model
 */
export function getDefaultSize(model: string): string {
  const options = getSizeOptions(model);
  return options[0]?.value || '1024x1024';
}

/**
 * Get the default quality for a model
 */
export function getDefaultQuality(model: string): string {
  const options = getQualityOptions(model);
  return options[0]?.value || 'standard';
}

/**
 * Check if a size is valid for a model
 */
export function isValidSize(model: string, size: string): boolean {
  const options = getSizeOptions(model);
  return options.some(opt => opt.value === size);
}

/**
 * Check if a quality is valid for a model
 */
export function isValidQuality(model: string, quality: string): boolean {
  const options = getQualityOptions(model);
  return options.some(opt => opt.value === quality);
}
