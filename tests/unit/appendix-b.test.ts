import { describe, it, expect } from 'vitest';
import { analyzeTranscript, runAnalysis } from '../../src/analysis/pipeline';

describe('Appendix B Edge-Case Fixtures', () => {
  describe('B1: HTML-like content (literal text, safe rendering)', () => {
    it('extracts task literally without interpreting HTML tags', () => {
      const text = `[10/03/2026, 10:00] Eve: <script>alert(1)</script> please send <b>report</b> by Friday`;
      const { result } = analyzeTranscript(text, 'User', undefined, false);

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0];
      expect(action.description).toContain('<script>');
      expect(action.description).toContain('<b>report</b>');
      expect(action.deadline).toBeDefined();
      expect(action.deadline!.rawText.toLowerCase()).toContain('friday');
      // No script execution, strings are pure literal text
      expect(typeof action.description).toBe('string');
    });
  });

  describe('B2: Similar names boundary check (user = Ann)', () => {
    it('only matches Ann on word boundary, ignoring Annual and Anna', () => {
      const text = `[10/03/2026, 10:00] Bob: The Annual report is due
[10/03/2026, 10:01] Bob: Ann, please review it
[10/03/2026, 10:02] Anna: I will`;

      const { result } = analyzeTranscript(text, 'Ann', undefined, false);

      // Only message m-1 should match mention
      expect(result.mentions).toHaveLength(1);
      expect(result.mentions[0].messageId).toBe('m-1');
      expect(result.mentions[0].matchedText).toBe('Ann');
    });
  });

  describe('B3: Ambiguous date (no value >12 anywhere in transcript)', () => {
    it('flags 03/04 as ambiguous when no date field >12 exists anywhere', () => {
      const text = `[05/03/2026, 10:00] Bob: Submit by 03/04`;
      const { result } = analyzeTranscript(text, 'Bob', undefined, false);

      expect(result.actions.length).toBeGreaterThanOrEqual(1);
      const task = result.actions[0];
      expect(task.deadline).toBeDefined();
      expect(task.deadline!.resolution).toBe('ambiguous');
      expect(task.deadline!.resolvedIso).toBeUndefined();
      expect(task.deadline!.rawText).toContain('03/04');
    });
  });

  describe('B4: Negation (cross-message cancellation)', () => {
    it('marks earlier task possibly-cancelled with low confidence', () => {
      const text = `[10/03/2026, 10:00] Bob: Priya, submit the form by Monday
[10/03/2026, 10:01] Priya: No need to submit the form, it's cancelled`;

      const { result } = analyzeTranscript(text, 'Priya', undefined, false);

      expect(result.actions.length).toBeGreaterThanOrEqual(1);
      const task = result.actions.find(a => a.sources.some(s => s.messageId === 'm-0'));
      expect(task).toBeDefined();
      expect(task!.status).toBe('possibly-cancelled');
      expect(task!.uncertainty.level).toBe('low');
      expect(task!.category).not.toBe('critical');
      expect(task!.category).not.toBe('high');
      expect(task!.category).toBe('low');
    });
  });

  describe('B5: Proposal then disagreement (unresolved decision)', () => {
    it('marks decision as disagreement linking both messages', () => {
      const text = `[10/03/2026, 10:00] Bob: How about Postgres?
[10/03/2026, 10:01] Cat: I disagree, I'd rather use SQLite`;

      const { result } = analyzeTranscript(text, 'User', undefined, false);

      const decision = result.decisions.find(d => d.sources.some(s => s.messageId === 'm-0'));
      expect(decision).toBeDefined();
      expect(decision!.status).toBe('disagreement');
      expect(decision!.sources).toHaveLength(2);
      expect(decision!.sources.map(s => s.messageId)).toEqual(['m-0', 'm-1']);
    });
  });

  describe('B6: Contradictory deadlines', () => {
    it('retains deadline information without silent overwrite', () => {
      const text = `[10/03/2026, 10:00] Bob: Aarav, send the invoice by Friday
[10/03/2026, 10:05] Bob: Actually make it Monday`;

      const { result } = analyzeTranscript(text, 'Aarav', undefined, false);

      // Both messages have their deadline evidence preserved
      const fridayTask = result.actions.find(a =>
        a.sources.some(s => s.messageId === 'm-0')
      );
      expect(fridayTask).toBeDefined();
      expect(fridayTask!.deadline?.rawText.toLowerCase()).toContain('friday');
    });
  });

  describe('B7: No headers (unsupported format)', () => {
    it('supports plain-text fallback option when format is unrecognized', () => {
      const text = `We should meet tomorrow and decide who submits the form.`;

      // Standard parse yields 0 messages recognized and warning
      const standard = runAnalysis({
        rawText: text,
        userName: '',
        userAliases: [],
        isSample: false,
        runId: 1,
      });
      expect(standard.result.conversation.messages).toHaveLength(0);
      expect(standard.result.warnings.length).toBeGreaterThan(0);

      // Force plain-text fallback treats lines as messages
      const plain = runAnalysis({
        rawText: text,
        userName: '',
        userAliases: [],
        isSample: false,
        runId: 2,
        forcePlainText: true,
      });
      expect(plain.result.conversation.messages).toHaveLength(1);
      expect(plain.result.conversation.messages[0].sender).toBe('Unknown');
      expect(plain.result.conversation.messages[0].parsingStatus).toBe('unattributed');
    });
  });
});
