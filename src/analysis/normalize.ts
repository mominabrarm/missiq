/**
 * Text normalization for matching — per PRD §17.3 step 6.
 * Normalize text only for matching; original text is never altered.
 * NFC normalization, collapse whitespace, strip zero-width, fold smart quotes, lowercase.
 */

/**
 * Normalize text for matching purposes.
 * Does NOT alter stored original text — only used for comparison/matching.
 */
export function normalizeForMatching(text: string): string {
  let normalized = text;

  // NFC Unicode normalization
  normalized = normalized.normalize('NFC');

  // Strip zero-width characters (zero-width space, ZWNJ, ZWJ, soft hyphen, BOM, etc.)
  normalized = normalized.replace(/[\u200B\uFEFF\u00AD\u200E\u200F]|\u200C|\u200D/g, '');

  // Fold smart quotes → straight quotes
  normalized = normalized
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // single smart quotes
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // double smart quotes
    .replace(/[\u2013\u2014]/g, '-')               // en/em dash → hyphen
    .replace(/\u2026/g, '...');                     // ellipsis

  // Collapse whitespace (spaces, tabs, newlines within a line) → single space
  normalized = normalized.replace(/[ \t]+/g, ' ').trim();

  // Lowercase for matching
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * Normalize whitespace only (no case change, no unicode folding).
 * Used for display normalization where case matters.
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Check if two strings are equal after normalization.
 */
export function normalizedEquals(a: string, b: string): boolean {
  return normalizeForMatching(a) === normalizeForMatching(b);
}

/**
 * Check if the haystack contains the needle after normalization.
 */
export function normalizedIncludes(haystack: string, needle: string): boolean {
  return normalizeForMatching(haystack).includes(normalizeForMatching(needle));
}
