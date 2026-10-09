import { describe, it, expect } from 'vitest';
import { extractDeadlines } from '../../src/analysis/extract/dates';
import { detectMentions } from '../../src/analysis/extract/mentions';
import { extractDecisions } from '../../src/analysis/extract/decisions';
import { extractTopics } from '../../src/analysis/extract/topics';
import { prioritize } from '../../src/analysis/prioritize';
import { ParsedMessage } from '../../src/types/model';

describe('Deterministic Extraction Modules & Prioritization Rules', () => {
  describe('Dates and Deadlines (FR-009)', () => {
    it('resolves relative weekday against reference date', () => {
      const messages: ParsedMessage[] = [{
        id: 'm-0',
        sourceIndex: 0,
        lineStart: 1,
        lineEnd: 1,
        sender: 'Bob',
        text: 'Submit the proposal by Friday',
        parsingStatus: 'parsed',
        timestamp: { raw: '10/03/2026, 10:00', iso: '2026-03-10T10:00:00', ambiguous: false },
        mentions: [],
      }];
      // 10/03/2026 is Tuesday. Next Friday is 13/03/2026.
      const candidates = extractDeadlines(messages, 'DD/MM');
      expect(candidates).toHaveLength(1);
      expect(candidates[0].deadline.resolvedIso).toBe('2026-03-13');
      expect(candidates[0].deadline.resolution).toBe('relative-resolved');
    });

    it('resolves named month dates with absolute resolution', () => {
      const messages: ParsedMessage[] = [{
        id: 'm-0',
        sourceIndex: 0,
        lineStart: 1,
        lineEnd: 1,
        sender: 'Bob',
        text: 'Conference is on 15 April 2026',
        parsingStatus: 'parsed',
        mentions: [],
      }];
      const candidates = extractDeadlines(messages, 'DD/MM');
      expect(candidates).toHaveLength(1);
      expect(candidates[0].deadline.resolvedIso).toBe('2026-04-15');
      expect(candidates[0].deadline.resolution).toBe('absolute');
    });
  });

  describe('Mentions (FR-014)', () => {
    it('detects @-handles and possessive forms', () => {
      const messages: ParsedMessage[] = [
        {
          id: 'm-0',
          sourceIndex: 0,
          lineStart: 1,
          lineEnd: 1,
          sender: 'Bob',
          text: '@Alice please check this out',
          parsingStatus: 'parsed',
          mentions: [],
        },
        {
          id: 'm-1',
          sourceIndex: 1,
          lineStart: 2,
          lineEnd: 2,
          sender: 'Bob',
          text: "Alice's review is required",
          parsingStatus: 'parsed',
          mentions: [],
        },
      ];
      const result = detectMentions(messages, 'Alice', [], ['Bob', 'Alice']);
      expect(result.mentions).toHaveLength(2);
      expect(result.mentions[0].kind).toBe('at-handle');
      expect(result.mentions[1].kind).toBe('name');
    });

    it('flags ambiguous participants when multiple participants share first token with user', () => {
      const messages: ParsedMessage[] = [{
        id: 'm-0',
        sourceIndex: 0,
        lineStart: 1,
        lineEnd: 1,
        sender: 'Boss',
        text: 'Sam, please update the slides',
        parsingStatus: 'parsed',
        mentions: [],
      }];
      const participants = ['Sam K', 'Sam R', 'Boss'];
      const result = detectMentions(messages, 'Sam', [], participants);
      expect(result.ambiguousParticipants).toEqual(['Sam K', 'Sam R']);
      expect(result.mentions[0].ambiguous).toBe(true);
    });
  });

  describe('Decisions (FR-015)', () => {
    it('confirms a proposal followed by affirmative reply from different participant', () => {
      const messages: ParsedMessage[] = [
        {
          id: 'm-0',
          sourceIndex: 0,
          lineStart: 1,
          lineEnd: 1,
          sender: 'Alice',
          text: 'What if we deploy on Sunday?',
          parsingStatus: 'parsed',
          mentions: [],
        },
        {
          id: 'm-1',
          sourceIndex: 1,
          lineStart: 2,
          lineEnd: 2,
          sender: 'Bob',
          text: 'Sounds good 👍',
          parsingStatus: 'parsed',
          mentions: [],
        },
      ];
      const decisions = extractDecisions(messages);
      expect(decisions).toHaveLength(1);
      expect(decisions[0].status).toBe('confirmed');
      expect(decisions[0].sources.map(s => s.messageId)).toEqual(['m-0', 'm-1']);
    });

    it('supersedes earlier confirmed decision on the same topic key (R-DEC-07)', () => {
      const messages: ParsedMessage[] = [
        {
          id: 'm-0',
          sourceIndex: 0,
          lineStart: 1,
          lineEnd: 1,
          sender: 'Alice',
          text: 'Decision: hosting will be on AWS cloud architecture',
          parsingStatus: 'parsed',
          mentions: [],
        },
        {
          id: 'm-1',
          sourceIndex: 1,
          lineStart: 2,
          lineEnd: 2,
          sender: 'Bob',
          text: 'Final decision: hosting will be on Google cloud architecture',
          parsingStatus: 'parsed',
          mentions: [],
        },
      ];
      const decisions = extractDecisions(messages);
      expect(decisions).toHaveLength(2);
      const earlier = decisions.find(d => d.sources.some(s => s.messageId === 'm-0'));
      const later = decisions.find(d => d.sources.some(s => s.messageId === 'm-1'));
      expect(earlier!.supersededBy).toBe(later!.id);
      expect(later!.supersededBy).toBeUndefined();
    });
  });

  describe('Prioritization Rules (R-PRI-01..12)', () => {
    it('R-PRI-03: caps urgency markers alone at Medium', () => {
      const insights = prioritize({
        actions: [{
          id: 'a-0',
          kind: 'unassigned-request',
          description: 'URGENT!! Everyone check the document',
          category: 'medium',
          basis: 'explicit',
          reasons: [],
          sources: [{ messageId: 'm-0' }],
          status: 'open',
          uncertainty: { level: 'medium', notes: [] },
        }],
        decisions: [],
        mentions: [],
        deadlines: [],
        announcements: [],
        questions: [],
        userName: 'Aarav',
        referenceDateIso: undefined,
        messageTexts: new Map([['m-0', 'URGENT!! Everyone check the document']]),
      });

      expect(insights).toHaveLength(1);
      expect(insights[0].category).toBe('medium');
      expect(insights[0].reasons.some(r => r.ruleId === 'R-PRI-03')).toBe(true);
    });

    it('R-PRI-07 vs R-PRI-08: explicit marker confirmed decision gets High, unflagged gets Medium', () => {
      const insights = prioritize({
        actions: [],
        decisions: [
          {
            id: 'd-0',
            status: 'confirmed',
            summary: 'Decision: final architecture approved',
            sources: [{ messageId: 'm-0' }],
            uncertainty: { level: 'high', notes: [] },
          },
          {
            id: 'd-1',
            status: 'confirmed',
            summary: 'We agreed on the design',
            sources: [{ messageId: 'm-1' }],
            uncertainty: { level: 'high', notes: [] },
          },
        ],
        mentions: [],
        deadlines: [],
        announcements: [],
        questions: [],
        userName: 'Aarav',
        referenceDateIso: undefined,
        messageTexts: new Map([
          ['m-0', 'Decision: final architecture approved'],
          ['m-1', 'We agreed on the design'],
        ]),
      });

      const d0Insight = insights.find(i => i.relatedId === 'd-0');
      const d1Insight = insights.find(i => i.relatedId === 'd-1');
      expect(d0Insight!.category).toBe('high');
      expect(d0Insight!.reasons.some(r => r.ruleId === 'R-PRI-07')).toBe(true);
      expect(d1Insight!.category).toBe('medium');
      expect(d1Insight!.reasons.some(r => r.ruleId === 'R-PRI-08')).toBe(true);
    });
  });

  describe('Topic & Term Frequency (FR-010 / §17.6)', () => {
    it('extracts recurring terms ignoring stop words', () => {
      const messages: ParsedMessage[] = [
        { id: 'm-0', sourceIndex: 0, lineStart: 1, lineEnd: 1, sender: 'A', text: 'database migration is ready', parsingStatus: 'parsed', mentions: [] },
        { id: 'm-1', sourceIndex: 1, lineStart: 2, lineEnd: 2, sender: 'B', text: 'database migration testing started', parsingStatus: 'parsed', mentions: [] },
        { id: 'm-2', sourceIndex: 2, lineStart: 3, lineEnd: 3, sender: 'C', text: 'database migration finished successfully', parsingStatus: 'parsed', mentions: [] },
      ];
      const topics = extractTopics(messages);
      expect(topics.length).toBeGreaterThanOrEqual(1);
      const dbTopic = topics.find(t => t.label.includes('database'));
      expect(dbTopic).toBeDefined();
      expect(dbTopic!.messageCount).toBe(3);
    });
  });
});
