import React from 'react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { AnalysisStage } from '../../workers/types';

interface AnalyzingViewProps {
  stage: AnalysisStage;
  onCancel: () => void;
}

interface StageStep {
  id: AnalysisStage;
  label: string;
  description: string;
}

const STAGES: StageStep[] = [
  {
    id: 'parsing',
    label: 'Parsing transcript',
    description: 'Detecting format (F1–F4), headers, and multi-line continuations',
  },
  {
    id: 'extracting',
    label: 'Extracting insights',
    description: 'Detecting action items, deadlines, decisions, and mentions',
  },
  {
    id: 'prioritizing',
    label: 'Calculating priorities',
    description: 'Evaluating deadlines, assignments, and explainable priority reasons',
  },
  {
    id: 'briefing',
    label: 'Assembling briefing',
    description: 'Structuring attention items, topic clusters, and coverage summary',
  },
  {
    id: 'validating',
    label: 'Verifying evidence',
    description: 'Validating source references against verbatim message text',
  },
];

export const AnalyzingView: React.FC<AnalyzingViewProps> = ({ stage, onCancel }) => {
  const currentStageIndex = STAGES.findIndex((s) => s.id === stage);
  const activeIndex = currentStageIndex === -1 ? 0 : currentStageIndex;

  return (
    <main id="main-content" className="max-w-2xl mx-auto px-4 sm:px-6 py-16 space-y-8 text-center">
      {/* Visual Indicator: Radar / Waveform animation */}
      <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-mint/20 animate-ping opacity-30" />
        <div className="absolute inset-2 rounded-full border border-mint/40 animate-pulse" />
        <div className="w-16 h-16 rounded-2xl bg-graphite border border-mint/50 flex items-center justify-center shadow-xl shadow-mint/10">
          <svg viewBox="0 0 100 100" className="w-10 h-10 text-mint animate-spin" style={{ animationDuration: '6s' }} fill="none" stroke="currentColor">
            <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
            <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="3" strokeOpacity="0.4" />
            <circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="4" strokeOpacity="0.8" />
            <path d="M 20 50 Q 35 30, 42 50 T 55 50 T 68 35 T 80 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="50" cy="50" r="5" fill="currentColor" />
          </svg>
        </div>
      </div>

      {/* Heading */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-ice tracking-tight">
          Analyzing conversation locally
        </h1>
        <p className="text-sm text-ice-muted max-w-md mx-auto">
          Running deterministic rule-based analysis inside a Web Worker. No messages leave your device.
        </p>
      </div>

      {/* Discrete Stage Progress Card */}
      <Card className="bg-graphite/90 border-graphite-surface text-left space-y-4 p-6">
        <div
          role="progressbar"
          aria-label="Analysis pipeline stage progress"
          aria-valuenow={activeIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STAGES.length}
          className="space-y-4"
        >
          {STAGES.map((s, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <div
                key={s.id}
                className={`flex items-start gap-3.5 transition-all duration-200 ${
                  isCurrent
                    ? 'text-ice'
                    : isCompleted
                    ? 'text-ice-muted'
                    : 'text-ice-muted/40'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {isCompleted ? (
                    <div className="w-6 h-6 rounded-full bg-mint/20 border border-mint/40 text-mint flex items-center justify-center">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className="w-6 h-6 rounded-full bg-mint-dim border border-mint text-mint flex items-center justify-center relative">
                      <span className="w-2 h-2 rounded-full bg-mint animate-ping absolute" />
                      <span className="w-2 h-2 rounded-full bg-mint" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-graphite-surface/50 border border-graphite-surface flex items-center justify-center text-xs font-mono">
                      {idx + 1}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isCurrent ? 'text-mint' : ''}`}>
                      {s.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[11px] font-mono text-mint px-2 py-0.5 rounded bg-mint-dim">
                        In progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ice-muted mt-0.5 leading-relaxed">
                    {s.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Cancel Button */}
      <div className="pt-2">
        <Button
          variant="outline"
          size="md"
          onClick={onCancel}
          className="text-ice-muted border-graphite-surface hover:text-danger hover:border-danger/40"
        >
          Cancel analysis
        </Button>
      </div>
    </main>
  );
};
