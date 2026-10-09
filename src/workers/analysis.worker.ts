/**
 * Web Worker for isolated, non-blocking transcript analysis.
 * Per PRD §17.8 and §18.2: runs CPU-heavy analysis off the main thread.
 * Only processes in-memory requests; does not persist or transmit data.
 */

import { runAnalysis } from '../analysis/pipeline';
import { WorkerRequest, WorkerResponse } from './types';

// Web Worker message listener
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'START_ANALYSIS') {
    return;
  }

  const { options } = data;
  const runId = options.runId;

  try {
    // Stage 1: Parsing
    const progressParsing: WorkerResponse = {
      type: 'STAGE_PROGRESS',
      stage: 'parsing',
      runId,
    };
    self.postMessage(progressParsing);

    // Stage 2: Execute complete analysis pipeline
    const pipelineResult = runAnalysis(options);

    // Stage 3: Validating references
    const progressValidating: WorkerResponse = {
      type: 'STAGE_PROGRESS',
      stage: 'validating',
      runId,
    };
    self.postMessage(progressValidating);

    // Stage 4: Analysis complete
    const response: WorkerResponse = {
      type: 'ANALYSIS_COMPLETE',
      payload: pipelineResult,
      runId,
    };
    self.postMessage(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed unexpectedly';
    const errorResponse: WorkerResponse = {
      type: 'ANALYSIS_ERROR',
      error: message,
      code: 'E-ANA-INTERNAL',
      runId,
    };
    self.postMessage(errorResponse);
  }
};
