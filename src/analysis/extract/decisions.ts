/**
 * Decision extraction per PRD §FR-015, §17.4.
 *
 * Classifies decision-related messages:
 * - confirmed: explicit commit phrases or proposal + affirmation
 * - proposal: suggestion phrasing without confirmation
 * - suggestion: "should", "could", "maybe" — never confirmed alone
 * - question: ends with ? and decision vocabulary
 * - disagreement: proposal + objection without resolution
 *
 * Supports supersession via topic key overlap.
 */

import {
  ParsedMessage,
  Decision,
  DecisionStatus,
  SourceRef,
  Uncertainty,
} from '../../types/model';
import { normalizeForMatching } from '../normalize';
import {
  CONFIRMED_DECISION_PHRASES,
  PROPOSAL_PHRASES,
  SUGGESTION_PHRASES,
  AFFIRMATION_PHRASES,
  OBJECTION_PHRASES,
  STOP_WORDS,
} from '../../config/patterns';
import { DECISION_WINDOW, MAX_EXCERPT_LENGTH } from '../../config/limits';

/**
 * Extract decisions from parsed messages.
 */
export function extractDecisions(messages: ParsedMessage[]): Decision[] {
  const candidates: DecisionCandidate[] = [];
  let decisionIndex = 0;

  // First pass: identify all decision-related messages
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.parsingStatus === 'system' || msg.isDuplicateOf) continue;

    const normalized = normalizeForMatching(msg.text);

    // R-DEC-01: Confirmed decision phrases
    if (matchesAny(normalized, CONFIRMED_DECISION_PHRASES)) {
      candidates.push({
        index: decisionIndex++,
        status: 'confirmed',
        summary: truncateExcerpt(msg.text),
        sources: [{ messageId: msg.id }],
        messageIndex: i,
        uncertainty: { level: 'high', notes: [] },
        topicTokens: extractTopicTokens(msg.text),
        ruleId: 'R-DEC-01',
      });
      continue;
    }

    // R-DEC-05: Decision question (ends with ? + decision vocabulary)
    if (msg.text.trim().endsWith('?') && hasDecisionVocab(normalized)) {
      candidates.push({
        index: decisionIndex++,
        status: 'question',
        summary: truncateExcerpt(msg.text),
        sources: [{ messageId: msg.id }],
        messageIndex: i,
        uncertainty: { level: 'medium', notes: [] },
        topicTokens: extractTopicTokens(msg.text),
        ruleId: 'R-DEC-05',
      });
      continue;
    }

    // R-DEC-03: Proposal phrases
    if (matchesAny(normalized, PROPOSAL_PHRASES)) {
      candidates.push({
        index: decisionIndex++,
        status: 'proposal',
        summary: truncateExcerpt(msg.text),
        sources: [{ messageId: msg.id }],
        messageIndex: i,
        uncertainty: { level: 'medium', notes: [] },
        topicTokens: extractTopicTokens(msg.text),
        ruleId: 'R-DEC-03',
      });
      continue;
    }

    // R-DEC-04: Suggestion phrases
    if (matchesAny(normalized, SUGGESTION_PHRASES)) {
      candidates.push({
        index: decisionIndex++,
        status: 'suggestion',
        summary: truncateExcerpt(msg.text),
        sources: [{ messageId: msg.id }],
        messageIndex: i,
        uncertainty: { level: 'medium', notes: [] },
        topicTokens: extractTopicTokens(msg.text),
        ruleId: 'R-DEC-04',
      });
      continue;
    }
  }

  // Second pass: check proposals for affirmation/objection (R-DEC-02, R-DEC-06)
  for (const candidate of candidates) {
    if (candidate.status !== 'proposal') continue;

    const proposalMsg = messages[candidate.messageIndex];
    const endIdx = Math.min(messages.length, candidate.messageIndex + DECISION_WINDOW + 1);

    let hasAffirmation = false;
    let hasObjection = false;
    let affirmationMsg: ParsedMessage | null = null;
    let objectionMsg: ParsedMessage | null = null;

    for (let j = candidate.messageIndex + 1; j < endIdx; j++) {
      const reply = messages[j];
      if (reply.parsingStatus === 'system' || reply.isDuplicateOf) continue;
      // Must be from a different sender
      if (reply.sender === proposalMsg.sender) continue;

      const replyNorm = normalizeForMatching(reply.text);

      if (!hasAffirmation && matchesAny(replyNorm, AFFIRMATION_PHRASES)) {
        hasAffirmation = true;
        affirmationMsg = reply;
      }

      if (!hasObjection && matchesAny(replyNorm, OBJECTION_PHRASES)) {
        hasObjection = true;
        objectionMsg = reply;
      }
    }

    if (hasAffirmation && !hasObjection && affirmationMsg) {
      // R-DEC-02: Proposal + affirmation = confirmed
      candidate.status = 'confirmed';
      candidate.sources.push({ messageId: affirmationMsg.id });
      candidate.uncertainty = { level: 'high', notes: [] };
      candidate.ruleId = 'R-DEC-02';
    } else if (hasObjection && !hasAffirmation && objectionMsg) {
      // R-DEC-06: Proposal + objection = disagreement
      candidate.status = 'disagreement';
      candidate.sources.push({ messageId: objectionMsg.id });
      candidate.uncertainty = { level: 'medium', notes: ['Objection received without resolution'] };
      candidate.ruleId = 'R-DEC-06';
    } else if (hasObjection && hasAffirmation) {
      // Mixed signals — keep as proposal with note
      candidate.uncertainty = {
        level: 'low',
        notes: ['Both agreement and disagreement found — status uncertain'],
      };
    }
  }

  // Third pass: supersession (R-DEC-07)
  applySupersession(candidates);

  // Convert to Decision objects
  return candidates.map(c => ({
    id: `d-${c.index}`,
    status: c.status,
    summary: c.summary,
    sources: c.sources,
    supersededBy: c.supersededBy,
    uncertainty: c.uncertainty,
  }));
}

