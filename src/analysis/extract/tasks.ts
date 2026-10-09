/**
 * Task / action item extraction per PRD §FR-012, §17.4.
 *
 * Types: assigned-to-user, assigned-to-other, commitment, unassigned-request, inferred.
 * Supports negation/cancellation detection (R-TSK-N1).
 * Does not invent assignees or deadlines.
 */

import {
  ParsedMessage,
  ActionItem,
  ActionKind,
  DeadlineInfo,
  SourceRef,
  Uncertainty,
  PriorityReason,
} from '../../types/model';
import { normalizeForMatching } from '../normalize';
import { DeadlineCandidate } from './dates';
import {
  TASK_VERBS,
  NEGATION_MARKERS,
  COMMITMENT_PHRASES,
  UNASSIGNED_REQUEST_PHRASES,
  EXPLICIT_TASK_MARKERS,
  STOP_WORDS,
} from '../../config/patterns';
import { MAX_EXCERPT_LENGTH, CANCELLATION_WINDOW } from '../../config/limits';

/**
 * Extract action items from parsed messages.
 */
export function extractTasks(
  messages: ParsedMessage[],
  deadlineCandidates: DeadlineCandidate[],
  userName: string,
  userAliases: string[],
  participants: string[],
): ActionItem[] {
  const items: ActionItem[] = [];
  let actionIndex = 0;

  // Build a map of deadlines by messageId for quick lookup
  const deadlinesByMessage = new Map<string, DeadlineCandidate[]>();
  for (const dc of deadlineCandidates) {
    const existing = deadlinesByMessage.get(dc.messageId) ?? [];
    existing.push(dc);
    deadlinesByMessage.set(dc.messageId, existing);
  }

  // Build normalized user identity for matching
  const userNames = buildUserNames(userName, userAliases);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.parsingStatus === 'system' || msg.isDuplicateOf) continue;

    const normalizedText = normalizeForMatching(msg.text);
    const sentences = splitSentences(msg.text);

    // Check for negation in the full message first
    const hasMessageNegation = hasNegation(normalizedText);

    for (const sentence of sentences) {
      const normalizedSentence = normalizeForMatching(sentence.text);

      // Check if sentence is in question form (R-TSK-N2)
      const isQuestion = sentence.text.trim().endsWith('?');

      // Skip hypotheticals (R-TSK-N3)
      if (isHypothetical(normalizedSentence)) continue;

      // Check for sentence-level negation (R-TSK-N1)
      const sentenceNegated = hasNegation(normalizedSentence);

      // R-TSK-06: Explicit task markers (not for question sentences)
      if (!isQuestion) {
        const explicitMatch = matchExplicitTask(normalizedSentence, sentence.text);
        if (explicitMatch) {
          const deadline = findDeadlineForMessage(msg.id, deadlinesByMessage);
          const assigneeFromText = findAssigneeInText(normalizedSentence, participants, userNames);
          const kind = determineKind(assigneeFromText, msg.sender, userNames);

          items.push(createAction(
            actionIndex++,
            kind,
            truncateExcerpt(sentence.text),
            assigneeFromText,
            deadline,
            msg,
            sentence,
            sentenceNegated || hasMessageNegation ? 'possibly-cancelled' : 'open',
            'high',
            [{ ruleId: 'R-TSK-06', label: 'Explicit task marker' }],
            sentenceNegated,
          ));
          continue;
        }
      }

      // R-TSK-01/02: Named assignment patterns (can be request questions e.g. "Name, can you verb...?")
      const assignmentMatch = matchAssignment(
        normalizedSentence, sentence.text, participants, userNames, msg.sender
      );
      if (assignmentMatch) {
        const deadline = findDeadlineForMessage(msg.id, deadlinesByMessage);
        const kind = determineKind(assignmentMatch.assignee, msg.sender, userNames);

        items.push(createAction(
          actionIndex++,
          kind,
          truncateExcerpt(sentence.text),
          assignmentMatch.assignee,
          deadline,
          msg,
          sentence,
          sentenceNegated || hasMessageNegation ? 'possibly-cancelled' : 'open',
          'high',
          [{ ruleId: assignmentMatch.ruleId, label: assignmentMatch.label }],
          sentenceNegated,
        ));
        continue;
      }

      // R-TSK-05: Unassigned requests (can be request questions e.g. "Can someone verb...?")
      const unassignedMatch = matchUnassignedRequest(normalizedSentence);
      if (unassignedMatch) {
        const deadline = findDeadlineForMessage(msg.id, deadlinesByMessage);

        items.push(createAction(
          actionIndex++,
          'unassigned-request',
          truncateExcerpt(sentence.text),
          undefined,
          deadline,
          msg,
          sentence,
          sentenceNegated || hasMessageNegation ? 'possibly-cancelled' : 'open',
          'medium',
          [{ ruleId: 'R-TSK-05', label: 'Unassigned request' }],
          sentenceNegated,
        ));
        continue;
      }

      // If it's a question and didn't match assignment or unassigned request, exclude per R-TSK-N2
      if (isQuestion) continue;

      // R-TSK-03: First-person commitments
      const commitmentMatch = matchCommitment(normalizedSentence);
      if (commitmentMatch && msg.sender) {
        const deadline = findDeadlineForMessage(msg.id, deadlinesByMessage);

        items.push(createAction(
          actionIndex++,
          'commitment',
          truncateExcerpt(sentence.text),
          msg.sender,
          deadline,
          msg,
          sentence,
          sentenceNegated || hasMessageNegation ? 'possibly-cancelled' : 'open',
          'high',
          [{ ruleId: 'R-TSK-03', label: 'First-person commitment' }],
          sentenceNegated,
        ));
        continue;
      }

      // R-TSK-04: Third-person assignment ("Name will/is going to...")
      const thirdPersonMatch = matchThirdPersonAssignment(
        normalizedSentence, participants
      );
      if (thirdPersonMatch) {
        const deadline = findDeadlineForMessage(msg.id, deadlinesByMessage);
        const kind = determineKind(thirdPersonMatch, msg.sender, userNames);

        items.push(createAction(
          actionIndex++,
          kind,
          truncateExcerpt(sentence.text),
          thirdPersonMatch,
          deadline,
          msg,
          sentence,
          sentenceNegated || hasMessageNegation ? 'possibly-cancelled' : 'open',
          'medium',
          [{ ruleId: 'R-TSK-04', label: 'Third-person assignment' }],
          sentenceNegated,
        ));
        continue;
      }

      // R-TSK-07: Imperative sentences addressed to group
      if (isImperativeToGroup(normalizedSentence)) {
        const deadline = findDeadlineForMessage(msg.id, deadlinesByMessage);

        items.push(createAction(
          actionIndex++,
          'unassigned-request',
          truncateExcerpt(sentence.text),
          undefined,
          deadline,
          msg,
          sentence,
          sentenceNegated || hasMessageNegation ? 'possibly-cancelled' : 'open',
          'medium',
          [{ ruleId: 'R-TSK-07', label: 'Imperative to group' }],
          sentenceNegated,
        ));
        continue;
      }

      // R-TSK-08: Weak signals (verb allow-list + deadline, no actor)
      const weakDeadline = findDeadlineForMessage(msg.id, deadlinesByMessage);
      if (weakDeadline && hasTaskVerb(normalizedSentence)) {
        items.push(createAction(
          actionIndex++,
          'inferred',
          truncateExcerpt(sentence.text),
          undefined,
          weakDeadline,
          msg,
          sentence,
          sentenceNegated || hasMessageNegation ? 'possibly-cancelled' : 'open',
          'low',
          [{ ruleId: 'R-TSK-08', label: 'Action verb with deadline' }],
          sentenceNegated,
        ));
      }
    }
  }

  // Post-processing: check for later cancellation messages (R-TSK-N1 cross-message)
  applyCrossMessageCancellation(items, messages);

  return items;
}

