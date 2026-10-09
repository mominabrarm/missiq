import { describe, it, expect } from 'vitest';
import { parseTranscript, parseAsPlainText } from '../../src/analysis/parse/parseTranscript';
import { matchHeader } from '../../src/analysis/parse/headers';

describe('Transcript Formats & Parsing Engine (F1–F4)', () => {
  describe('Format F1: Bracketed timestamp + sender', () => {
    it('parses standard F1 line with 24h timestamp', () => {
      const line = '[12/03/2026, 14:05] Priya: Submit the deck by Friday';
      const match = matchHeader(line);
      expect(match).not.toBeNull();
      expect(match!.format).toBe('F1');
      expect(match!.sender).toBe('Priya');
      expect(match!.text).toBe('Submit the deck by Friday');
      expect(match!.rawTimestamp).toBe('12/03/2026, 14:05');
    });

    it('parses F1 line with 12h AM/PM timestamp', () => {
      const line = '[12/03/2026, 2:05 PM] Priya: Meeting at 3pm';
      const match = matchHeader(line);
      expect(match).not.toBeNull();
      expect(match!.format).toBe('F1');
      expect(match!.sender).toBe('Priya');
      expect(match!.text).toBe('Meeting at 3pm');
    });

    it('parses complete F1 conversation', () => {
      const text = `[12/03/2026, 14:05] Priya: Hello team
[12/03/2026, 14:06] Rohan: Hi Priya`;
      const { conversation } = parseTranscript(text);
      expect(conversation.stats.formatDetected).toBe('F1');
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].sender).toBe('Priya');
      expect(conversation.messages[1].sender).toBe('Rohan');
    });
  });

  describe('Format F2: Dash-style timestamp + sender (mobile export)', () => {
    it('parses standard F2 line', () => {
      const line = '12/03/2026, 14:05 - Priya: Submit the deck by Friday';
      const match = matchHeader(line);
      expect(match).not.toBeNull();
      expect(match!.format).toBe('F2');
      expect(match!.sender).toBe('Priya');
      expect(match!.text).toBe('Submit the deck by Friday');
      expect(match!.rawTimestamp).toBe('12/03/2026, 14:05');
    });

    it('parses complete F2 conversation', () => {
      const text = `12/03/2026, 14:05 - Priya: Update on project
12/03/2026, 14:06 - Rohan: Got it`;
      const { conversation } = parseTranscript(text);
      expect(conversation.stats.formatDetected).toBe('F2');
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].sender).toBe('Priya');
      expect(conversation.messages[1].sender).toBe('Rohan');
    });
  });

  describe('Format F3: ISO timestamp + sender', () => {
    it('parses standard ISO F3 line', () => {
      const line = '2026-03-12 14:05 Priya: Submit the deck by Friday';
      const match = matchHeader(line);
      expect(match).not.toBeNull();
      expect(match!.format).toBe('F3');
      expect(match!.sender).toBe('Priya');
      expect(match!.text).toBe('Submit the deck by Friday');
      expect(match!.rawTimestamp).toBe('2026-03-12 14:05');
    });

    it('parses ISO with T separator', () => {
      const line = '2026-03-12T14:05:00 Priya: Submit the deck';
      const match = matchHeader(line);
      expect(match).not.toBeNull();
      expect(match!.format).toBe('F3');
      expect(match!.sender).toBe('Priya');
      expect(match!.text).toBe('Submit the deck');
    });
  });

  describe('Format F4: Sender only (no timestamp)', () => {
    it('parses standard F4 line', () => {
      const line = 'Priya: Submit the deck by Friday';
      const match = matchHeader(line);
      expect(match).not.toBeNull();
      expect(match!.format).toBe('F4');
      expect(match!.sender).toBe('Priya');
      expect(match!.text).toBe('Submit the deck by Friday');
      expect(match!.rawTimestamp).toBeNull();
    });

    it('parses complete F4 conversation with no-timestamp status', () => {
      const text = `Priya: Good morning
Rohan: Hello!`;
      const { conversation } = parseTranscript(text);
      expect(conversation.stats.formatDetected).toBe('F4');
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].parsingStatus).toBe('no-timestamp');
    });
  });

  describe('Multiline Handling & Continuations', () => {
    it('attaches continuation lines to the preceding message', () => {
      const text = `[10/03/2026, 09:00] Alice: Here is the plan:
- item 1
- item 2
[10/03/2026, 09:05] Bob: Looks good`;
      const { conversation } = parseTranscript(text);
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].text).toBe('Here is the plan:\n- item 1\n- item 2');
      expect(conversation.messages[0].lineStart).toBe(1);
      expect(conversation.messages[0].lineEnd).toBe(3);
      expect(conversation.messages[1].lineStart).toBe(4);
      expect(conversation.messages[1].lineEnd).toBe(4);
    });
  });

  describe('Duplicate Detection (PRD §FR-008)', () => {
    it('flags identical consecutive message within DUPLICATE_WINDOW as duplicate', () => {
      const text = `[10/03/2026, 12:10] Karan: ok
[10/03/2026, 12:10] Karan: ok`;
      const { conversation } = parseTranscript(text);
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].isDuplicateOf).toBeUndefined();
      expect(conversation.messages[1].isDuplicateOf).toBe('m-0');
    });

    it('does not flag duplicate if sender is different', () => {
      const text = `[10/03/2026, 12:10] Karan: ok
[10/03/2026, 12:10] Meera: ok`;
      const { conversation } = parseTranscript(text);
      expect(conversation.messages[1].isDuplicateOf).toBeUndefined();
    });
  });

  describe('System Message Detection', () => {
    it('flags known system messages with kind system', () => {
      const text = `[10/03/2026, 09:00] System: Messages and calls are end-to-end encrypted.
[10/03/2026, 09:01] Alice: Hello!`;
      const { conversation } = parseTranscript(text);
      expect(conversation.messages[0].parsingStatus).toBe('system');
      expect(conversation.messages[1].parsingStatus).toBe('parsed');
      // System message sender should not be included in participants
      expect(conversation.participants).toEqual(['Alice']);
    });
  });

  describe('Plain Text Fallback (PRD §FR-004)', () => {
    it('parses arbitrary unformatted text as plain text', () => {
      const text = `We should meet tomorrow and decide who submits the form.
Make sure to test everything beforehand.`;
      const { conversation, warnings } = parseAsPlainText(text);
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].sender).toBe('Unknown');
      expect(conversation.messages[0].parsingStatus).toBe('unattributed');
      expect(conversation.stats.formatDetected).toBe('none');
      expect(warnings.length).toBeGreaterThan(0);
    });
  });
});
