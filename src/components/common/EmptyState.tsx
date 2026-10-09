import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl bg-graphite/40 border border-graphite-surface/50 my-6">
      <div className="w-14 h-14 rounded-2xl bg-graphite-surface/60 border border-graphite-surface flex items-center justify-center text-mint mb-4 shadow-inner">
        {icon || (
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1.01 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>

      <h3 className="text-lg font-semibold text-ice mb-2">{title}</h3>
      <p className="text-sm text-ice-muted max-w-md leading-relaxed mb-6">
        {description}
      </p>

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 text-sm font-semibold bg-mint text-midnight hover:bg-mint-hover rounded-xl shadow-lg shadow-mint/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
