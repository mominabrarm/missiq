/**
 * Topic extraction per PRD §17.6.
 *
 * Top ≤5 frequent non-stop-word unigram/bigram phrases (min count 3).
 * Labelled "Frequent terms" if fewer than 3 phrases qualify.
 * No claim of semantic understanding.
 */

import { ParsedMessage, SourceRef } from '../../types/model';
import { normalizeForMatching } from '../normalize';
import { STOP_WORDS } from '../../config/patterns';
import { MIN_TOPIC_COUNT, MAX_TOPICS } from '../../config/limits';

export interface TopicCandidate {
  label: string;
  messageCount: number;
  sources: SourceRef[];
}

/**
 * Extract frequent topics from messages.
 */
export function extractTopics(messages: ParsedMessage[]): TopicCandidate[] {
  const termCounts = new Map<string, { count: number; messageIds: Set<string> }>();

  for (const msg of messages) {
    if (msg.parsingStatus === 'system' || msg.isDuplicateOf) continue;

    const normalized = normalizeForMatching(msg.text);
    const tokens = normalized.split(/\s+/).filter(t => t.length > 2 && !STOP_WORDS.has(t));
    const seen = new Set<string>();

    // Unigrams
    for (const token of tokens) {
      if (seen.has(token)) continue;
      seen.add(token);
      const entry = termCounts.get(token) ?? { count: 0, messageIds: new Set() };
      entry.count++;
      entry.messageIds.add(msg.id);
      termCounts.set(token, entry);
    }

    // Bigrams
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]} ${tokens[i + 1]}`;
      if (seen.has(bigram)) continue;
      seen.add(bigram);
      const entry = termCounts.get(bigram) ?? { count: 0, messageIds: new Set() };
      entry.count++;
      entry.messageIds.add(msg.id);
      termCounts.set(bigram, entry);
    }
  }

  // Filter and sort
  const qualifying = Array.from(termCounts.entries())
    .filter(([, v]) => v.count >= MIN_TOPIC_COUNT)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MAX_TOPICS);

  return qualifying.map(([label, data]) => ({
    label,
    messageCount: data.count,
    sources: Array.from(data.messageIds).slice(0, 3).map(id => ({ messageId: id })),
  }));
}
