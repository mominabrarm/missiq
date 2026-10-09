import React from 'react';
import { StatusChip } from './StatusChip';
import { ProcessingStatus } from '../../types/model';

interface HeaderProps {
  status: ProcessingStatus;
  hasData: boolean;
  onClearAll?: () => void;
  onNavigateHome?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  hasData,
  onClearAll,
  onNavigateHome,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-midnight/90 backdrop-blur-md border-b border-graphite-surface/60 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand Identity */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-3 group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-mint rounded-lg p-1"
          aria-label="Missiq homepage"
        >
          <div className="w-9 h-9 rounded-xl bg-graphite border border-mint/30 flex items-center justify-center p-1.5 group-hover:border-mint transition-colors shadow-lg shadow-mint/5">
            <svg viewBox="0 0 100 100" className="w-full h-full text-mint" fill="none" stroke="currentColor">
              <title>Missiq Logo</title>
              <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
              <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="3" strokeOpacity="0.4" />
              <circle cx="50" cy="50" r="16" stroke="currentColor" strokeWidth="3" strokeOpacity="0.7" />
              <path d="M 20 50 Q 35 30, 42 50 T 55 50 T 68 35 T 80 50" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="50" cy="50" r="5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-ice tracking-tight group-hover:text-mint transition-colors">
                Missiq
              </span>
              <span className="hidden md:inline text-xs text-mint/80 font-mono px-2 py-0.5 rounded bg-mint-dim border border-mint/20">
                Local-first
              </span>
            </div>
            <p className="text-xs text-ice-muted">
              Miss less. Know more. <span className="hidden sm:inline">· Your private chat intelligence.</span>
            </p>
          </div>
        </button>

        {/* Right side: Status Chip and Clear Control */}
        <div className="flex items-center gap-3">
          <StatusChip status={status} />

          {hasData && onClearAll && (
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 text-xs font-semibold text-danger hover:text-white bg-danger/10 hover:bg-danger border border-danger/30 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-danger"
              aria-label="Clear all imported data and results"
            >
              Clear all data
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
