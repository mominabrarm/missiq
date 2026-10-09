/**
 * Briefing builder per PRD §FR-010.
 *
 * Assembles a rule-based briefing from extracted insights.
 * Structure (fixed order):
 * 1. Coverage statement
 * 2. "Needs your attention" (top ≤5 by priority, personalized)
 * 3. Deadlines (sorted by resolved date; unresolved last)
 * 4. Decisions (confirmed only; others in Decisions view)
 * 5. Announcements
 * 6. Open questions
 * 7. Main topics (top ≤5 with message counts)
 * 8. Activity overview
 *
 * Every line carries source references. Summary method = "rule-based".
 */

import {
  Summary,
  BriefingLine,
  PriorityInsight,
  ActionItem,
  Decision,
  Conversation,
} from '../types/model';
import { MAX_BRIEFING_ITEMS } from '../config/limits';
import { DeadlineCandidate } from './extract/dates';
import { AnnouncementCandidate } from './extract/announcements';
import { QuestionCandidate } from './extract/questions';
import { TopicCandidate } from './extract/topics';

interface BriefingInput {
  conversation: Conversation;
  insights: PriorityInsight[];
  actions: ActionItem[];
  decisions: Decision[];
  deadlines: DeadlineCandidate[];
  announcements: AnnouncementCandidate[];
  questions: QuestionCandidate[];
  topics: TopicCandidate[];
  userName: string;
}

/**
 * Build the Summary briefing from all analysis results.
 */
export function buildBriefing(input: BriefingInput): Summary {
  const { conversation, insights, actions, decisions, deadlines,
          announcements, questions, topics } = input;

  // ─── Needs Your Attention ──────────────────────────────────────
  const attentionItems = insights
    .filter(i => i.category === 'critical' || i.category === 'high')
    .slice(0, MAX_BRIEFING_ITEMS)
    .map(i => insightToBriefingLine(i));

  // ─── Deadlines ─────────────────────────────────────────────────
  // Collect deadlines from actions and standalone deadline candidates
  const deadlineLines: BriefingLine[] = [];
  const seenDeadlineMessages = new Set<string>();

  // From actions with deadlines
  for (const action of actions) {
    if (!action.deadline) continue;
    const msgId = action.sources[0]?.messageId;
    if (seenDeadlineMessages.has(msgId)) continue;
    seenDeadlineMessages.add(msgId);

    const dateStr = action.deadline.resolvedIso
      ? formatDate(action.deadline.resolvedIso)
      : action.deadline.rawText;

    const assigneeStr = action.assignee ? `${action.assignee} — ` : '';
    deadlineLines.push({
      text: `${dateStr}: ${assigneeStr}${truncate(action.description)}`,
      sources: action.sources,
      insightId: action.id,
    });
  }

  // From standalone deadlines not already in tasks
  for (const dc of deadlines) {
    if (seenDeadlineMessages.has(dc.messageId)) continue;
    seenDeadlineMessages.add(dc.messageId);

    const dateStr = dc.deadline.resolvedIso
      ? formatDate(dc.deadline.resolvedIso)
      : dc.deadline.rawText;

    deadlineLines.push({
      text: `${dateStr}: ${truncate(dc.deadline.rawText)}`,
      sources: [{ messageId: dc.messageId, span: dc.span }],
    });
  }

  // Sort deadlines: resolved first by date, then unresolved
  deadlineLines.sort((a, b) => {
    const aResolved = a.text.match(/^\d{4}-/) || a.text.match(/^\d{1,2}\s\w+/);
    const bResolved = b.text.match(/^\d{4}-/) || b.text.match(/^\d{1,2}\s\w+/);
    if (aResolved && !bResolved) return -1;
    if (!aResolved && bResolved) return 1;
    return 0;
  });

  // ─── Decisions (confirmed only) ────────────────────────────────
  const decisionLines: BriefingLine[] = decisions
    .filter(d => d.status === 'confirmed' && !d.supersededBy)
    .slice(0, MAX_BRIEFING_ITEMS)
    .map(d => ({
      text: `${truncate(d.summary)} (confirmed)`,
      sources: d.sources,
      insightId: d.id,
    }));

  // ─── Announcements ─────────────────────────────────────────────
  const announcementLines: BriefingLine[] = announcements
    .slice(0, MAX_BRIEFING_ITEMS)
    .map(a => ({
      text: truncate(a.text),
      sources: a.sources,
    }));

  // ─── Open Questions ────────────────────────────────────────────
  const questionLines: BriefingLine[] = questions
    .slice(0, MAX_BRIEFING_ITEMS)
    .map(q => ({
      text: `Possibly unanswered: ${truncate(q.text)}`,
      sources: q.sources,
    }));

  // ─── Topics ────────────────────────────────────────────────────
  const topicItems = topics.map(t => ({
    label: t.label,
    messageCount: t.messageCount,
    sources: t.sources,
  }));

  // ─── Activity ──────────────────────────────────────────────────
  const activity = {
    messageCount: conversation.stats.messageCount,
    participantCount: conversation.participants.length,
    spanIso: (conversation.stats.firstTimestampIso && conversation.stats.lastTimestampIso)
      ? [conversation.stats.firstTimestampIso, conversation.stats.lastTimestampIso] as [string, string]
      : undefined,
  };

  return {
    method: 'rule-based',
    coverage: {
      messagesAnalyzed: conversation.stats.messageCount,
      unrecognizedLines: conversation.stats.unrecognizedLines,
      totalLines: conversation.stats.totalLines,
    },
    attention: attentionItems,
    deadlines: deadlineLines.slice(0, MAX_BRIEFING_ITEMS),
    decisions: decisionLines,
    announcements: announcementLines,
    openQuestions: questionLines,
    topics: topicItems,
    activity,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function insightToBriefingLine(insight: PriorityInsight): BriefingLine {
  const reason = insight.reasons[0]?.label ?? '';
  return {
    text: `${insight.title}${reason ? ` — ${reason}` : ''}`,
    sources: insight.sources,
    insightId: insight.relatedId ?? insight.id,
  };
}

function truncate(text: string, maxLen: number = 160): string {
  const cleaned = text.replace(/\n/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 3) + '...';
}

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;

    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];

    const hasTime = iso.includes('T');
    if (hasTime) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${day} ${month} ${hours}:${minutes}`;
    }
    return `${day} ${month}`;
  } catch {
    return iso;
  }
}
