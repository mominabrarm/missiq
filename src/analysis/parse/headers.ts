/**
 * Header detection and message-line parsing for transcript formats F1–F4.
 * Per PRD §FR-004 / §17.3.
 *
 * Format precedence (ordered F1→F4):
 * F1: [dd/mm/yyyy, HH:mm] Sender: text
 * F2: dd/mm/yyyy, HH:mm - Sender: text
 * F3: yyyy-mm-dd HH:mm Sender: text  or  yyyy-mm-ddTHH:mm:ss Sender: text
 * F4: Sender: text (no timestamp)
 */

import { SYSTEM_LINE_PATTERNS } from '../../config/patterns';

export type FormatId = 'F1' | 'F2' | 'F3' | 'F4';

export interface HeaderMatch {
  format: FormatId;
  rawTimestamp: string | null;
  sender: string;
  text: string;
  isSystem: boolean;
}

/**
 * F1: [12/03/2026, 14:05] Sender: text
 * Also handles: [12/03/26, 14:05] and [12/03/2026, 2:05 PM] etc.
 */
const F1_REGEX = /^\[(\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm))?)\]\s+([^:]+?):\s([\s\S]*)$/i;

/**
 * F2: 12/03/2026, 14:05 - Sender: text
 */
const F2_REGEX = /^(\d{1,2}[/.]\d{1,2}[/.]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm))?)\s+-\s+([^:]+?):\s([\s\S]*)$/i;

/**
 * F3: 2026-03-12 14:05 Sender: text  or  2026-03-12T14:05:00 Sender: text
 */
const F3_REGEX = /^(\d{4}-\d{2}-\d{2}[T ]\d{1,2}:\d{2}(?::\d{2})?)\s+([^:]+?):\s([\s\S]*)$/;

/**
 * F4: Sender: text (no timestamp)
 * Sender must start with a word character and contain no line breaks.
 * We require sender to be reasonably short (≤60 chars) to avoid false positives.
 */
const F4_REGEX = /^([A-Za-z\u00C0-\u024F\u0400-\u04FF][\w\s.'-]{0,59}):\s([\s\S]*)$/;

/**
 * Try to match a line against formats F1→F4 in order.
 * Returns null if no format matches.
 */
export function matchHeader(line: string): HeaderMatch | null {
  // F1
  let match = line.match(F1_REGEX);
  if (match) {
    const text = match[3];
    return {
      format: 'F1',
      rawTimestamp: match[1].trim(),
      sender: match[2].trim(),
      text,
      isSystem: isSystemLine(text),
    };
  }

  // F2
  match = line.match(F2_REGEX);
  if (match) {
    const text = match[3];
    return {
      format: 'F2',
      rawTimestamp: match[1].trim(),
      sender: match[2].trim(),
      text,
      isSystem: isSystemLine(text),
    };
  }

  // F3
  match = line.match(F3_REGEX);
  if (match) {
    const text = match[3];
    return {
      format: 'F3',
      rawTimestamp: match[1].trim(),
      sender: match[2].trim(),
      text,
      isSystem: isSystemLine(text),
    };
  }

  // F4
  match = line.match(F4_REGEX);
  if (match) {
    const sender = match[1].trim();
    const text = match[2];
    // Reject if sender looks like a date, URL, or very long phrase
    if (sender.length > 40 && sender.includes(' ')) return null;
    return {
      format: 'F4',
      rawTimestamp: null,
      sender,
      text,
      isSystem: isSystemLine(text),
    };
  }

  return null;
}

/**
 * Check if a message text matches a known system/notification pattern.
 */
function isSystemLine(text: string): boolean {
  const trimmed = text.trim();
  for (const pattern of SYSTEM_LINE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

/**
 * Detect the majority format from a set of header matches.
 */
export function detectFormat(matches: HeaderMatch[]): 'F1' | 'F2' | 'F3' | 'F4' | 'mixed' | 'none' {
  if (matches.length === 0) return 'none';

  const counts: Record<FormatId, number> = { F1: 0, F2: 0, F3: 0, F4: 0 };
  for (const m of matches) {
    counts[m.format]++;
  }

  const entries = (Object.entries(counts) as [FormatId, number][])
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return 'none';
  if (entries.length === 1) return entries[0][0];

  // If one format dominates (>50%), use it; otherwise "mixed"
  const total = matches.length;
  if (entries[0][1] / total > 0.5) return entries[0][0];
  return 'mixed';
}
