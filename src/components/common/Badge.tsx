import React from 'react';
import { PriorityCategory, DecisionStatus, ActionKind } from '../../types/model';

export type BadgeCategory =
  | PriorityCategory
  | DecisionStatus
  | ActionKind
  | 'sample'
  | 'explicit'
  | 'inferred'
  | 'cancelled';

interface BadgeProps {
  category: BadgeCategory;
  label?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ category, label, className = '' }) => {
  let colorStyles = 'bg-graphite-surface text-ice-muted border-graphite-surface';
  let defaultLabel: string = category;

  switch (category) {
    case 'critical':
      colorStyles = 'bg-danger/15 text-danger border-danger/40';
      defaultLabel = 'Critical';
      break;
    case 'high':
      colorStyles = 'bg-warn/15 text-warn border-warn/40';
      defaultLabel = 'High';
      break;
    case 'medium':
      colorStyles = 'bg-info/15 text-info border-info/40';
      defaultLabel = 'Medium';
      break;
    case 'low':
      colorStyles = 'bg-graphite-surface text-ice-muted border-graphite-surface';
      defaultLabel = 'Low';
      break;
    case 'info':
      colorStyles = 'bg-graphite-surface text-ice-muted border-graphite-surface';
      defaultLabel = 'Info';
      break;
    case 'sample':
      colorStyles = 'bg-mint-dim text-mint border-mint/30 font-mono';
      defaultLabel = 'Sample data';
      break;
    case 'explicit':
      colorStyles = 'bg-mint/10 text-mint border-mint/20';
      defaultLabel = 'Explicit';
      break;
    case 'inferred':
      colorStyles = 'bg-info/10 text-info border-info/20';
      defaultLabel = 'Inferred';
      break;
    case 'cancelled':
      colorStyles = 'bg-danger/10 text-danger/80 border-danger/20 line-through';
      defaultLabel = 'Possibly cancelled';
      break;
    case 'confirmed':
      colorStyles = 'bg-mint-dim text-mint border-mint/30';
      defaultLabel = 'Confirmed';
      break;
    case 'proposal':
      colorStyles = 'bg-info/15 text-info border-info/30';
      defaultLabel = 'Proposal';
      break;
    case 'suggestion':
      colorStyles = 'bg-graphite-surface text-ice-muted border-graphite-surface';
      defaultLabel = 'Suggestion';
      break;
    case 'question':
      colorStyles = 'bg-warn/15 text-warn border-warn/30';
      defaultLabel = 'Question';
      break;
    case 'disagreement':
      colorStyles = 'bg-danger/15 text-danger border-danger/30';
      defaultLabel = 'Disagreement';
      break;
    case 'assigned-to-user':
      colorStyles = 'bg-mint-dim text-mint border-mint/40';
      defaultLabel = 'Assigned to you';
      break;
    case 'assigned-to-other':
      colorStyles = 'bg-info/10 text-info border-info/30';
      defaultLabel = 'Assigned';
      break;
    case 'commitment':
      colorStyles = 'bg-mint/10 text-mint border-mint/20';
      defaultLabel = 'Commitment';
      break;
    case 'unassigned-request':
      colorStyles = 'bg-warn/10 text-warn border-warn/20';
      defaultLabel = 'Unassigned';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${colorStyles} ${className}`}
    >
      {label || defaultLabel}
    </span>
  );
};
