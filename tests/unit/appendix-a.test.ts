import { describe, it, expect } from 'vitest';
import { analyzeTranscript } from '../../src/analysis/pipeline';
import { SAMPLE_TRANSCRIPT, SAMPLE_USER_NAME } from '../../src/testing/fixtures/sample';
import { ActionItem, Decision } from '../../src/types/model';

describe('Appendix A Acceptance Test Fixture', () => {
  const { result, validation } = analyzeTranscript(SAMPLE_TRANSCRIPT, SAMPLE_USER_NAME, undefined, true);
  const conv = result.conversation;

  describe('A.1 Expected Parsing', () => {
    it('detects format F1', () => {
      expect(conv.stats.formatDetected).toBe('F1');
    });

    it('recognizes exactly 17 messages', () => {
      expect(conv.messages).toHaveLength(17);
      expect(conv.stats.messageCount).toBe(17);
    });

    it('has 0 unrecognized lines', () => {
      expect(conv.stats.unrecognizedLines).toBe(0);
    });

    it('handles multiline continuation for m-16', () => {
      const m16 = conv.messages[16];
      expect(m16.text).toContain('Agenda for Thursday:');
      expect(m16.text).toContain('- finalize slides');
      expect(m16.text).toContain('- test the build');
    });

    it('flags m-15 as a duplicate of m-14', () => {
      const m14 = conv.messages[14];
      const m15 = conv.messages[15];
      expect(m14.sender).toBe('Karan');
      expect(m14.text).toBe('ok');
      expect(m15.sender).toBe('Karan');
      expect(m15.text).toBe('ok');
      expect(m15.isDuplicateOf).toBe('m-14');
    });

    it('extracts all participants without duplicates', () => {
      expect(conv.participants).toEqual(
        expect.arrayContaining(['Priya', 'Rohan', 'Meera', 'Karan', 'Aarav'])
      );
      expect(conv.participants).toHaveLength(5);
    });
  });

  describe('A.2 Expected Insights (Core Requirements)', () => {
    it('1. m-5: Priya -> Aarav task assigned to user, due Wed 11 Mar 17:00, category Critical', () => {
      const task = result.actions.find((a: ActionItem) =>
        a.sources.some(s => s.messageId === 'm-5') && a.kind === 'assigned-to-user'
      );
      expect(task).toBeDefined();
      expect(task!.assignee).toBe('Aarav');
      expect(task!.deadline).toBeDefined();
      expect(task!.deadline!.resolvedIso).toBe('2026-03-11T17:00:00');
      expect(task!.category).toBe('critical');
    });

    it('2. m-3: Confirmed decision on Firebase, category High', () => {
      const decision = result.decisions.find((d: Decision) =>
        d.sources.some(s => s.messageId === 'm-3') && d.status === 'confirmed'
      );
      expect(decision).toBeDefined();
      expect(decision!.summary.toLowerCase()).toContain('firebase');
      const insight = result.insights.find(i => i.sources.some(s => s.messageId === 'm-3'));
      expect(insight).toBeDefined();
      expect(insight!.category).toBe('high');
    });

    it('3. m-9: Priya unassigned request + deadline 13/03, category Medium (not Critical despite URGENT!!)', () => {
      const task = result.actions.find((a: ActionItem) =>
        a.sources.some(s => s.messageId === 'm-9')
      );
      expect(task).toBeDefined();
      expect(task!.kind).toBe('unassigned-request');
      expect(task!.deadline).toBeDefined();
      expect(task!.deadline!.resolvedIso).toContain('2026-03-13');
      expect(task!.category).toBe('medium');
    });

    it('4. m-11: Rohan -> Aarav mention + request, category High', () => {
      const mentionInsight = result.insights.find(i =>
        i.kind === 'mention' && i.sources.some(s => s.messageId === 'm-11')
      );
      expect(mentionInsight).toBeDefined();
      expect(mentionInsight!.category).toBe('high');
      expect(mentionInsight!.reasons.some(r => r.ruleId === 'R-PRI-05')).toBe(true);
    });

    it('5. m-13: Priya confirmed decision (demo date unchanged), category High', () => {
      const decision = result.decisions.find((d: Decision) =>
        d.sources.some(s => s.messageId === 'm-13') && d.status === 'confirmed'
      );
      expect(decision).toBeDefined();
      const insight = result.insights.find(i => i.sources.some(s => s.messageId === 'm-13'));
      expect(insight).toBeDefined();
      expect(insight!.category).toBe('high');
    });

    it('6. m-0: Announcement with date 14/03 4pm, category Medium', () => {
      const annInsight = result.insights.find(i =>
        i.sources.some(s => s.messageId === 'm-0')
      );
      expect(annInsight).toBeDefined();
      expect(annInsight!.category).toBe('medium');
    });

    it('7. m-6: Meera commitment tonight (2026-03-10), category Medium', () => {
      const task = result.actions.find((a: ActionItem) =>
        a.sources.some(s => s.messageId === 'm-6') && a.kind === 'commitment'
      );
      expect(task).toBeDefined();
      expect(task!.assignee).toBe('Meera');
      expect(task!.deadline).toBeDefined();
      expect(task!.deadline!.resolvedIso).toContain('2026-03-10');
      expect(task!.category).toBe('medium');
    });

    it('8. m-7: Rohan task cancelled by m-8, status possibly-cancelled, category Low', () => {
      const task = result.actions.find((a: ActionItem) =>
        a.sources.some(s => s.messageId === 'm-7')
      );
      expect(task).toBeDefined();
      expect(task!.status).toBe('possibly-cancelled');
      expect(task!.category).toBe('low');
    });

    it('9. m-11: Rohan -> Meera task assigned-to-other, category Low', () => {
      const task = result.actions.find((a: ActionItem) =>
        a.sources.some(s => s.messageId === 'm-11') && a.kind === 'assigned-to-other'
      );
      expect(task).toBeDefined();
      expect(task!.assignee).toBe('Meera');
      expect(task!.category).toBe('low');
    });

    it('10. m-12: Meera decision is suggestion, category Low', () => {
      const decision = result.decisions.find((d: Decision) =>
        d.sources.some(s => s.messageId === 'm-12')
      );
      expect(decision).toBeDefined();
      expect(decision!.status).toBe('suggestion');
    });

    it('12. m-7: Not flagged as an open question (replied to by m-8)', () => {
      const q = result.summary.openQuestions.find(q =>
        q.sources.some(s => s.messageId === 'm-7')
      );
      expect(q).toBeUndefined();
    });
  });

  describe('A.3 Expected Priority Feed Order', () => {
    it('orders by Category (Critical -> High -> Medium -> Low)', () => {
      const categories = result.insights.map(i => i.category);
      const categoryRank = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      for (let i = 0; i < categories.length - 1; i++) {
        expect(categoryRank[categories[i]]).toBeLessThanOrEqual(categoryRank[categories[i + 1]]);
      }
    });

    it('places Critical task (slide deck draft) first', () => {
      expect(result.insights[0].category).toBe('critical');
      expect(result.insights[0].sources.some(s => s.messageId === 'm-5')).toBe(true);
    });
  });

  describe('A.4 Traceability & Reference Validation', () => {
    it('passes V-01..V-10 validation with 100% traceable references', () => {
      expect(validation.isValid).toBe(true);
      expect(validation.droppedInsightIds).toHaveLength(0);
      expect(validation.errors).toHaveLength(0);
    });

    it('has non-empty sources on all briefing lines', () => {
      for (const line of result.summary.attention) {
        expect(line.sources.length).toBeGreaterThanOrEqual(1);
      }
      for (const line of result.summary.deadlines) {
        expect(line.sources.length).toBeGreaterThanOrEqual(1);
      }
      for (const line of result.summary.decisions) {
        expect(line.sources.length).toBeGreaterThanOrEqual(1);
      }
      for (const line of result.summary.announcements) {
        expect(line.sources.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('summary method is rule-based', () => {
      expect(result.summary.method).toBe('rule-based');
    });
  });
});
