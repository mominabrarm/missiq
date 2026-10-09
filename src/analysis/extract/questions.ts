/**
 * Open question detection per PRD §17.6.
 *
 * An open question: a message containing "?" from sender X,
 * with no reply from a different participant containing at least 2
 * shared content tokens or an answer pattern within the next 8 messages.
 *
 * Labelled "Possibly unanswered" — never "unanswered".
 */

import { ParsedMessage, SourceRef } from '../../types/model';
import { normalizeForMatching } from '../normalize';
import { STOP_WORDS } from '../../config/patterns';
import { QUESTION_REPLY_WINDOW } from '../../config/limits';

export interface QuestionCandidate {
  messageId: string;
  text: string;
  sources: SourceRef[];
}

const ANSWER_PATTERNS = ['yes', 'no', 'yeah', 'done', 'sure', 'ok', 'okay', 'yep', 'nope', 'correct'];

/**
 * Detect open (possibly unanswered) questions.
 */
export function detectQuestions(messages: ParsedMessage[]): QuestionCandidate[] {
  const candidates: QuestionCandidate[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.parsingStatus === 'system' || msg.isDuplicateOf) continue;
    if (!msg.text.includes('?')) continue;

    const normalized = normalizeForMatching(msg.text);
    const questionTokens = extractContentTokens(normalized);
    const sender = msg.sender;

    // Check for replies within QUESTION_REPLY_WINDOW
    let answered = false;
    const endIdx = Math.min(messages.length, i + QUESTION_REPLY_WINDOW + 1);

    for (let j = i + 1; j < endIdx; j++) {
      const reply = messages[j];
      if (reply.parsingStatus === 'system' || reply.isDuplicateOf) continue;
      if (reply.sender === sender) continue; // Same sender doesn't count

      const replyNorm = normalizeForMatching(reply.text);

      // Check for answer patterns
      if (ANSWER_PATTERNS.some(pat => replyNorm.includes(pat))) {
        answered = true;
        break;
      }

      // Check for shared content tokens (≥2)
      const replyTokens = extractContentTokens(replyNorm);
      const shared = questionTokens.filter(t => replyTokens.includes(t));
      if (shared.length >= 2) {
        answered = true;
        break;
      }
    }

    if (!answered) {
      candidates.push({
        messageId: msg.id,
        text: msg.text.replace(/\n/g, ' ').trim(),
        sources: [{ messageId: msg.id }],
      });
    }
  }

  return candidates;
}

function extractContentTokens(text: string): string[] {
  return text
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}
