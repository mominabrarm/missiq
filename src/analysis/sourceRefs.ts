import {
  AnalysisResult,
  ParsedMessage,
  SourceRef,
} from '../types/model';

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  droppedInsightIds: string[];
}

/**
 * Validates an AnalysisResult against PRD Section 16.1 Rules V-01 through V-10.
 * Ensures every insight is grounded in valid source messages without hallucinated metadata.
 */
export function validateReferences(result: AnalysisResult): ValidationReport {
  const errors: string[] = [];
  const droppedInsightIds: string[] = [];
  const messageMap = new Map<string, ParsedMessage>();

  // V-01: Verify message indices and unique IDs
  result.conversation.messages.forEach((msg, idx) => {
    if (msg.sourceIndex !== idx) {
      errors.push(`V-01: Message ${msg.id} sourceIndex (${msg.sourceIndex}) does not match array position (${idx})`);
    }
    if (messageMap.has(msg.id)) {
      errors.push(`V-01: Duplicate message ID detected: ${msg.id}`);
    }
    messageMap.set(msg.id, msg);
  });

  const validateSourceRef = (ref: SourceRef, contextLabel: string): boolean => {
    const targetMsg = messageMap.get(ref.messageId);
    if (!targetMsg) {
      errors.push(`V-02: ${contextLabel} references non-existent message ID "${ref.messageId}"`);
      return false;
    }

    if (ref.span) {
      const { start, end } = ref.span;
      if (start < 0 || end <= start || end > targetMsg.text.length) {
        errors.push(
          `V-02: ${contextLabel} span [${start}, ${end}] is out of bounds for message "${ref.messageId}" (length ${targetMsg.text.length})`
        );
        return false;
      }
    }
    return true;
  };

  // V-03: Every insight, action, decision, briefing line has sources.length >= 1
  result.insights.forEach((insight) => {
    if (!insight.sources || insight.sources.length === 0) {
      errors.push(`V-03: PriorityInsight "${insight.id}" has no supporting sources`);
      droppedInsightIds.push(insight.id);
    } else {
      insight.sources.forEach((s) => validateSourceRef(s, `PriorityInsight "${insight.id}"`));
    }

    // V-06: category critical or high must have reasons.length >= 1
    if ((insight.category === 'critical' || insight.category === 'high') && (!insight.reasons || insight.reasons.length === 0)) {
      errors.push(`V-06: PriorityInsight "${insight.id}" (${insight.category}) missing priority reasons`);
    }

    // V-07: basis "explicit" must have marker rule in reasons
    if (insight.basis === 'explicit' && (!insight.reasons || insight.reasons.length === 0)) {
      errors.push(`V-07: PriorityInsight "${insight.id}" marked explicit but lacks rule reasons`);
    }

    // V-09: Title length <= 160 chars
    if (insight.title && insight.title.length > 160) {
      errors.push(`V-09: PriorityInsight "${insight.id}" title exceeds 160 characters`);
    }
  });

  // Action Items validation
  result.actions.forEach((action) => {
    if (!action.sources || action.sources.length === 0) {
      errors.push(`V-03: ActionItem "${action.id}" has no supporting sources`);
      droppedInsightIds.push(action.id);
    } else {
      action.sources.forEach((s) => validateSourceRef(s, `ActionItem "${action.id}"`));
    }

    // V-04: DeadlineInfo.rawText appears in source message
    if (action.deadline) {
      const hasMatchingText = action.sources.some((s) => {
        const msg = messageMap.get(s.messageId);
        return msg && msg.text.toLowerCase().includes(action.deadline!.rawText.toLowerCase());
      });
      if (!hasMatchingText) {
        errors.push(`V-04: ActionItem "${action.id}" deadline rawText "${action.deadline.rawText}" not found in source messages`);
      }
    }

    // V-05: Assignee, when set, appears in source message or equals sender (for commitments)
    if (action.assignee) {
      const assigneeLower = action.assignee.toLowerCase();
      const isFound = action.sources.some((s) => {
        const msg = messageMap.get(s.messageId);
        if (!msg) return false;
        return (
          (msg.sender && msg.sender.toLowerCase() === assigneeLower) ||
          msg.text.toLowerCase().includes(assigneeLower)
        );
      });
      if (!isFound) {
        errors.push(`V-05: ActionItem "${action.id}" assignee "${action.assignee}" not found in source text or sender`);
      }
    }

    // V-09: Excerpt <= 200 chars
    if (action.description && action.description.length > 200) {
      errors.push(`V-09: ActionItem "${action.id}" description exceeds 200 characters`);
    }

    // V-10: System/duplicate messages never sole source
    if (action.sources.length === 1) {
      const msg = messageMap.get(action.sources[0].messageId);
      if (msg && (msg.parsingStatus === 'system' || msg.isDuplicateOf)) {
        errors.push(`V-10: ActionItem "${action.id}" cannot have system/duplicate message as sole source`);
      }
    }
  });

  // Decisions validation
  result.decisions.forEach((decision) => {
    if (!decision.sources || decision.sources.length === 0) {
      errors.push(`V-03: Decision "${decision.id}" has no supporting sources`);
      droppedInsightIds.push(decision.id);
    } else {
      decision.sources.forEach((s) => validateSourceRef(s, `Decision "${decision.id}"`));
    }

    if (decision.summary && decision.summary.length > 200) {
      errors.push(`V-09: Decision "${decision.id}" summary exceeds 200 characters`);
    }
  });

  // V-08: Briefing summary method
  if (result.summary.method !== 'rule-based' && result.summary.method !== 'on-device-model') {
    errors.push(`V-08: Invalid summary method "${result.summary.method}"`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    droppedInsightIds,
  };
}
