/**
 * Deadline and date extraction per PRD §FR-009.
 *
 * Extracts explicit deadline expressions from message text.
 * Preserves original wording; does not invent dates from ambiguous expressions.
 * Resolves relative dates only against a known reference date.
 */

import { ParsedMessage, DeadlineInfo, TextSpan } from '../../types/model';
import { normalizeForMatching } from '../normalize';
import { resolveRelativeDate, parseMonthName, DateFieldOrder } from '../parse/timestamps';
import {
  DEADLINE_PHRASES,
  RELATIVE_DAY_EXPRESSIONS,
  TIME_EXPRESSIONS,
  WEEKDAY_NAMES,
  MONTH_NAMES,
} from '../../config/patterns';

export interface DeadlineCandidate {
  deadline: DeadlineInfo;
  messageId: string;
  span: TextSpan;
}

/**
 * Extract deadline candidates from a set of parsed messages.
 * Returns all deadline candidates found, each linked to its source message.
 */
export function extractDeadlines(
  messages: ParsedMessage[],
  fieldOrder: DateFieldOrder = 'unknown',
): DeadlineCandidate[] {
  const candidates: DeadlineCandidate[] = [];

  for (const msg of messages) {
    if (msg.parsingStatus === 'system' || msg.isDuplicateOf) continue;

    const msgDeadlines = extractFromMessage(msg, fieldOrder);
    candidates.push(...msgDeadlines);
  }

  return candidates;
}

