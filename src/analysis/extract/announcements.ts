/**
 * Announcement extraction per PRD §17.6.
 *
 * Detects messages containing announcement markers:
 * "announcement", "reminder", "heads up", "note:", "please note",
 * "update:", "meeting at", "class cancelled/canceled", "moved to", "postponed".
 *
 * Medium confidence.
 */

import { ParsedMessage, SourceRef } from '../../types/model';
import { normalizeForMatching } from '../normalize';
import { ANNOUNCEMENT_MARKERS } from '../../config/patterns';

export interface AnnouncementCandidate {
  messageId: string;
  text: string;
  sources: SourceRef[];
  marker: string;
}

/**
 * Detect announcements in parsed messages.
 */
export function detectAnnouncements(messages: ParsedMessage[]): AnnouncementCandidate[] {
  const candidates: AnnouncementCandidate[] = [];

  for (const msg of messages) {
    if (msg.parsingStatus === 'system' || msg.isDuplicateOf) continue;

    const normalized = normalizeForMatching(msg.text);

    for (const marker of ANNOUNCEMENT_MARKERS) {
      if (normalized.includes(marker)) {
        candidates.push({
          messageId: msg.id,
          text: msg.text.replace(/\n/g, ' ').trim(),
          sources: [{ messageId: msg.id }],
          marker,
        });
        break; // One announcement per message
      }
    }
  }

  return candidates;
}
