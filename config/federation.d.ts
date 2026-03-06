interface SharedDepConfig {
  singleton: boolean;
  requiredVersion?: string;
}

export declare function federationOnWarn(
  warning: { code?: string; id?: string; message: string },
  warn: (warning: unknown) => void
): void;

export declare const sharedDepsBase: Record<string, SharedDepConfig>;
export declare const sharedDepsExtended: Record<string, SharedDepConfig>;
export declare function sharedDeps(...keys: string[]): Record<string, SharedDepConfig>;
