/**
 * Explainable prioritization module per PRD §FR-011, §17.5.
 *
 * Deterministic rule table, evaluated top-down. Highest category satisfied wins.
 * All satisfied rules are recorded in reasons.
 *
 * Categories: Critical → High → Medium → Low → Info.
 * Each item has priorityBasis: "explicit" | "inferred".
 *
 * Urgency markers alone yield at most Medium (R-PRI-03).
 * No High/Critical without reasons.
 */

import {
  PriorityInsight,
  PriorityCategory,
  PriorityReason,
  ActionItem,
  Decision,
  Mention,
  SourceRef,
} from '../types/model';
import { normalizeForMatching } from './normalize';
import { URGENCY_MARKERS } from '../config/patterns';
import { CRITICAL_DEADLINE_HOURS, MAX_TITLE_LENGTH } from '../config/limits';
import { DeadlineCandidate } from './extract/dates';
import { AnnouncementCandidate } from './extract/announcements';
import { QuestionCandidate } from './extract/questions';

interface PrioritizationInput {
  actions: ActionItem[];
  decisions: Decision[];
  mentions: Mention[];
  deadlines: DeadlineCandidate[];
  announcements: AnnouncementCandidate[];
  questions: QuestionCandidate[];
  userName: string;
  referenceDateIso: string | undefined;
  /** All message texts indexed by message id for urgency marker lookup */
  messageTexts: Map<string, string>;
}

/**
 * Assign priority categories and build PriorityInsight[] from all extraction results.
 */
export function prioritize(input: PrioritizationInput): PriorityInsight[] {
  const insights: PriorityInsight[] = [];
  const insightDeadlines = new Map<string, string>();
  let insightIndex = 0;

  // ─── Tasks ─────────────────────────────────────────────────────
  for (const action of input.actions) {
    const { category, basis, reasons } = prioritizeAction(
      action, input.userName, input.referenceDateIso, input.messageTexts
    );

    // Update the action's category and basis
    action.category = category;
    action.basis = basis;
    action.reasons = reasons;

    const insightId = `p-${insightIndex++}`;
    if (action.deadline?.resolvedIso) {
      insightDeadlines.set(insightId, action.deadline.resolvedIso);
    }

    insights.push({
      id: insightId,
      kind: 'task',
      title: truncateTitle(action.description),
      category,
      basis,
      reasons,
      sources: action.sources,
      uncertainty: action.uncertainty,
      relatedId: action.id,
    });
  }

  // ─── Decisions ─────────────────────────────────────────────────
  for (const decision of input.decisions) {
    const { category, basis, reasons } = prioritizeDecision(
      decision, input.messageTexts
    );

    const insightId = `p-${insightIndex++}`;
    insights.push({
      id: insightId,
      kind: 'decision',
      title: truncateTitle(decision.summary),
      category,
      basis,
      reasons,
      sources: decision.sources,
      uncertainty: decision.uncertainty,
      relatedId: decision.id,
    });
  }

  // ─── Mentions ──────────────────────────────────────────────────
  // Group mentions by message to avoid duplicate insights
  const mentionsByMessage = new Map<string, Mention[]>();
  for (const mention of input.mentions) {
    const existing = mentionsByMessage.get(mention.messageId) ?? [];
    existing.push(mention);
    mentionsByMessage.set(mention.messageId, existing);
  }

  for (const [messageId, messageMentions] of mentionsByMessage) {
    const msgText = input.messageTexts.get(messageId) ?? '';
    const isRequest = msgText.includes('?') || hasTaskPattern(normalizeForMatching(msgText));

    // R-PRI-05/06
    const category: PriorityCategory = isRequest ? 'high' : 'medium';
    const reasons: PriorityReason[] = isRequest
      ? [{ ruleId: 'R-PRI-05', label: 'You were asked directly' }]
      : [{ ruleId: 'R-PRI-06', label: 'You were mentioned' }];

    const insightId = `p-${insightIndex++}`;
    insights.push({
      id: insightId,
      kind: 'mention',
      title: truncateTitle(`Mentioned: ${msgText.replace(/\n/g, ' ').trim()}`),
      category,
      basis: 'inferred',
      reasons,
      sources: [{ messageId }],
      uncertainty: {
        level: messageMentions[0]?.ambiguous ? 'low' : 'high',
        notes: messageMentions[0]?.ambiguous ? ['Name match may be ambiguous'] : [],
      },
    });
  }

  // ─── Announcements ─────────────────────────────────────────────
  for (const ann of input.announcements) {
    // Skip if already covered by a decision or task insight for the same message
    const alreadyCovered = insights.some(i =>
      i.sources.some(s => s.messageId === ann.messageId) &&
      (i.kind === 'task' || i.kind === 'decision')
    );
    if (alreadyCovered) continue;

    const hasMarker = hasExplicitMarker(ann.text);
    const annDeadline = input.deadlines.find(d => d.messageId === ann.messageId);

    const insightId = `p-${insightIndex++}`;
    if (annDeadline?.deadline.resolvedIso) {
      insightDeadlines.set(insightId, annDeadline.deadline.resolvedIso);
    }

    insights.push({
      id: insightId,
      kind: 'announcement',
      title: truncateTitle(ann.text),
      category: 'medium',
      basis: hasMarker ? 'explicit' : 'inferred',
      reasons: [{
        ruleId: 'R-PRI-09',
        label: `Announcement: ${ann.marker}`,
      }],
      sources: ann.sources,
      uncertainty: { level: 'medium', notes: [] },
    });
  }

  // ─── Open Questions ────────────────────────────────────────────
  for (const q of input.questions) {
    // Skip if already covered by a mention or task
    const alreadyCovered = insights.some(i =>
      i.sources.some(s => s.messageId === q.messageId) &&
      (i.kind === 'mention' || i.kind === 'task')
    );
    if (alreadyCovered) continue;

    const insightId = `p-${insightIndex++}`;
    insights.push({
      id: insightId,
      kind: 'question',
      title: truncateTitle(`Possibly unanswered: ${q.text}`),
      category: 'low',
      basis: 'inferred',
      reasons: [{ ruleId: 'R-PRI-11', label: 'Open question' }],
      sources: q.sources,
      uncertainty: { level: 'medium', notes: ['Possibly unanswered'] },
    });
  }

  // ─── Sort ──────────────────────────────────────────────────────
  sortInsights(insights, insightDeadlines);

  return insights;
}