// ─── Internal Types ──────────────────────────────────────────────────

interface DecisionCandidate {
  index: number;
  status: DecisionStatus;
  summary: string;
  sources: SourceRef[];
  messageIndex: number;
  uncertainty: Uncertainty;
  topicTokens: string[];
  ruleId: string;
  supersededBy?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some(phrase => normalized.includes(phrase));
}

function hasDecisionVocab(normalized: string): boolean {
  const vocab = ['which', ' or ', 'should we', 'vote', 'decide', 'prefer'];
  return vocab.some(word => normalized.includes(word));
}

/**
 * Extract topic key tokens: up to 3 highest-IDF-like nouns.
 * Uses simple stop-word filtered tokens.
 */
function extractTopicTokens(text: string): string[] {
  const tokens = normalizeForMatching(text)
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));

  // Return unique tokens (up to 5 for matching, 3 overlap threshold)
  return [...new Set(tokens)].slice(0, 5);
}

/**
 * Apply supersession: later confirmed decisions on the same topic
 * mark earlier ones as superseded.
 */
function applySupersession(candidates: DecisionCandidate[]): void {
  const confirmed = candidates.filter(c => c.status === 'confirmed');

  for (let i = 0; i < confirmed.length; i++) {
    for (let j = i + 1; j < confirmed.length; j++) {
      const earlier = confirmed[i];
      const later = confirmed[j];

      const shared = earlier.topicTokens.filter(t =>
        later.topicTokens.includes(t)
      );

      if (shared.length >= 2) {
        // Clear supersession — later replaces earlier
        earlier.supersededBy = `d-${later.index}`;
        earlier.uncertainty = {
          level: earlier.uncertainty.level,
          notes: [
            ...earlier.uncertainty.notes,
            `Superseded by a later decision (d-${later.index})`,
          ],
        };
      } else if (shared.length === 1) {
        // Uncertain topic overlap — keep both with note
        earlier.uncertainty = {
          level: 'low',
          notes: [
            ...earlier.uncertainty.notes,
            'A later decision may address the same topic — review both',
          ],
        };
        later.uncertainty = {
          level: later.uncertainty.level,
          notes: [
            ...later.uncertainty.notes,
            'An earlier decision may address the same topic — review both',
          ],
        };
      }
    }
  }
}

function truncateExcerpt(text: string): string {
  const cleaned = text.replace(/\n/g, ' ').trim();
  if (cleaned.length <= MAX_EXCERPT_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_EXCERPT_LENGTH - 3) + '...';
}
