import { describe, it, expect, vi } from 'vitest';
import { AnalysisWorkerClient } from '../../src/workers/workerClient';
import { SAMPLE_TRANSCRIPT, SAMPLE_USER_NAME } from '../../src/testing/fixtures/sample';
import { AnalysisOptions } from '../../src/analysis/pipeline';

describe('AnalysisWorkerClient (Phase 4 Safe Execution & Cancellation)', () => {
  const defaultOptions: AnalysisOptions = {
    rawText: SAMPLE_TRANSCRIPT,
    userName: SAMPLE_USER_NAME,
    userAliases: [],
    isSample: true,
    runId: 1,
  };

  it('completes analysis and calls onSuccess with valid results', async () => {
    const client = new AnalysisWorkerClient();

    const result = await new Promise((resolve, reject) => {
      client.startAnalysis(defaultOptions, {
        onSuccess: (res) => resolve(res),
        onError: (err) => reject(new Error(err)),
      });
    });

    expect(result).toBeDefined();
    // @ts-expect-error inspect payload
    expect(result.result.conversation.messages).toHaveLength(17);
    // @ts-expect-error inspect validation
    expect(result.validation.isValid).toBe(true);
  });

  it('notifies onStage progress transitions', async () => {
    const client = new AnalysisWorkerClient();
    const stages: string[] = [];

    await new Promise((resolve) => {
      client.startAnalysis(defaultOptions, {
        onStage: (stage) => stages.push(stage),
        onSuccess: () => resolve(true),
        onError: () => resolve(false),
      });
    });

    expect(stages.length).toBeGreaterThanOrEqual(1);
    expect(stages).toContain('parsing');
  });

  it('cancels analysis cleanly and invokes onCancel callback', async () => {
    const client = new AnalysisWorkerClient();
    const onSuccess = vi.fn();
    const onCancel = vi.fn();

    client.startAnalysis(defaultOptions, {
      onSuccess,
      onError: vi.fn(),
      onCancel,
    });

    expect(client.isRunning()).toBe(true);
    client.cancelAnalysis();
    expect(client.isRunning()).toBe(false);
    expect(onCancel).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('discards stale results when a newer run is started', async () => {
    const client = new AnalysisWorkerClient();
    const results: number[] = [];

    // Start runId = 1
    client.startAnalysis(
      { ...defaultOptions, runId: 1 },
      {
        onSuccess: (res) => results.push(res.result.runId),
        onError: vi.fn(),
      }
    );

    // Immediately start runId = 2 (overriding runId = 1)
    await new Promise((resolve) => {
      client.startAnalysis(
        { ...defaultOptions, runId: 2 },
        {
          onSuccess: (res) => {
            results.push(res.result.runId);
            resolve(true);
          },
          onError: vi.fn(),
        }
      );
    });

    // Run 1 should have been cancelled/discarded; only Run 2 arrives
    expect(results).toEqual([2]);
  });
});
