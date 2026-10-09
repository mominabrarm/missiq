import { useReducer, useRef, useEffect, useState } from 'react';
import { Header } from './components/layout/Header';
import { PrivacyFooter } from './components/layout/PrivacyFooter';
import { WelcomeView } from './components/welcome/WelcomeView';
import { ImportView } from './components/input/ImportView';
import { AnalyzingView } from './components/analysis/AnalyzingView';
import { ResultsView } from './components/results/ResultsView';
import { SourceDrawer } from './components/results/SourceDrawer';
import { AppState, ProcessingStatus, ErrorCode, SourceRef } from './types/model';
import { AnalysisWorkerClient } from './workers/workerClient';
import { AnalysisPipelineResult } from './analysis/pipeline';
import { AnalysisStage } from './workers/types';
import { SAMPLE_TRANSCRIPT, SAMPLE_USER_NAME } from './testing/fixtures/sample';

type Action =
  | { type: 'NAVIGATE'; view: AppState['view'] }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_SAMPLE' }
  | { type: 'SET_RAW_TEXT'; text: string; isSample?: boolean }
  | { type: 'SET_IDENTITY'; name: string; aliases: string[]; referenceDateIso?: string }
  | { type: 'START_ANALYSIS'; runId: number }
  | { type: 'STAGE_PROGRESS'; stage: AnalysisStage; runId: number }
  | { type: 'ANALYSIS_SUCCESS'; payload: AnalysisPipelineResult; runId: number }
  | { type: 'ANALYSIS_ERROR'; error: string; code: ErrorCode; runId: number }
  | { type: 'CANCEL_ANALYSIS' }
  | { type: 'TOGGLE_TASK_COMPLETED'; id: string }
  | { type: 'UNDO_TASK_COMPLETED'; id: string }
  | { type: 'CLEAR_UNDO' }
  | { type: 'SELECT_SOURCE'; source: SourceRef }
  | { type: 'CLOSE_SOURCE' };

const initialStatus: ProcessingStatus = { phase: 'idle' };

const initialState: AppState = {
  view: 'welcome',
  rawText: '',
  identity: { name: '', aliases: [] },
  isSample: false,
  runId: 0,
  status: initialStatus,
  completedIds: {},
  filters: { categories: [], kinds: [], completion: 'all', mineOnly: false },
};

function mapStageToStatusStage(stage: AnalysisStage): 'parse' | 'extract' | 'prioritize' | 'brief' {
  switch (stage) {
    case 'parsing':
      return 'parse';
    case 'extracting':
      return 'extract';
    case 'prioritizing':
      return 'prioritize';
    case 'briefing':
    case 'validating':
      return 'brief';
  }
}