// ─── Helper Functions ────────────────────────────────────────────────

interface SentenceInfo {
  text: string;
  startOffset: number;
}

function splitSentences(text: string): SentenceInfo[] {
  const results: SentenceInfo[] = [];
  // Split on sentence boundaries: . ! ? and newline
  const parts = text.split(/(?<=[.!?\n])\s*/);
  let offset = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length > 0) {
      const idx = text.indexOf(trimmed, offset);
      results.push({ text: trimmed, startOffset: idx >= 0 ? idx : offset });
      offset = (idx >= 0 ? idx : offset) + trimmed.length;
    }
  }
  if (results.length === 0 && text.trim().length > 0) {
    results.push({ text: text.trim(), startOffset: 0 });
  }
  return results;
}

function hasNegation(normalizedText: string): boolean {
  return NEGATION_MARKERS.some(marker => normalizedText.includes(marker));
}

function isHypothetical(normalizedText: string): boolean {
  return /^if\s+(?:we|you|they|i)\s+/i.test(normalizedText) ||
    normalizedText.startsWith('if we need to') ||
    normalizedText.startsWith('if we have to');
}

function matchExplicitTask(normalized: string, _original: string): boolean {
  return EXPLICIT_TASK_MARKERS.some(marker => normalized.includes(marker));
}

