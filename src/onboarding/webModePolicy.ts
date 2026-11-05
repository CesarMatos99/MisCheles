export type RestoredWebMode = 'demo' | 'local' | 'legacyLocal';

/** Restores explicit demo/local selections while surfacing unmarked legacy browser data. */
export function resolveRestoredWebMode(savedMode: string | null, hasLegacyRecords: boolean): RestoredWebMode | null {
  if (savedMode === 'demo') return 'demo';
  if (savedMode === 'local') return 'local';
  if (hasLegacyRecords) return 'legacyLocal';
  return null;
}
