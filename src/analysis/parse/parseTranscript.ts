/**
 * Main transcript parser — converts raw text into Conversation.
 * Per PRD §FR-007, §FR-008, §17.3.
 *
 * Pipeline: split lines → detect format → parse headers → merge multiline →
 * parse timestamps → deduplicate → build Conversation.
 *
 * Duplicate detection: exact consecutive messages (same sender, same timestamp,
 * same normalized text) are flagged isDuplicateOf. Also checks within a
 * DUPLICATE_WINDOW of 5 messages. Only for analysis — duplicates remain in the
 * message list.
 */

import {
  ParsedMessage,
  Conversation,
  ParsedTimestamp,
  ParsingStatus,
  MessageId,
} from '../../types/model';
import { matchHeader, detectFormat, HeaderMatch } from './headers';
import { parseTimestamp, inferDateFieldOrder, DateFieldOrder } from './timestamps';
import { normalizeForMatching } from '../normalize';
import { DUPLICATE_WINDOW, MAX_LINE_LENGTH } from '../../config/limits';

export interface ParseResult {
  conversation: Conversation;
  warnings: string[];
  dateFieldOrder: DateFieldOrder;
}

/**
 * Parse a raw transcript string into a Conversation.
 * This is the main entry point for transcript parsing.
 */
export function parseTranscript(rawText: string, isSample: boolean = false): ParseResult {
  const warnings: string[] = [];
  const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const totalLines = rawLines.length;
  const nonEmptyLines = rawLines.filter(l => l.trim().length > 0).length;

  // Step 1: Per-line length cap with warning
  const lines = rawLines.map((line, _i) => {
    if (line.length > MAX_LINE_LENGTH) {
      warnings.push(`Line exceeds ${MAX_LINE_LENGTH} characters and was truncated for analysis.`);
      return line.slice(0, MAX_LINE_LENGTH);
    }
    return line;
  });

  // Step 2: Match headers on all lines
  const headerMatches: { lineIndex: number; match: HeaderMatch }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.length === 0) continue;
    const match = matchHeader(trimmed);
    if (match) {
      headerMatches.push({ lineIndex: i, match });
    }
  }

  // Step 3: Format detection
  const detectedFormat = detectFormat(headerMatches.map(h => h.match));

  // Step 4: Infer date field order from entire transcript text (per PRD §17.3)
  const dateFieldOrder = inferDateFieldOrder(rawText);

  // Step 5: Build messages with multiline continuation
  const messages: ParsedMessage[] = [];
  let unrecognizedLines = 0;
  let messageIndex = 0;

  // Track which lines are header starts
  const headerLineIndices = new Set(headerMatches.map(h => h.lineIndex));

  // If no headers found, handle as unrecognized
  if (headerMatches.length === 0) {
    // Treat each non-empty line as an unattributed message
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].trim();
      if (text.length === 0) continue;
      unrecognizedLines++;
    }
    return {
      conversation: {
        messages: [],
        participants: [],
        stats: {
          totalLines,
          nonEmptyLines,
          messageCount: 0,
          unrecognizedLines: nonEmptyLines,
          formatDetected: 'none',
        },
        isSample,
      },
      warnings: warnings.length > 0 ? warnings : ['No messages were recognized in the transcript.'],
      dateFieldOrder: 'unknown',
    };
  }

  // Process header matches and their continuations
  for (let hi = 0; hi < headerMatches.length; hi++) {
    const { lineIndex, match: header } = headerMatches[hi];
    const nextHeaderLine = hi + 1 < headerMatches.length
      ? headerMatches[hi + 1].lineIndex
      : lines.length;

    // Collect continuation lines (lines between this header and the next)
    const continuationTexts: string[] = [];
    for (let ci = lineIndex + 1; ci < nextHeaderLine; ci++) {
      const continuationLine = lines[ci];
      if (continuationLine.trim().length === 0) continue;
      if (headerLineIndices.has(ci)) break; // Should not happen with proper iteration
      continuationTexts.push(continuationLine);
    }

    // Build message text: header text + continuation lines
    let fullText = header.text;
    if (continuationTexts.length > 0) {
      fullText = fullText + '\n' + continuationTexts.join('\n');
    }

    // Parse timestamp if present
    let timestamp: ParsedTimestamp | undefined;
    let parsingStatus: ParsingStatus;

    if (header.isSystem) {
      parsingStatus = 'system';
    } else if (header.rawTimestamp) {
      timestamp = parseTimestamp(header.rawTimestamp, dateFieldOrder);
      parsingStatus = 'parsed';
    } else {
      parsingStatus = 'no-timestamp';
    }

    const lineEnd = lineIndex + 1 + continuationTexts.length;

    const msg: ParsedMessage = {
      id: `m-${messageIndex}` as MessageId,
      sourceIndex: messageIndex,
      lineStart: lineIndex + 1, // 1-based
      lineEnd: lineEnd,         // 1-based
      sender: header.sender,
      timestamp,
      text: fullText,
      parsingStatus,
      mentions: [],
    };

    messages.push(msg);
    messageIndex++;
  }

  // Count truly unrecognized lines: non-empty lines before the first header
  // that aren't continuation lines
  for (let i = 0; i < (headerMatches[0]?.lineIndex ?? lines.length); i++) {
    if (lines[i].trim().length > 0 && !headerLineIndices.has(i)) {
      unrecognizedLines++;
    }
  }

  // Step 6: Deduplicate (same sender, same timestamp, same normalized text)
  deduplicateMessages(messages);

  // Step 7: Extract participants
  const participantSet = new Set<string>();
  for (const msg of messages) {
    if (msg.sender && msg.parsingStatus !== 'system') {
      participantSet.add(msg.sender);
    }
  }
  const participants = Array.from(participantSet);

  // Step 8: Compute first/last timestamp
  let firstTimestampIso: string | undefined;
  let lastTimestampIso: string | undefined;
  for (const msg of messages) {
    if (msg.timestamp?.iso) {
      if (!firstTimestampIso) firstTimestampIso = msg.timestamp.iso;
      lastTimestampIso = msg.timestamp.iso;
    }
  }

  const conversation: Conversation = {
    messages,
    participants,
    stats: {
      totalLines,
      nonEmptyLines,
      messageCount: messages.length,
      unrecognizedLines,
      formatDetected: detectedFormat,
      firstTimestampIso,
      lastTimestampIso,
    },
    isSample,
  };

  return { conversation, warnings, dateFieldOrder };
}

