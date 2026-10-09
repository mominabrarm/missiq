/**
 * Type contracts for Web Worker communication per PRD §17.3, §17.8.
 */

import { AnalysisOptions, AnalysisPipelineResult } from '../analysis/pipeline';
import { ErrorCode } from '../types/model';

export type AnalysisStage = 'parsing' | 'extracting' | 'prioritizing' | 'briefing' | 'validating';

export type WorkerRequest =
  | { type: 'START_ANALYSIS'; options: AnalysisOptions }
  | { type: 'CANCEL_ANALYSIS'; runId: number };

export type WorkerResponse =
  | { type: 'STAGE_PROGRESS'; stage: AnalysisStage; runId: number }
  | { type: 'ANALYSIS_COMPLETE'; payload: AnalysisPipelineResult; runId: number }
  | { type: 'ANALYSIS_ERROR'; error: string; code: ErrorCode; runId: number };