interface AssignmentMatch {
  assignee: string;
  ruleId: string;
  label: string;
}

function matchAssignment(
  normalized: string,
  original: string,
  participants: string[],
  userNames: string[],
  _sender: string | null,
): AssignmentMatch | null {
  // R-TSK-02: @Name verb
  const atMatch = normalized.match(/^@(\w+)\s+/);
  if (atMatch) {
    const name = findParticipantMatch(atMatch[1], participants, userNames);
    if (name && hasTaskVerb(normalized)) {
      return { assignee: name, ruleId: 'R-TSK-02', label: 'Direct @-mention assignment' };
    }
  }

  // R-TSK-01: Name, (please|pls|can you|could you|will you) verb
  for (const participant of [...participants, ...userNames]) {
    const nameNorm = normalizeForMatching(participant);
    if (nameNorm.length < 2) continue;

    // "Name, please verb" or "Name please verb" or "Name, verb"
    const patterns = [
      new RegExp(`^${escapeRegex(nameNorm)}[,:]?\\s+(?:please|pls|can you|could you|will you)\\s+`, 'i'),
      new RegExp(`^${escapeRegex(nameNorm)}[,:]\\s+`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(normalized) && hasTaskVerb(normalized)) {
        // Find the actual name (case-preserved) from original text
        const actualName = findOriginalName(original, participant, participants, userNames);
        return {
          assignee: actualName || participant,
          ruleId: 'R-TSK-01',
          label: `Assigned to ${actualName || participant}`,
        };
      }
    }
  }

  return null;
}

function matchCommitment(normalized: string): boolean {
  return COMMITMENT_PHRASES.some(phrase => normalized.includes(phrase));
}

function matchThirdPersonAssignment(
  normalized: string,
  participants: string[],
): string | null {
  for (const participant of participants) {
    const nameNorm = normalizeForMatching(participant);
    if (nameNorm.length < 2) continue;

    const patterns = [
      new RegExp(`${escapeRegex(nameNorm)}\\s+(?:will|is going to|to)\\s+`, 'i'),
    ];

    for (const pattern of patterns) {
      if (pattern.test(normalized) && hasTaskVerb(normalized)) {
        return participant;
      }
    }
  }
  return null;
}

function matchUnassignedRequest(normalized: string): boolean {
  return UNASSIGNED_REQUEST_PHRASES.some(phrase => normalized.includes(phrase)) && hasTaskVerb(normalized);
}

function isImperativeToGroup(normalized: string): boolean {
  if (!normalized.startsWith('everyone ')) return false;
  return hasTaskVerb(normalized);
}

function hasTaskVerb(normalized: string): boolean {
  return TASK_VERBS.some(verb =>
    normalized.includes(` ${verb} `) ||
    normalized.includes(` ${verb}`) ||
    normalized.startsWith(`${verb} `)
  );
}

function buildUserNames(userName: string, aliases: string[]): string[] {
  const names: string[] = [];
  if (userName.trim()) names.push(userName.trim());
  for (const alias of aliases) {
    if (alias.trim()) names.push(alias.trim());
  }
  return names;
}

function determineKind(
  assignee: string | undefined,
  sender: string | null,
  userNames: string[],
): ActionKind {
  if (!assignee) return 'unassigned-request';

  const normalizedAssignee = normalizeForMatching(assignee);

  // Check if assignee is the user
  for (const name of userNames) {
    if (normalizeForMatching(name) === normalizedAssignee) {
      return 'assigned-to-user';
    }
  }

  // Check if it's a self-commitment (sender === assignee)
  if (sender && normalizeForMatching(sender) === normalizedAssignee) {
    return 'commitment';
  }

  return 'assigned-to-other';
}