// ─── Action Prioritization ───────────────────────────────────────────

function prioritizeAction(
  action: ActionItem,
  _userName: string,
  referenceDateIso: string | undefined,
  messageTexts: Map<string, string>,
): { category: PriorityCategory; basis: 'explicit' | 'inferred'; reasons: PriorityReason[] } {
  const reasons: PriorityReason[] = [...action.reasons];

  // Possibly-cancelled items should be capped at Low (never Critical or High)
  if (action.status === 'possibly-cancelled') {
    return {
      category: 'low',
      basis: 'inferred',
      reasons: [...reasons, { ruleId: 'R-PRI-11', label: 'Possibly cancelled in a later message' }],
    };
  }

  let category: PriorityCategory = 'low';
  let basis: 'explicit' | 'inferred' = 'inferred';

  const isAssignedToUser = action.kind === 'assigned-to-user';
  const hasDeadline = !!action.deadline;
  const hasResolvedDeadline = action.deadline?.resolvedIso !== undefined;

  // Check for urgency markers in source messages
  const hasUrgency = action.sources.some(s => {
    const text = messageTexts.get(s.messageId) ?? '';
    return hasExplicitMarker(text);
  });

  // R-PRI-01: assigned-to-user AND deadline resolved within 48h (or past due)
  if (isAssignedToUser && hasResolvedDeadline && referenceDateIso) {
    const deadlineDate = new Date(action.deadline!.resolvedIso!);
    const refDate = new Date(referenceDateIso);
    const hoursUntil = (deadlineDate.getTime() - refDate.getTime()) / (1000 * 60 * 60);

    if (hoursUntil <= CRITICAL_DEADLINE_HOURS || hoursUntil < 0) {
      category = 'critical';
      basis = 'inferred';
      reasons.push({
        ruleId: 'R-PRI-01',
        label: hoursUntil < 0
          ? 'Assigned to you · past due'
          : `Assigned to you · due within ${Math.ceil(hoursUntil)}h`,
      });
      return { category, basis, reasons };
    }
  }

  // R-PRI-02: assigned-to-user AND deadline present but unresolved/ambiguous
  if (isAssignedToUser && hasDeadline && !hasResolvedDeadline) {
    if (hasUrgency) {
      category = 'critical';
      basis = 'explicit';
      reasons.push({ ruleId: 'R-PRI-02', label: 'Assigned to you · deadline unresolved · urgency marker' });
    } else {
      category = 'high';
      basis = 'inferred';
      reasons.push({ ruleId: 'R-PRI-02', label: 'Assigned to you · deadline unresolved' });
    }
    return { category, basis, reasons };
  }

  // R-PRI-04: assigned-to-user without deadline
  if (isAssignedToUser && !hasDeadline) {
    category = 'high';
    basis = 'inferred';
    reasons.push({ ruleId: 'R-PRI-04', label: 'Assigned to you' });
    return { category, basis, reasons };
  }

  // R-PRI-01 with deadline but no reference date — still high if assigned to user
  if (isAssignedToUser && hasResolvedDeadline && !referenceDateIso) {
    category = 'high';
    basis = 'inferred';
    reasons.push({ ruleId: 'R-PRI-04', label: 'Assigned to you · deadline present' });
    return { category, basis, reasons };
  }

  // R-PRI-03: Urgency marker alone (no assignment to user, no user-relevant deadline)
  if (hasUrgency && !isAssignedToUser) {
    category = 'medium';
    basis = 'explicit';
    reasons.push({ ruleId: 'R-PRI-03', label: 'Urgency marker present, not assigned to you' });
    return { category, basis, reasons };
  }

  // R-PRI-10: Task assigned to others or commitment with deadline
  if ((action.kind === 'assigned-to-other' || action.kind === 'commitment' ||
       action.kind === 'unassigned-request') && hasDeadline) {
    category = 'medium';
    basis = 'inferred';
    reasons.push({ ruleId: 'R-PRI-10', label: `${formatKind(action.kind)} with deadline` });
    return { category, basis, reasons };
  }

  // R-PRI-11: Everything else (tasks without deadline, etc.)
  category = 'low';
  basis = 'inferred';
  reasons.push({ ruleId: 'R-PRI-11', label: formatKind(action.kind) });

  return { category, basis, reasons };
}

