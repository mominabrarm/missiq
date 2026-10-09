import { describe, it, expect } from 'vitest';
import { validateReferences } from '../../src/analysis/sourceRefs';
import { AnalysisResult } from '../../src/types/model';

describe('validateReferences (V-01..V-10 Validation Rules)', () => {
  const createMockResult = (): AnalysisResult => ({
    runId: 1,
    conversation: {
      messages: [
        {
          id: 'm-0',
          sourceIndex: 0,
          lineStart: 1,
          lineEnd: 1,
          sender: 'Priya',
          timestamp: { raw: '10/03/2026, 09:30', iso: '2026-03-10T09:30:00', ambiguous: false },
          text: 'Aarav, please send the slide deck draft by tomorrow 5pm.',
          parsingStatus: 'parsed',
          mentions: [],
        },
        {
          id: 'm-1',
          sourceIndex: 1,
          lineStart: 2,
          lineEnd: 2,
          sender: 'Meera',
          timestamp: { raw: '10/03/2026, 09:32', iso: '2026-03-10T09:32:00', ambiguous: false },
          text: "I'll update the README tonight.",
          parsingStatus: 'parsed',
          mentions: [],
        },
      ],
      participants: ['Priya', 'Meera', 'Aarav'],
      stats: {
        totalLines: 2,
        nonEmptyLines: 2,
        messageCount: 2,
        unrecognizedLines: 0,
        formatDetected: 'F1',
      },
      isSample: true,
    },
    summary: {
      method: 'rule-based',
      coverage: { messagesAnalyzed: 2, unrecognizedLines: 0, totalLines: 2 },
      attention: [],
      deadlines: [],
      decisions: [],
      announcements: [],
      openQuestions: [],
      topics: [],
      activity: { messageCount: 2, participantCount: 3 },
    },
    insights: [
      {
        id: 'p-0',
        kind: 'task',
        title: 'Send slide deck draft',
        category: 'critical',
        basis: 'explicit',
        reasons: [{ ruleId: 'R-PRI-01', label: 'Assigned to you · due Wed 11 Mar' }],
        sources: [{ messageId: 'm-0', span: { start: 0, end: 55 } }],
        uncertainty: { level: 'high', notes: [] },
      },
    ],
    actions: [
      {
        id: 'a-0',
        kind: 'assigned-to-user',
        description: 'send the slide deck draft',
        assignee: 'Aarav',
        deadline: {
          rawText: 'tomorrow 5pm',
          resolvedIso: '2026-03-11T17:00:00',
          resolution: 'relative-resolved',
          origin: 'same-message',
        },
        category: 'critical',
        basis: 'explicit',
        reasons: [{ ruleId: 'R-PRI-01', label: 'Assigned to you' }],
        sources: [{ messageId: 'm-0' }],
        status: 'open',
        uncertainty: { level: 'high', notes: [] },
      },
    ],
    decisions: [],
    mentions: [],
    warnings: [],
  });

  it('passes a fully valid AnalysisResult', () => {
    const result = createMockResult();
    const report = validateReferences(result);
    expect(report.isValid).toBe(true);
    expect(report.errors).toHaveLength(0);
  });

  it('V-01: catches index mismatch', () => {
    const result = createMockResult();
    result.conversation.messages[1].sourceIndex = 5; // Mismatch
    const report = validateReferences(result);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('V-01'))).toBe(true);
  });

  it('V-02: catches non-existent message reference and out of bounds span', () => {
    const result = createMockResult();
    result.insights[0].sources = [{ messageId: 'm-999' }]; // Non-existent
    let report = validateReferences(result);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('non-existent message ID'))).toBe(true);

    const result2 = createMockResult();
    result2.insights[0].sources = [{ messageId: 'm-0', span: { start: 0, end: 9999 } }]; // Out of bounds
    report = validateReferences(result2);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('out of bounds'))).toBe(true);
  });

  it('V-03: catches missing source references', () => {
    const result = createMockResult();
    result.insights[0].sources = [];
    const report = validateReferences(result);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('V-03'))).toBe(true);
  });

  it('V-04: catches deadline rawText missing from source message', () => {
    const result = createMockResult();
    result.actions[0].deadline!.rawText = 'next month non-existent date phrase';
    const report = validateReferences(result);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('V-04'))).toBe(true);
  });

  it('V-05: catches assignee not found in source message or sender', () => {
    const result = createMockResult();
    result.actions[0].assignee = 'UnknownPersonWhoIsNotInMessage';
    const report = validateReferences(result);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('V-05'))).toBe(true);
  });

  it('V-06 & V-07: catches critical/high insights missing priority reasons', () => {
    const result = createMockResult();
    result.insights[0].reasons = [];
    const report = validateReferences(result);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('V-06'))).toBe(true);
  });

  it('V-09: catches title length exceeding 160 characters', () => {
    const result = createMockResult();
    result.insights[0].title = 'A'.repeat(161);
    const report = validateReferences(result);
    expect(report.isValid).toBe(false);
    expect(report.errors.some((e) => e.includes('V-09'))).toBe(true);
  });
});