function findAssigneeInText(
  normalized: string,
  participants: string[],
  userNames: string[],
): string | undefined {
  for (const name of [...userNames, ...participants]) {
    const nameNorm = normalizeForMatching(name);
    if (nameNorm.length < 2) continue;
    // Whole-word match
    const regex = new RegExp(`\\b${escapeRegex(nameNorm)}\\b`, 'i');
    if (regex.test(normalized)) {
      return name;
    }
  }
  return undefined;
}

function findParticipantMatch(
  name: string,
  participants: string[],
  userNames: string[],
): string | null {
  const lower = name.toLowerCase();
  for (const p of [...userNames, ...participants]) {
    if (p.toLowerCase() === lower || p.toLowerCase().startsWith(lower)) {
      return p;
    }
  }
  return null;
}

function findOriginalName(
  original: string,
  target: string,
  participants: string[],
  userNames: string[],
): string | null {
  const allNames = [...userNames, ...participants];
  for (const name of allNames) {
    if (normalizeForMatching(name) === normalizeForMatching(target)) {
      // Find it in original text
      const idx = original.toLowerCase().indexOf(name.toLowerCase());
      if (idx >= 0) {
        return original.slice(idx, idx + name.length);
      }
      return name;
    }
  }
  return null;
}

function findDeadlineForMessage(
  messageId: string,
  deadlinesByMessage: Map<string, DeadlineCandidate[]>,
): DeadlineInfo | undefined {
  const candidates = deadlinesByMessage.get(messageId);
  if (!candidates || candidates.length === 0) return undefined;
  // Use the first (most prominent) deadline
  return candidates[0].deadline;
}

function truncateExcerpt(text: string): string {
  const cleaned = text.replace(/\n/g, ' ').trim();
  if (cleaned.length <= MAX_EXCERPT_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_EXCERPT_LENGTH - 3) + '...';
}

function createAction(
  index: number,
  kind: ActionKind,
  description: string,
  assignee: string | undefined,
  deadline: DeadlineInfo | undefined,
  msg: ParsedMessage,
  sentence: SentenceInfo,
  status: 'open' | 'possibly-cancelled',
  confidence: 'high' | 'medium' | 'low',
  reasons: PriorityReason[],
  negated: boolean,
): ActionItem {
  const uncertainty: Uncertainty = {
    level: negated ? 'low' : confidence,
    notes: negated ? ['Negation detected in message — task may be cancelled'] : [],
  };

  const span = {
    start: sentence.startOffset,
    end: Math.min(msg.text.length, sentence.startOffset + sentence.text.length),
  };

  const sources: SourceRef[] = [{
    messageId: msg.id,
    span,
  }];

  return {
    id: `a-${index}`,
    kind,
    description,
    assignee,
    deadline,
    category: 'medium', // Will be set by prioritizer
    basis: 'inferred',
    reasons,
    sources,
    status,
    uncertainty,
  };
}

/**
 * Cross-message cancellation detection (R-TSK-N1).
 * Look for later messages that contain negation markers and share content tokens
 * with existing tasks.
 */
function applyCrossMessageCancellation(
  items: ActionItem[],
  messages: ParsedMessage[],
): void {
  for (const item of items) {
    if (item.status === 'possibly-cancelled') continue; // Already cancelled

    const sourceIdx = parseInt(item.sources[0].messageId.replace('m-', ''), 10);
    const itemTokens = extractContentTokens(item.description);

    // Look ahead within CANCELLATION_WINDOW
    const endIdx = Math.min(messages.length, sourceIdx + CANCELLATION_WINDOW + 1);
    for (let i = sourceIdx + 1; i < endIdx; i++) {
      const msg = messages[i];
      if (msg.parsingStatus === 'system' || msg.isDuplicateOf) continue;

      const normalized = normalizeForMatching(msg.text);
      if (hasNegation(normalized)) {
        const msgTokens = extractContentTokens(normalized);
        const sharedTokens = itemTokens.filter(t => msgTokens.includes(t));
        if (sharedTokens.length >= 1) {
          item.status = 'possibly-cancelled';
          item.uncertainty = {
            level: 'low',
            notes: ['Possibly cancelled in a later message'],
          };
          break;
        }
      }
    }
  }
}

function extractContentTokens(text: string): string[] {
  return normalizeForMatching(text)
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
