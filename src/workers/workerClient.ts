/**
 * Client controller for the analysis Web Worker.
 * Handles lifecycle, message dispatching, stage progress, cancellation,
 * and stale-result discarding by runId per PRD §17.8 and §18.2.
 */

import { AnalysisOptions, AnalysisPipelineResult, runAnalysis } from '../analysis/pipeline';
import { AnalysisStage, WorkerRequest, WorkerResponse } from './types';
import { ErrorCode } from '../types/model';

export interface AnalysisCallbacks {
  onStage?: (stage: AnalysisStage) => void;
  onSuccess: (result: AnalysisPipelineResult) => void;
  onError: (error: string, code: ErrorCode) => void;
  onCancel?: () => void;
}

export class AnalysisWorkerClient {
  private worker: Worker | null = null;
  private currentRunId: number = 0;
  private activeCallbacks: AnalysisCallbacks | null = null;
  private fallbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Start asynchronous analysis. If an existing analysis is running, it is cancelled first.
   */
  public startAnalysis(options: AnalysisOptions, callbacks: AnalysisCallbacks): void {
    // Cancel any ongoing job
    this.cancelAnalysis();

    this.currentRunId = options.runId;
    this.activeCallbacks = callbacks;

    if (typeof Worker !== 'undefined') {
      this.startInWorker(options);
    } else {
      this.startInMainThreadFallback(options);
    }
  }

  /**
   * Cancel any in-progress analysis immediately.
   * Terminates the worker and discards pending messages.
   */
  public cancelAnalysis(): void {
    if (this.fallbackTimeoutId !== null) {
      clearTimeout(this.fallbackTimeoutId);
      this.fallbackTimeoutId = null;
    }

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (this.activeCallbacks?.onCancel) {
      this.activeCallbacks.onCancel();
    }

    // Invalidate current run ID so late responses are ignored
    this.currentRunId++;
    this.activeCallbacks = null;
  }

  /**
   * Terminate the worker instance and release resources.
   */
  public terminate(): void {
    this.cancelAnalysis();
  }

  /**
   * Check if an analysis is currently running.
   */
  public isRunning(): boolean {
    return this.activeCallbacks !== null;
  }

  private startInWorker(options: AnalysisOptions): void {
    try {
      this.worker = new Worker(
        new URL('./analysis.worker.ts', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const data = event.data;
        if (!data || data.runId !== this.currentRunId) {
          // Stale response from cancelled or prior run: discard
          return;
        }

        const callbacks = this.activeCallbacks;
        if (!callbacks) return;

        switch (data.type) {
          case 'STAGE_PROGRESS':
            callbacks.onStage?.(data.stage);
            break;

          case 'ANALYSIS_COMPLETE':
            this.activeCallbacks = null;
            if (this.worker) {
              this.worker.terminate();
              this.worker = null;
            }
            callbacks.onSuccess(data.payload);
            break;

          case 'ANALYSIS_ERROR':
            this.activeCallbacks = null;
            if (this.worker) {
              this.worker.terminate();
              this.worker = null;
            }
            callbacks.onError(data.error, data.code);
            break;
        }
      };

      this.worker.onerror = () => {
        const callbacks = this.activeCallbacks;
        this.activeCallbacks = null;
        if (this.worker) {
          this.worker.terminate();
          this.worker = null;
        }
        callbacks?.onError(
          'Analysis failed. Nothing was sent anywhere. Try again.',
          'E-ANA-INTERNAL'
        );
      };

      const request: WorkerRequest = {
        type: 'START_ANALYSIS',
        options,
      };
      this.worker.postMessage(request);
    } catch {
      // If module worker instantiation fails (e.g. strict CSP or test environment), fallback
      this.startInMainThreadFallback(options);
    }
  }

  private startInMainThreadFallback(options: AnalysisOptions): void {
    const runId = options.runId;
    const callbacks = this.activeCallbacks;
    if (!callbacks) return;

    callbacks.onStage?.('parsing');

    this.fallbackTimeoutId = setTimeout(() => {
      this.fallbackTimeoutId = null;
      if (runId !== this.currentRunId || !this.activeCallbacks) {
        return; // Stale or cancelled
      }

      try {
        callbacks.onStage?.('validating');
        const payload = runAnalysis(options);

        if (runId !== this.currentRunId || !this.activeCallbacks) {
          return; // Cancelled during analysis
        }

        this.activeCallbacks = null;
        callbacks.onSuccess(payload);
      } catch (err) {
        if (runId !== this.currentRunId || !this.activeCallbacks) {
          return;
        }
        this.activeCallbacks = null;
        const isBinary = err instanceof Error && err.message === 'E-IMP-BINARY';
        const code: ErrorCode = isBinary ? 'E-IMP-BINARY' : 'E-ANA-INTERNAL';
        const errMsg = isBinary
          ? 'This file does not look like plain text (binary data detected).'
          : 'Analysis failed. Nothing was sent anywhere. Try again.';
        callbacks.onError(errMsg, code);
      }
    }, 0);
  }
}