function getStageProgress(stage: AnalysisStage): number {
  switch (stage) {
    case 'parsing':
      return 20;
    case 'extracting':
      return 40;
    case 'prioritizing':
      return 60;
    case 'briefing':
      return 80;
    case 'validating':
      return 100;
  }
}

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, view: action.view };

    case 'CLEAR_ALL':
      return {
        ...initialState,
        runId: state.runId + 1,
        view: 'cleared',
        status: { phase: 'cleared' },
      };

    case 'SET_SAMPLE':
      return {
        ...state,
        view: 'import',
        rawText: SAMPLE_TRANSCRIPT,
        identity: {
          name: SAMPLE_USER_NAME,
          aliases: [],
          referenceDateIso: '2026-03-10',
        },
        isSample: true,
        status: { phase: 'idle' },
      };

    case 'SET_RAW_TEXT':
      return {
        ...state,
        rawText: action.text,
        isSample: action.isSample ?? false,
      };

    case 'SET_IDENTITY':
      return {
        ...state,
        identity: {
          name: action.name,
          aliases: action.aliases,
          referenceDateIso: action.referenceDateIso,
        },
      };

    case 'START_ANALYSIS':
      return {
        ...state,
        view: 'analyzing',
        runId: action.runId,
        status: {
          phase: 'analyzing',
          mode: 'rule-based-local',
          stage: 'parse',
          progress: 10,
        },
      };

    case 'STAGE_PROGRESS':
      if (action.runId !== state.runId) return state;
      return {
        ...state,
        status: {
          phase: 'analyzing',
          mode: 'rule-based-local',
          stage: mapStageToStatusStage(action.stage),
          progress: getStageProgress(action.stage),
        },
      };

    case 'ANALYSIS_SUCCESS':
      if (action.runId !== state.runId) return state;
      return {
        ...state,
        view: 'results',
        status: { phase: 'complete', mode: 'rule-based-local' },
        result: action.payload.result,
      };

    case 'ANALYSIS_ERROR':
      if (action.runId !== state.runId) return state;
      return {
        ...state,
        view: 'import',
        status: { phase: 'error', code: action.code },
      };

    case 'CANCEL_ANALYSIS':
      return {
        ...state,
        view: 'import',
        status: { phase: 'idle' },
      };

    case 'TOGGLE_TASK_COMPLETED': {
      const nextCompleted = { ...state.completedIds };
      let nextUndo = state.undo;
      if (nextCompleted[action.id]) {
        delete nextCompleted[action.id];
        nextUndo = undefined;
      } else {
        nextCompleted[action.id] = true;
        nextUndo = { id: action.id, expiresAt: Date.now() + 8000 };
      }
      return { ...state, completedIds: nextCompleted, undo: nextUndo };
    }

    case 'UNDO_TASK_COMPLETED': {
      const nextCompleted = { ...state.completedIds };
      delete nextCompleted[action.id];
      return { ...state, completedIds: nextCompleted, undo: undefined };
    }

    case 'CLEAR_UNDO':
      return { ...state, undo: undefined };

    case 'SELECT_SOURCE':
      return { ...state, selectedSource: action.source };

    case 'CLOSE_SOURCE':
      return { ...state, selectedSource: undefined };

    default:
      return state;
  }
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [activeStage, setActiveStage] = useState<AnalysisStage>('parsing');
  const workerClientRef = useRef<AnalysisWorkerClient>(new AnalysisWorkerClient());

  // Clean up worker on unmount
  useEffect(() => {
    const client = workerClientRef.current;
    return () => {
      client.terminate();
    };
  }, []);

  // Clear undo state after timeout
  useEffect(() => {
    if (!state.undo) {
      return undefined;
    }
    const timer = setTimeout(() => {
      dispatch({ type: 'CLEAR_UNDO' });
    }, 8000);
    return () => {
      clearTimeout(timer);
    };
  }, [state.undo]);

  const hasData = state.rawText.length > 0 || state.result !== undefined || state.isSample;

  const handleStartAnalysis = () => {
    const nextRunId = state.runId + 1;
    setActiveStage('parsing');
    dispatch({ type: 'START_ANALYSIS', runId: nextRunId });

    workerClientRef.current.startAnalysis(
      {
        rawText: state.rawText,
        userName: state.identity.name,
        userAliases: state.identity.aliases,
        referenceDateIso: state.identity.referenceDateIso,
        isSample: state.isSample,
        runId: nextRunId,
      },
      {
        onStage: (stage) => {
          setActiveStage(stage);
          dispatch({ type: 'STAGE_PROGRESS', stage, runId: nextRunId });
        },
        onSuccess: (payload) => {
          dispatch({ type: 'ANALYSIS_SUCCESS', payload, runId: nextRunId });
        },
        onError: (error, code) => {
          dispatch({ type: 'ANALYSIS_ERROR', error, code, runId: nextRunId });
        },
        onCancel: () => {
          dispatch({ type: 'CANCEL_ANALYSIS' });
        },
      }
    );
  };

  const handleCancelAnalysis = () => {
    workerClientRef.current.cancelAnalysis();
    dispatch({ type: 'CANCEL_ANALYSIS' });
  };

  const handleClearAll = () => {
    workerClientRef.current.cancelAnalysis();
    dispatch({ type: 'CLEAR_ALL' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-midnight text-ice">
      {/* Header */}
      <Header
        status={state.status}
        hasData={hasData}
        onClearAll={handleClearAll}
        onNavigateHome={() => dispatch({ type: 'NAVIGATE', view: 'welcome' })}
      />

      {/* Main View Container */}
      <div className="flex-1">
        {state.view === 'welcome' && (
          <WelcomeView
            onStart={() => dispatch({ type: 'NAVIGATE', view: 'import' })}
            onLoadSample={() => dispatch({ type: 'SET_SAMPLE' })}
          />
        )}

        {state.view === 'import' && (
          <ImportView
            rawText={state.rawText}
            userName={state.identity.name}
            userAliases={state.identity.aliases}
            referenceDateIso={state.identity.referenceDateIso}
            isSample={state.isSample}
            onTextChange={(text, isSample) =>
              dispatch({ type: 'SET_RAW_TEXT', text, isSample })
            }
            onIdentityChange={(name, aliases, referenceDateIso) =>
              dispatch({ type: 'SET_IDENTITY', name, aliases, referenceDateIso })
            }
            onAnalyze={handleStartAnalysis}
            onBackToWelcome={() => dispatch({ type: 'NAVIGATE', view: 'welcome' })}
          />
        )}

        {state.view === 'analyzing' && (
          <AnalyzingView
            stage={activeStage}
            onCancel={handleCancelAnalysis}
          />
        )}

        {state.view === 'results' && state.result && (
          <ResultsView
            result={state.result}
            userName={state.identity.name}
            completedIds={state.completedIds}
            onToggleCompleted={(id) => dispatch({ type: 'TOGGLE_TASK_COMPLETED', id })}
            onUndoCompleted={(id) => dispatch({ type: 'UNDO_TASK_COMPLETED', id })}
            lastCompletedId={state.undo?.id}
            onSelectSource={(source) => dispatch({ type: 'SELECT_SOURCE', source })}
            onAnalyzeAnother={() => dispatch({ type: 'NAVIGATE', view: 'import' })}
            onClearAll={handleClearAll}
          />
        )}

        {state.view === 'cleared' && (
          <main className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-mint-dim border border-mint/30 text-mint flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-ice">Your data was cleared.</h1>
            <p className="text-sm text-ice-muted max-w-md mx-auto">
              All imported chat text, parsed messages, and derived results have been completely removed from memory.
            </p>
            <button
              onClick={() => dispatch({ type: 'NAVIGATE', view: 'welcome' })}
              className="px-5 py-2.5 bg-mint text-midnight font-semibold rounded-xl hover:bg-mint-hover transition-all"
            >
              Start new briefing
            </button>
          </main>
        )}
      </div>

      {/* Interactive Source Inspection Drawer */}
      {state.selectedSource && state.result && (
        <SourceDrawer
          sourceRef={state.selectedSource}
          conversation={state.result.conversation}
          onClose={() => dispatch({ type: 'CLOSE_SOURCE' })}
        />
      )}

      {/* Local Privacy Footer */}
      <PrivacyFooter />
    </div>
  );
}

export default App;
