/**
 * Timestamp parsing utilities per PRD §17.3.
 * Handles F1–F3 timestamp formats, DD/MM vs MM/DD disambiguation,
 * two-digit year normalization, and AM/PM handling.
 */

import { ParsedTimestamp } from '../../types/model';

/** Day-of-week abbreviation map for relative date resolution */
const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

/** Month name to 0-based index */
const MONTH_NAME_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

export type DateFieldOrder = 'DD/MM' | 'MM/DD' | 'unknown';

export function inferDateFieldOrder(source: string | string[]): DateFieldOrder {
  let firstFieldHigh = false;
  let secondFieldHigh = false;

  const fullText = Array.isArray(source) ? source.join('\n') : source;
  // Match patterns like dd/mm/yyyy or dd/mm
  const regex = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(fullText)) !== null) {
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    if (first > 12 && second <= 12) firstFieldHigh = true;
    if (second > 12 && first <= 12) secondFieldHigh = true;
  }

  if (firstFieldHigh && !secondFieldHigh) return 'DD/MM';
  if (secondFieldHigh && !firstFieldHigh) return 'MM/DD';
  return 'unknown';
}


/**
 * Normalize a two-digit year: 00–69 → 2000s, 70–99 → 1900s.
 */
function normalizeYear(year: number): number {
  if (year < 100) {
    return year <= 69 ? 2000 + year : 1900 + year;
  }
  return year;
}

/**
 * Parse a time string like "14:05", "2:05 PM", "5pm" into { hours, minutes }.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const trimmed = timeStr.trim().toLowerCase();

  // "5pm", "5 pm", "12am"
  const shortMatch = trimmed.match(/^(\d{1,2})\s*(am|pm)$/);
  if (shortMatch) {
    let h = parseInt(shortMatch[1], 10);
    const ampm = shortMatch[2];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return { hours: h, minutes: 0 };
  }

  // "14:05", "2:05", "14:05:30"
  const fullMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (fullMatch) {
    let h = parseInt(fullMatch[1], 10);
    const m = parseInt(fullMatch[2], 10);
    const ampm = fullMatch[4];
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    return { hours: h, minutes: m };
  }

  return null;
}

/**
 * Parse a raw timestamp string from a chat header into a ParsedTimestamp.
 * 
 * Supported formats:
 * - "12/03/2026, 14:05" (F1/F2 style)
 * - "2026-03-12 14:05" or "2026-03-12T14:05:00" (F3 ISO style)
 * - "12/03/26, 14:05" (two-digit year)
 */
export function parseTimestamp(raw: string, fieldOrder: DateFieldOrder): ParsedTimestamp {
  const trimmed = raw.trim();

  // Try ISO format first: 2026-03-12 14:05 or 2026-03-12T14:05:00
  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}:\d{2}(?::\d{2})?))?$/
  );
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);  // 1-based
    const day = parseInt(isoMatch[3], 10);
    const time = isoMatch[4] ? parseTime(isoMatch[4]) : null;

    const iso = formatIso(year, month, day, time?.hours, time?.minutes);
    return { raw: trimmed, iso, ambiguous: false };
  }

  // Try dd/mm/yyyy or mm/dd/yyyy or dd/mm/yy — date part
  const dateTimeMatch = trimmed.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[,\s]+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:am|pm))?))?$/i
  );
  if (dateTimeMatch) {
    const first = parseInt(dateTimeMatch[1], 10);
    const second = parseInt(dateTimeMatch[2], 10);
    const year = normalizeYear(parseInt(dateTimeMatch[3], 10));
    const time = dateTimeMatch[4] ? parseTime(dateTimeMatch[4]) : null;

    let day: number;
    let month: number; // 1-based
    let ambiguous = false;

    if (fieldOrder === 'DD/MM') {
      day = first;
      month = second;
    } else if (fieldOrder === 'MM/DD') {
      month = first;
      day = second;
    } else {
      // Attempt to disambiguate from values
      if (first > 12) {
        day = first;
        month = second;
      } else if (second > 12) {
        month = first;
        day = second;
      } else {
        // Truly ambiguous
        ambiguous = true;
        day = first;
        month = second;
      }
    }

    if (ambiguous) {
      return { raw: trimmed, ambiguous: true };
    }

    const iso = formatIso(year, month, day, time?.hours, time?.minutes);
    return { raw: trimmed, iso, ambiguous: false };
  }

  // Date without year: dd/mm or mm/dd
  const shortDateMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (shortDateMatch) {
    const first = parseInt(shortDateMatch[1], 10);
    const second = parseInt(shortDateMatch[2], 10);

    let ambiguous = false;
    if (fieldOrder === 'unknown' && first <= 12 && second <= 12) {
      ambiguous = true;
    }
    // Without year, we can't produce a full ISO
    return { raw: trimmed, ambiguous };
  }

  // Fallback: unrecognized timestamp format
  return { raw: trimmed, ambiguous: false };
}

function formatIso(year: number, month: number, day: number, hours?: number, minutes?: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  if (hours !== undefined && minutes !== undefined) {
    const h = String(hours).padStart(2, '0');
    const min = String(minutes).padStart(2, '0');
    return `${year}-${m}-${d}T${h}:${min}:00`;
  }
  return `${year}-${m}-${d}`;
}

/**
 * Resolve a relative date expression against a reference date.
 * Returns an ISO string or undefined if unresolvable.
 */
export function resolveRelativeDate(
  expression: string,
  referenceIso: string | undefined,
): string | undefined {
  if (!referenceIso) return undefined;

  const refDate = new Date(referenceIso);
  if (isNaN(refDate.getTime())) return undefined;

  const lower = expression.toLowerCase().trim();

  // "today" / "tonight"
  if (lower === 'today' || lower === 'tonight') {
    return formatIso(refDate.getFullYear(), refDate.getMonth() + 1, refDate.getDate());
  }

  // "tomorrow"
  if (lower === 'tomorrow') {
    const next = new Date(refDate);
    next.setDate(next.getDate() + 1);
    return formatIso(next.getFullYear(), next.getMonth() + 1, next.getDate());
  }

  // Day names: "Friday", "monday", etc.
  const dayIndex = WEEKDAY_MAP[lower];
  if (dayIndex !== undefined) {
    const current = refDate.getDay();
    let diff = dayIndex - current;
    if (diff <= 0) diff += 7; // Next occurrence
    const target = new Date(refDate);
    target.setDate(target.getDate() + diff);
    return formatIso(target.getFullYear(), target.getMonth() + 1, target.getDate());
  }

  // "EOD" / "end of day"
  if (lower === 'eod' || lower === 'end of day' || lower === 'end of business') {
    return formatIso(refDate.getFullYear(), refDate.getMonth() + 1, refDate.getDate());
  }

  return undefined;
}

/**
 * Parse a month name into a 0-based month index, or undefined.
 */
export function parseMonthName(name: string): number | undefined {
  return MONTH_NAME_MAP[name.toLowerCase()];
}

export { WEEKDAY_MAP };
