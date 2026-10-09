/**
 * Mention detection per PRD §FR-014.
 *
 * Matching rules:
 * - Case-insensitive, whole-token matching using word boundaries.
 * - @name matches.
 * - Possessive "Priya's" matches "Priya".
 * - No fuzzy matching in MVP.
 * - Sender lines are "authored by you", not mentions.
 * - "Ann" must not match "Annual", "Channel".
 * - "Sam" must not match "Samsung", "Samuel" unless configured.
 *
 * Limitations:
 * Nicknames, pronouns, and misspellings are not detected.
 */

import { ParsedMessage, Mention, TextSpan } from '../../types/model';
import { normalizeForMatching } from '../normalize';

export interface MentionResult {
  mentions: Mention[];
  ambiguousParticipants: string[];
}

/**
 * Detect mentions of the configured user in messages.
 */
export function detectMentions(
  messages: ParsedMessage[],
  userName: string,
  userAliases: string[],
  participants: string[],
): MentionResult {
  const allMentions: Mention[] = [];

  if (!userName.trim()) {
    return { mentions: allMentions, ambiguousParticipants: [] };
  }

  // Build names to search for
  const searchNames = buildSearchNames(userName, userAliases);

  // Detect ambiguity: multiple participants sharing first token with user name
  const ambiguousParticipants = detectAmbiguousParticipants(userName, participants);

  for (const msg of messages) {
    if (msg.parsingStatus === 'system' || msg.isDuplicateOf) continue;

    // Skip messages authored by the user (not a mention)
    if (msg.sender && isUserSender(msg.sender, userName, userAliases)) {
      continue;
    }

    const msgMentions = findMentionsInText(msg, searchNames, ambiguousParticipants.length > 0);
    allMentions.push(...msgMentions);

    // Also update the message's mentions array
    msg.mentions = msgMentions;
  }

  return { mentions: allMentions, ambiguousParticipants };
}

interface SearchName {
  original: string;
  normalized: string;
  kind: 'name' | 'alias';
}

function buildSearchNames(userName: string, aliases: string[]): SearchName[] {
  const names: SearchName[] = [];

  if (userName.trim()) {
    names.push({
      original: userName.trim(),
      normalized: normalizeForMatching(userName),
      kind: 'name',
    });
  }

  for (const alias of aliases) {
    if (alias.trim()) {
      names.push({
        original: alias.trim(),
        normalized: normalizeForMatching(alias),
        kind: 'alias',
      });
    }
  }

  return names;
}

function findMentionsInText(
  msg: ParsedMessage,
  searchNames: SearchName[],
  isAmbiguous: boolean,
): Mention[] {
  const mentions: Mention[] = [];
  const text = msg.text;
  const lowerText = text.toLowerCase();

  for (const searchName of searchNames) {
    // Check for @name pattern
    const atRegex = new RegExp(
      `@${escapeRegex(searchName.normalized)}(?:\\b|$)`,
      'gi'
    );
    let match: RegExpExecArray | null;
    while ((match = atRegex.exec(lowerText)) !== null) {
      const span = findMentionSpan(text, match.index, match[0].length);
      mentions.push({
        messageId: msg.id,
        matchedText: text.slice(span.start, span.end),
        span,
        kind: 'at-handle',
        ambiguous: isAmbiguous,
      });
    }

    // Check for whole-word name match (with possessive support)
    // Word boundary: must not be preceded or followed by a letter/digit
    // (avoids "Ann" matching "Annual", "Channel")
    const nameRegex = new RegExp(
      `(?:^|[^\\w])${escapeRegex(searchName.normalized)}(?:'s)?(?=[^\\w]|$)`,
      'gi'
    );
    while ((match = nameRegex.exec(lowerText)) !== null) {
      // Adjust for the possible non-word prefix character
      let startIdx = match.index;
      if (startIdx < lowerText.length && !/\w/.test(lowerText[startIdx])) {
        startIdx++;
      }

      // Skip if this is an @-mention (already captured)
      if (startIdx > 0 && text[startIdx - 1] === '@') continue;

      const matchedLength = match[0].length - (startIdx - match.index);
      const span = findMentionSpan(text, startIdx, matchedLength);

      // Verify it's actually a word boundary match (double check)
      if (!isWholeWordMatch(text, span.start, span.end)) continue;

      mentions.push({
        messageId: msg.id,
        matchedText: text.slice(span.start, span.end),
        span,
        kind: searchName.kind,
        ambiguous: isAmbiguous,
      });
    }
  }

  return mentions;
}

/**
 * Verify that the match at [start, end) is a whole-word match.
 * Prevents "Ann" from matching within "Annual", "Joanna", "Anna", "Channel".
 */
function isWholeWordMatch(text: string, start: number, end: number): boolean {
  // Check character before start
  if (start > 0) {
    const charBefore = text[start - 1];
    if (/\w/.test(charBefore)) return false;
  }

  // Check character after end (accounting for possessive)
  let checkEnd = end;
  if (text.slice(end, end + 2) === "'s") {
    checkEnd = end + 2;
  }
  if (checkEnd < text.length) {
    const charAfter = text[checkEnd];
    if (/\w/.test(charAfter)) return false;
  }

  return true;
}

function findMentionSpan(text: string, index: number, length: number): TextSpan {
  return {
    start: index,
    end: Math.min(text.length, index + length),
  };
}

/**
 * Check if a sender name matches the user identity.
 */
function isUserSender(sender: string, userName: string, aliases: string[]): boolean {
  const senderNorm = normalizeForMatching(sender);
  if (senderNorm === normalizeForMatching(userName)) return true;
  return aliases.some(a => normalizeForMatching(a) === senderNorm);
}

/**
 * Detect if multiple participants share the first name token with the user.
 */
function detectAmbiguousParticipants(
  userName: string,
  participants: string[],
): string[] {
  const userFirstToken = normalizeForMatching(userName).split(/\s+/)[0];
  if (!userFirstToken) return [];

  const matching = participants.filter(p => {
    const pFirst = normalizeForMatching(p).split(/\s+/)[0];
    return pFirst === userFirstToken && normalizeForMatching(p) !== normalizeForMatching(userName);
  });

  return matching;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