/**
 * Flag exact duplicate consecutive messages.
 * Per PRD §FR-008: same sender, timestamp, normalized text.
 * Check within DUPLICATE_WINDOW.
 */
function deduplicateMessages(messages: ParsedMessage[]): void {
  for (let i = 1; i < messages.length; i++) {
    const current = messages[i];
    if (current.parsingStatus === 'system') continue;

    const windowStart = Math.max(0, i - DUPLICATE_WINDOW);
    for (let j = i - 1; j >= windowStart; j--) {
      const prev = messages[j];
      if (prev.isDuplicateOf) continue;
      if (prev.parsingStatus === 'system') continue;

      if (
        current.sender === prev.sender &&
        timestampsEqual(current.timestamp, prev.timestamp) &&
        normalizeForMatching(current.text) === normalizeForMatching(prev.text)
      ) {
        current.isDuplicateOf = prev.id;
        break;
      }
    }
  }
}

function timestampsEqual(a?: ParsedTimestamp, b?: ParsedTimestamp): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.raw === b.raw;
}

/**
 * Create unattributed messages from plain text (unsupported format fallback).
 * Per PRD §FR-004: each non-empty line becomes a message with sender "Unknown".
 */
export function parseAsPlainText(rawText: string, isSample: boolean = false): ParseResult {
  const rawLines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const totalLines = rawLines.length;
  const nonEmptyLines = rawLines.filter(l => l.trim().length > 0).length;
  const messages: ParsedMessage[] = [];
  let messageIndex = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i].trim();
    if (text.length === 0) continue;

    messages.push({
      id: `m-${messageIndex}`,
      sourceIndex: messageIndex,
      lineStart: i + 1,
      lineEnd: i + 1,
      sender: 'Unknown',
      text,
      parsingStatus: 'unattributed',
      mentions: [],
    });
    messageIndex++;
  }

  return {
    conversation: {
      messages,
      participants: messages.length > 0 ? ['Unknown'] : [],
      stats: {
        totalLines,
        nonEmptyLines,
        messageCount: messages.length,
        unrecognizedLines: 0,
        formatDetected: 'none',
      },
      isSample,
    },
    warnings: ['Results are limited because the transcript format was not recognized.'],
    dateFieldOrder: 'unknown',
  };
}
