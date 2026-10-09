import React from 'react';

export const PrivacyFooter: React.FC = () => {
  return (
    <footer className="border-t border-graphite-surface/40 bg-midnight/60 text-ice-muted text-xs py-6 px-4 lg:px-8 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div className="space-y-1 max-w-3xl">
          <p className="font-medium text-ice/90 flex items-center justify-center md:justify-start gap-1.5">
            <svg className="w-4 h-4 text-mint inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Privacy Guarantee
          </p>
          <p className="leading-relaxed">
            Missiq analyzes your conversation in your browser. Your chat text isn't uploaded to a server or an AI service. Missiq's own application files are downloaded from the website when you open it.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded bg-graphite border border-graphite-surface text-mint font-mono">
            Zero network API calls
          </span>
          <span className="text-ice-muted">v0.1.0 (Hackathon MVP)</span>
        </div>
      </div>
    </footer>
  );
};