function extractFromMessage(msg: ParsedMessage, fieldOrder: DateFieldOrder = 'unknown'): DeadlineCandidate[] {
  const results: DeadlineCandidate[] = [];
  const text = msg.text;
  const normalizedText = normalizeForMatching(text);
  const lowerText = text.toLowerCase();

  // Reference date from message timestamp (if available)
  const referenceIso = msg.timestamp?.iso;

  // Pattern 1: "by/before/due/deadline <date expression>"
  for (const phrase of DEADLINE_PHRASES) {
    const regex = new RegExp(
      `\\b${phrase}\\s+(${buildDateExpressionPattern()})`,
      'gi'
    );
    let match: RegExpExecArray | null;
    while ((match = regex.exec(lowerText)) !== null) {
      const rawText = text.slice(match.index, match.index + match[0].length);
      const dateExpr = match[1].trim();
      const deadline = resolveDeadlineExpression(dateExpr, rawText, referenceIso, fieldOrder);

      // Verify rawText appears in normalized text (V-04)
      const normalizedRaw = normalizeForMatching(rawText);
      if (!normalizedText.includes(normalizedRaw)) continue;

      const span = findSpanInText(text, rawText, match.index);
      results.push({
        deadline,
        messageId: msg.id,
        span,
      });
    }
  }

  // Pattern 2: Standalone date expressions with time (e.g., "14/03 at 4pm", "March 12")
  const standaloneDateRegex = /\b(\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?)(?:\s+(?:in|at)\s+[^,.]+)?/gi;
  let sMatch: RegExpExecArray | null;
  while ((sMatch = standaloneDateRegex.exec(lowerText)) !== null) {
    const dateStr = sMatch[1].trim();
    // Skip if already captured by deadline phrase
    const alreadyCaptured = results.some(r => {
      const rNorm = normalizeForMatching(r.deadline.rawText);
      return rNorm.includes(normalizeForMatching(dateStr));
    });
    if (alreadyCaptured) continue;

    // Check if this is part of a timestamp header (skip it)
    if (msg.timestamp?.raw && normalizeForMatching(msg.timestamp.raw).includes(normalizeForMatching(dateStr))) {
      continue;
    }

    const rawText = text.slice(sMatch.index, sMatch.index + sMatch[0].length);
    const deadline = resolveStandaloneDate(dateStr, rawText, referenceIso, fieldOrder);
    if (deadline) {
      const span = findSpanInText(text, rawText, sMatch.index);
      results.push({
        deadline,
        messageId: msg.id,
        span,
      });
    }
  }

  // Pattern 3: Relative day expressions ("today", "tomorrow", "tonight")
  for (const expr of RELATIVE_DAY_EXPRESSIONS) {
    const regex = new RegExp(`\\b${expr}\\b`, 'gi');
    let rMatch: RegExpExecArray | null;
    while ((rMatch = regex.exec(lowerText)) !== null) {
      // Skip if already captured
      const alreadyCaptured = results.some(r =>
        normalizeForMatching(r.deadline.rawText).includes(expr)
      );
      if (alreadyCaptured) continue;

      const rawText = text.slice(rMatch.index, rMatch.index + rMatch[0].length);
      // Check for following time: "tomorrow 5pm"
      const afterMatch = lowerText.slice(rMatch.index + rMatch[0].length).match(
        /^\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i
      );
      let fullRawText = rawText;
      let timeHours: number | undefined;
      let timeMinutes: number | undefined;

      if (afterMatch) {
        fullRawText = text.slice(rMatch.index, rMatch.index + rMatch[0].length + afterMatch[0].length);
        const timeParsed = parseSimpleTime(afterMatch[1].trim());
        if (timeParsed) {
          timeHours = timeParsed.hours;
          timeMinutes = timeParsed.minutes;
        }
      }

      const resolvedIso = resolveRelativeDate(expr, referenceIso);
      let finalIso = resolvedIso;
      if (finalIso && timeHours !== undefined && timeMinutes !== undefined) {
        // Append time to the resolved date
        finalIso = finalIso.split('T')[0] +
          `T${String(timeHours).padStart(2, '0')}:${String(timeMinutes).padStart(2, '0')}:00`;
      }

      results.push({
        deadline: {
          rawText: fullRawText,
          resolvedIso: finalIso,
          resolution: finalIso ? 'relative-resolved' : 'unresolved',
          origin: 'same-message',
        },
        messageId: msg.id,
        span: findSpanInText(text, fullRawText, rMatch.index),
      });
    }
  }

  // Pattern 4: EOD / "end of day"
  for (const expr of TIME_EXPRESSIONS) {
    const regex = new RegExp(`\\b${expr.replace(/ /g, '\\s+')}\\b`, 'gi');
    let tMatch: RegExpExecArray | null;
    while ((tMatch = regex.exec(lowerText)) !== null) {
      const alreadyCaptured = results.some(r =>
        normalizeForMatching(r.deadline.rawText).includes(normalizeForMatching(expr))
      );
      if (alreadyCaptured) continue;

      const rawText = text.slice(tMatch.index, tMatch.index + tMatch[0].length);
      const resolvedIso = resolveRelativeDate(expr, referenceIso);

      results.push({
        deadline: {
          rawText,
          resolvedIso,
          resolution: resolvedIso ? 'relative-resolved' : 'unresolved',
          origin: 'same-message',
        },
        messageId: msg.id,
        span: findSpanInText(text, rawText, tMatch.index),
      });
    }
  }

  // Pattern 5: Weekday names ("by Friday", standalone "Friday")
  for (const day of WEEKDAY_NAMES) {
    const regex = new RegExp(`\\b${day}\\b`, 'gi');
    let dMatch: RegExpExecArray | null;
    while ((dMatch = regex.exec(lowerText)) !== null) {
      const alreadyCaptured = results.some(r =>
        normalizeForMatching(r.deadline.rawText).includes(day)
      );
      if (alreadyCaptured) continue;

      const rawText = text.slice(dMatch.index, dMatch.index + dMatch[0].length);
      const resolvedIso = resolveRelativeDate(day, referenceIso);

      results.push({
        deadline: {
          rawText,
          resolvedIso,
          resolution: resolvedIso ? 'relative-resolved' : 'unresolved',
          origin: 'same-message',
        },
        messageId: msg.id,
        span: findSpanInText(text, rawText, dMatch.index),
      });
    }
  }

  // Pattern 6: Named month dates ("12 Mar", "March 12", "12 March 2026")
  for (const monthName of MONTH_NAMES) {
    // "12 Mar" or "12 March" or "12 March 2026"
    const regex1 = new RegExp(
      `\\b(\\d{1,2})\\s+${monthName}(?:\\s+(\\d{4}))?\\b`, 'gi'
    );
    let mMatch: RegExpExecArray | null;
    while ((mMatch = regex1.exec(lowerText)) !== null) {
      const dayNum = parseInt(mMatch[1], 10);
      const yearNum = mMatch[2] ? parseInt(mMatch[2], 10) : undefined;
      const monthIdx = parseMonthName(monthName);
      if (monthIdx === undefined) continue;

      const alreadyCaptured = results.some(r => {
        const rNorm = normalizeForMatching(r.deadline.rawText);
        const thisNorm = normalizeForMatching(text.slice(mMatch!.index, mMatch!.index + mMatch![0].length));
        return rNorm.includes(thisNorm);
      });
      if (alreadyCaptured) continue;

      // Skip if this is part of the header timestamp
      if (msg.timestamp?.raw) {
        const tsNorm = normalizeForMatching(msg.timestamp.raw);
        const matchNorm = normalizeForMatching(text.slice(mMatch.index, mMatch.index + mMatch[0].length));
        if (tsNorm.includes(matchNorm)) continue;
      }

      const rawText = text.slice(mMatch.index, mMatch.index + mMatch[0].length);
      const year = yearNum ?? (referenceIso ? new Date(referenceIso).getFullYear() : undefined);
      let resolvedIso: string | undefined;
      if (year) {
        resolvedIso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }

      results.push({
        deadline: {
          rawText,
          resolvedIso,
          resolution: resolvedIso ? 'absolute' : 'unresolved',
          origin: 'same-message',
        },
        messageId: msg.id,
        span: findSpanInText(text, rawText, mMatch.index),
      });
    }

    // "March 12" or "Mar 12" or "March 12, 2026"
    const regex2 = new RegExp(
      `\\b${monthName}\\s+(\\d{1,2})(?:[,\\s]+(\\d{4}))?\\b`, 'gi'
    );
    while ((mMatch = regex2.exec(lowerText)) !== null) {
      const dayNum = parseInt(mMatch[1], 10);
      const yearNum = mMatch[2] ? parseInt(mMatch[2], 10) : undefined;
      const monthIdx = parseMonthName(monthName);
      if (monthIdx === undefined) continue;

      const alreadyCaptured = results.some(r => {
        const rNorm = normalizeForMatching(r.deadline.rawText);
        const thisNorm = normalizeForMatching(text.slice(mMatch!.index, mMatch!.index + mMatch![0].length));
        return rNorm.includes(thisNorm);
      });
      if (alreadyCaptured) continue;

      const rawText = text.slice(mMatch.index, mMatch.index + mMatch[0].length);
      const year = yearNum ?? (referenceIso ? new Date(referenceIso).getFullYear() : undefined);
      let resolvedIso: string | undefined;
      if (year) {
        resolvedIso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      }

      results.push({
        deadline: {
          rawText,
          resolvedIso,
          resolution: resolvedIso ? 'absolute' : 'unresolved',
          origin: 'same-message',
        },
        messageId: msg.id,
        span: findSpanInText(text, rawText, mMatch.index),
      });
    }
  }

  return results;
}

