import React from 'react';
import { ProcessingStatus } from '../../types/model';

interface StatusChipProps {
  status: ProcessingStatus;
}

export const StatusChip: React.FC<StatusChipProps> = ({ status }) => {
  let label = 'Ready — nothing loaded';
  let badgeColor = 'bg-graphite-surface text-ice-muted border-graphite-surface';
  let dotColor = 'bg-ice-muted';

  if (status.phase === 'analyzing') {
    label = `Analyzing locally (${status.mode === 'on-device-model' ? 'on-device model' : 'rule-based'})...`;
    badgeColor = 'bg-mint-dim text-mint border-mint/30';
    dotColor = 'bg-mint animate-pulse';
  } else if (status.phase === 'complete') {
    if (status.mode === 'on-device-model' && status.modelName) {
      label = `On-device model: ${status.modelName} (runs in your browser)`;
      badgeColor = 'bg-mint-dim text-mint border-mint/40';
      dotColor = 'bg-mint';
    } else {
      label = 'Analyzed locally · Rule-based, no AI model';
      badgeColor = 'bg-graphite-surface text-mint border-mint/30';
      dotColor = 'bg-mint';
    }
  } else if (status.phase === 'cleared') {
    label = 'Data cleared';
    badgeColor = 'bg-graphite-surface text-ice-muted border-graphite-surface';
    dotColor = 'bg-ice-muted';
  } else if (status.phase === 'error') {
    label = `Analysis failed (${status.code}) — no data was sent anywhere`;
    badgeColor = 'bg-danger/10 text-danger border-danger/30';
    dotColor = 'bg-danger';
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${badgeColor}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span>{label}</span>
    </div>
  );
};
