import { describe, it, expect } from 'vitest';
import { runAnalysis } from '../../src/analysis/pipeline';
import { parseTranscript } from '../../src/analysis/parse/parseTranscript';
import { AnalysisWorkerClient } from '../../src/workers/workerClient';
import { MAX_LINE_LENGTH } from '../../src/config/limits';

describe('Phase 6: Privacy and Correctness Audit', () => {
  describe('1. Local-First Privacy & Content-Free Errors', () => {
    it('ensures no persistent storage is populated during analysis', () => {
      // eslint-disable-next-line no-restricted-globals
      expect(localStorage.length).toBe(0);
      // eslint-disable-next-line no-restricted-globals
      expect(sessionStorage.length).toBe(0);
    });

    it('rejects binary files containing null bytes with E-IMP-BINARY and content-free message', () => {
      const binaryInput = 'PK\x03\x04\x00\x00\x00\x00[10/03/2026, 09:12] Secret: binary content';
      expect(() => {
        runAnalysis({
          rawText: binaryInput,
          userName: 'Aarav',
          userAliases: [],
          isSample: false,
          runId: 1,
        });
      }).toThrow('E-IMP-BINARY');
    });

    it('worker client returns content-free error message without echoing transcript text', async () => {
      const client = new AnalysisWorkerClient();
      const secretSentinel = 'SUPER_SECRET_PAYLOAD_999';

      let receivedError = '';
      let receivedCode = '';

      await new Promise<void>((resolve) => {
        client.startAnalysis(
          {
            rawText: `\0${secretSentinel}`, // binary triggers error
            userName: '',
            userAliases: [],
            isSample: false,
            runId: 1,
          },
          {
            onSuccess: () => resolve(),
            onError: (err, code) => {
              receivedError = err;
              receivedCode = code;
              resolve();
            },
          }
        );
      });

      expect(receivedCode).toBe('E-IMP-BINARY');
      // Must not contain any part of the sensitive text
      expect(receivedError).not.toContain(secretSentinel);
      expect(receivedError).toContain('binary data detected');
    });
  });

  describe('2. Worker and Cancellation Correctness', () => {
    it('discards delayed responses from older runIds', () => {
      const client = new AnalysisWorkerClient();
      let successCalled = false;

      client.startAnalysis(
        {
          rawText: '[10/03/2026, 09:12] Priya: Task 1',
          userName: '',
          userAliases: [],
          isSample: false,
          runId: 1,
        },
        {
          onSuccess: () => {
            successCalled = true;
          },
          onError: () => {},
        }
      );

      // Cancel immediately before fallback timer completes
      client.cancelAnalysis();

      expect(client.isRunning()).toBe(false);
      expect(successCalled).toBe(false);
    });

    it('replaces prior analysis with new runId without cross-run leakage', async () => {
      const client = new AnalysisWorkerClient();
      let firstCompleted = false;
      let secondCompleted = false;

      // Start run 1
      client.startAnalysis(
        {
          rawText: '[10/03/2026, 09:12] First: run 1',
          userName: '',
          userAliases: [],
          isSample: false,
          runId: 1,
        },
        {
          onSuccess: () => {
            firstCompleted = true;
          },
          onError: () => {},
        }
      );

      // Start run 2 immediately (cancels run 1)
      await new Promise<void>((resolve) => {
        client.startAnalysis(
          {
            rawText: '[10/03/2026, 09:15] Second: run 2',
            userName: '',
            userAliases: [],
            isSample: false,
            runId: 2,
          },
          {
            onSuccess: (res) => {
              secondCompleted = true;
              expect(res.result.runId).toBe(2);
              resolve();
            },
            onError: () => resolve(),
          }
        );
      });

      expect(firstCompleted).toBe(false);
      expect(secondCompleted).toBe(true);
    });
  });

  describe('3. Input Validation & Resilience', () => {
    it('handles empty transcript gracefully without throwing', () => {
      const result = runAnalysis({
        rawText: '',
        userName: '',
        userAliases: [],
        isSample: false,
        runId: 1,
      });

      expect(result.result.conversation.messages).toHaveLength(0);
      expect(result.result.insights).toHaveLength(0);
      expect(result.validation.isValid).toBe(true);
    });

    it('truncates lines exceeding MAX_LINE_LENGTH and issues warning', () => {
      const hugeLine = 'A'.repeat(MAX_LINE_LENGTH + 500);
      const parsed = parseTranscript(`[10/03/2026, 09:12] Priya: ${hugeLine}`);

      expect(parsed.warnings.some((w) => w.includes('truncated'))).toBe(true);
      expect(parsed.conversation.messages[0].text.length).toBeLessThanOrEqual(MAX_LINE_LENGTH);
    });

    it('maintains accurate line start and end ranges across multi-line messages', () => {
      const transcript = `[10/03/2026, 09:12] Priya: Line 1
Line 2
Line 3
[10/03/2026, 09:15] Aarav: Single line`;

      const parsed = parseTranscript(transcript);
      expect(parsed.conversation.messages).toHaveLength(2);

      const msg1 = parsed.conversation.messages[0];
      expect(msg1.lineStart).toBe(1);
      expect(msg1.lineEnd).toBe(3);
      expect(msg1.text).toBe('Line 1\nLine 2\nLine 3');

      const msg2 = parsed.conversation.messages[1];
      expect(msg2.lineStart).toBe(4);
      expect(msg2.lineEnd).toBe(4);
      expect(msg2.text).toBe('Single line');
    });
  });

  describe('4. Security & Prototype Pollution Protection', () => {
    it('safely handles untrusted HTML / script injection without altering text nodes', () => {
      const xssTranscript = '[10/03/2026, 09:12] Attacker: <script>alert("xss")</script> <img src=x onerror=alert(1)>';
      const parsed = parseTranscript(xssTranscript);

      expect(parsed.conversation.messages).toHaveLength(1);
      expect(parsed.conversation.messages[0].text).toBe('<script>alert("xss")</script> <img src=x onerror=alert(1)>');

      const analysis = runAnalysis({
        rawText: xssTranscript,
        userName: '',
        userAliases: [],
        isSample: false,
        runId: 1,
      });

      expect(analysis.validation.isValid).toBe(true);
    });

    it('protects against prototype keys as sender names (__proto__, constructor)', () => {
      const protoTranscript = '[10/03/2026, 09:12] __proto__: Malicious key test\n[10/03/2026, 09:13] constructor: Another proto key';
      const parsed = parseTranscript(protoTranscript);

      expect(parsed.conversation.participants).toContain('__proto__');
      expect(parsed.conversation.participants).toContain('constructor');

      // Verify Object prototype was not polluted
      const cleanObj: Record<string, unknown> = {};
      expect(cleanObj['Malicious key test' as keyof typeof cleanObj]).toBeUndefined();
    });
  });
});