function resolveDeadlineExpression(
  dateExpr: string,
  rawText: string,
  referenceIso: string | undefined,
  fieldOrder: DateFieldOrder = 'unknown',
): DeadlineInfo {
  const lower = dateExpr.toLowerCase().trim();

  // Check for relative expressions
  for (const rel of RELATIVE_DAY_EXPRESSIONS) {
    if (lower.startsWith(rel)) {
      const resolvedIso = resolveRelativeDate(rel, referenceIso);
      // Check for time component after the relative day
      const timeMatch = lower.slice(rel.length).trim().match(/^(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      let finalIso = resolvedIso;
      if (finalIso && timeMatch) {
        const t = parseSimpleTime(timeMatch[1]);
        if (t) {
          finalIso = finalIso.split('T')[0] +
            `T${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}:00`;
        }
      }
      return {
        rawText,
        resolvedIso: finalIso,
        resolution: finalIso ? 'relative-resolved' : 'unresolved',
        origin: 'same-message',
      };
    }
  }

  // Check for weekday names
  for (const day of WEEKDAY_NAMES) {
    if (lower.includes(day)) {
      const resolvedIso = resolveRelativeDate(day, referenceIso);
      return {
        rawText,
        resolvedIso,
        resolution: resolvedIso ? 'relative-resolved' : 'unresolved',
        origin: 'same-message',
      };
    }
  }

  // Check for named month ("12 Mar", "March 12")
  for (const monthName of MONTH_NAMES) {
    if (lower.includes(monthName)) {
      const monthIdx = parseMonthName(monthName);
      if (monthIdx === undefined) continue;
      const dayMatch = lower.match(/\d{1,2}/);
      if (!dayMatch) continue;
      const day = parseInt(dayMatch[0], 10);
      const year = referenceIso ? new Date(referenceIso).getFullYear() : undefined;
      if (year) {
        const iso = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { rawText, resolvedIso: iso, resolution: 'absolute', origin: 'same-message' };
      }
      return { rawText, resolution: 'unresolved', origin: 'same-message' };
    }
  }

  // Check for numeric date ("13/03", "13/03/2026")
  const dateMatch = lower.match(/(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/);
  if (dateMatch) {
    const first = parseInt(dateMatch[1], 10);
    const second = parseInt(dateMatch[2], 10);
    const yearStr = dateMatch[3];

    let day: number, month: number;
    if (first > 12 && second <= 12) {
      day = first; month = second;
    } else if (second > 12 && first <= 12) {
      month = first; day = second;
    } else if (fieldOrder === 'DD/MM') {
      day = first; month = second;
    } else if (fieldOrder === 'MM/DD') {
      month = first; day = second;
    } else {
      return { rawText, resolution: 'ambiguous', origin: 'same-message' };
    }

    let year: number | undefined;
    if (yearStr) {
      year = parseInt(yearStr, 10);
      if (year < 100) year = year <= 69 ? 2000 + year : 1900 + year;
    } else if (referenceIso) {
      year = new Date(referenceIso).getFullYear();
    }

    if (year) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { rawText, resolvedIso: iso, resolution: 'absolute', origin: 'same-message' };
    }
    return { rawText, resolution: 'unresolved', origin: 'same-message' };
  }

  // Check for time expressions
  for (const te of TIME_EXPRESSIONS) {
    if (lower.includes(te)) {
      const resolvedIso = resolveRelativeDate(te, referenceIso);
      return {
        rawText,
        resolvedIso,
        resolution: resolvedIso ? 'relative-resolved' : 'unresolved',
        origin: 'same-message',
      };
    }
  }

  return { rawText, resolution: 'unresolved', origin: 'same-message' };
}

function resolveStandaloneDate(
  dateStr: string,
  rawText: string,
  referenceIso: string | undefined,
  fieldOrder: DateFieldOrder = 'unknown',
): DeadlineInfo | null {
  const lower = dateStr.trim().toLowerCase();

  // Numeric date: "14/03 at 4pm" or "13/03"
  const dateMatch = lower.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?/);
  if (dateMatch) {
    const first = parseInt(dateMatch[1], 10);
    const second = parseInt(dateMatch[2], 10);
    const yearStr = dateMatch[3];

    let day: number, month: number;
    if (first > 12 && second <= 12) {
      day = first; month = second;
    } else if (second > 12 && first <= 12) {
      month = first; day = second;
    } else if (fieldOrder === 'DD/MM') {
      day = first; month = second;
    } else if (fieldOrder === 'MM/DD') {
      month = first; day = second;
    } else {
      return { rawText, resolution: 'ambiguous', origin: 'same-message' };
    }

    let year: number | undefined;
    if (yearStr) {
      year = parseInt(yearStr, 10);
      if (year < 100) year = year <= 69 ? 2000 + year : 1900 + year;
    } else if (referenceIso) {
      year = new Date(referenceIso).getFullYear();
    }

    // Check for "at <time>" suffix
    const timeMatch = lower.match(/at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    let resolvedIso: string | undefined;
    if (year) {
      resolvedIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (timeMatch) {
        const t = parseSimpleTime(timeMatch[1]);
        if (t) {
          resolvedIso += `T${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}:00`;
        }
      }
    }

    return {
      rawText,
      resolvedIso,
      resolution: resolvedIso ? 'absolute' : 'unresolved',
      origin: 'same-message',
    };
  }

  return null;
}

function parseSimpleTime(timeStr: string): { hours: number; minutes: number } | null {
  const lower = timeStr.trim().toLowerCase();

  // "5pm", "12am"
  const shortMatch = lower.match(/^(\d{1,2})\s*(am|pm)$/);
  if (shortMatch) {
    let h = parseInt(shortMatch[1], 10);
    if (shortMatch[2] === 'pm' && h < 12) h += 12;
    if (shortMatch[2] === 'am' && h === 12) h = 0;
    return { hours: h, minutes: 0 };
  }

  // "14:05", "2:05 PM"
  const fullMatch = lower.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (fullMatch) {
    let h = parseInt(fullMatch[1], 10);
    const m = parseInt(fullMatch[2], 10);
    if (fullMatch[3] === 'pm' && h < 12) h += 12;
    if (fullMatch[3] === 'am' && h === 12) h = 0;
    return { hours: h, minutes: m };
  }

  return null;
}

function buildDateExpressionPattern(): string {
  return '(?:' + [
    // Relative days (possibly with time)
    '(?:today|tomorrow|tonight)(?:\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)?',
    // Weekday names
    '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)',
    // Named months: "12 Mar", "March 12"
    '(?:\\d{1,2}\\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\\s+\\d{4})?)',
    '(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+\\d{1,2}(?:[,\\s]+\\d{4})?)',
    // Numeric dates: "13/03", "13/03/2026"
    '(?:\\d{1,2}[/.]\\d{1,2}(?:[/.]\\d{2,4})?)',
    // Time expressions
    '(?:eod|end\\s+of\\s+day|end\\s+of\\s+business)',
  ].join('|') + ')';
}

function findSpanInText(text: string, target: string, _hint: number): TextSpan {
  // Find the target in the original text (case-insensitive)
  const idx = text.toLowerCase().indexOf(target.toLowerCase());
  if (idx >= 0) {
    return { start: idx, end: idx + target.length };
  }
  // Fallback to hint position
  return { start: Math.max(0, _hint), end: Math.min(text.length, _hint + target.length) };
}