function prioritizeDecision(
  decision: Decision,
  messageTexts: Map<string, string>,
): { category: PriorityCategory; basis: 'explicit' | 'inferred'; reasons: PriorityReason[] } {
  const reasons: PriorityReason[] = [];

  if (decision.status === 'confirmed') {
    // Check for explicit marker
    const hasMarker = decision.sources.some(s => {
      const text = messageTexts.get(s.messageId) ?? '';
      return hasDecisionMarker(text);
    });

    if (hasMarker) {
      // R-PRI-07
      reasons.push({ ruleId: 'R-PRI-07', label: 'Confirmed decision · explicit marker' });
      return { category: 'high', basis: 'explicit', reasons };
    } else {
      // R-PRI-08
      reasons.push({ ruleId: 'R-PRI-08', label: 'Confirmed decision' });
      return { category: 'medium', basis: 'inferred', reasons };
    }
  }

  // Proposals, suggestions, questions, disagreements → Low
  reasons.push({
    ruleId: 'R-PRI-11',
    label: decision.status === 'suggestion' ? 'Suggestion, not decided' :
           decision.status === 'proposal' ? 'Proposal, not confirmed' :
           decision.status === 'question' ? 'Decision question' :
           'Disagreement, unresolved',
  });
  return { category: 'low', basis: 'inferred', reasons };
}

// ─── Sorting ─────────────────────────────────────────────────────────

const CATEGORY_RANK: Record<PriorityCategory, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/**
 * Sort insights by: category rank, then resolved deadline ascending
 * (unresolved last), then source index ascending.
 * The sort is stable and deterministic.
 */
function sortInsights(insights: PriorityInsight[], insightDeadlines: Map<string, string>): void {
  insights.sort((a, b) => {
    // 1. Category rank
    const catDiff = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
    if (catDiff !== 0) return catDiff;

    // 2. Resolved deadline ascending (unresolved/none last)
    const aDeadline = insightDeadlines.get(a.id);
    const bDeadline = insightDeadlines.get(b.id);
    if (aDeadline && bDeadline) {
      const diff = aDeadline.localeCompare(bDeadline);
      if (diff !== 0) return diff;
    } else if (aDeadline && !bDeadline) {
      return -1;
    } else if (!aDeadline && bDeadline) {
      return 1;
    }

    // 3. Source index (proxy: first source message id number)
    const aIdx = extractSourceIndex(a.sources);
    const bIdx = extractSourceIndex(b.sources);
    return aIdx - bIdx;
  });
}

function extractSourceIndex(sources: SourceRef[]): number {
  if (sources.length === 0) return Infinity;
  const id = sources[0].messageId;
  const num = parseInt(id.replace('m-', ''), 10);
  return isNaN(num) ? Infinity : num;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function hasExplicitMarker(text: string): boolean {
  const normalized = normalizeForMatching(text);
  return URGENCY_MARKERS.some(marker => normalized.includes(marker));
}

function hasDecisionMarker(text: string): boolean {
  const normalized = normalizeForMatching(text);
  const markers = ['important', 'final', 'decision:', 'final decision',
                   'final:', "it's settled", 'approved'];
  return markers.some(m => normalized.includes(m));
}

function hasTaskPattern(normalized: string): boolean {
  const taskWords = ['send', 'submit', 'review', 'update', 'check', 'share',
                     'please', 'pls', 'can you', 'could you', 'will you'];
  return taskWords.some(w => normalized.includes(w));
}

function formatKind(kind: string): string {
  switch (kind) {
    case 'assigned-to-user': return 'Assigned to you';
    case 'assigned-to-other': return 'Assigned to someone else';
    case 'commitment': return 'Commitment';
    case 'unassigned-request': return 'Unassigned request';
    case 'inferred': return 'Possible task (uncertain)';
    default: return kind;
  }
}

function truncateTitle(text: string): string {
  const cleaned = text.replace(/\n/g, ' ').trim();
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_TITLE_LENGTH - 3) + '...';
}
