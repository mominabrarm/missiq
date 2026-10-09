import React from 'react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

interface WelcomeViewProps {
  onStart: () => void;
  onLoadSample: () => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onStart, onLoadSample }) => {
  return (
    <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-mint-dim border border-mint/30 text-mint text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-mint animate-pulse" />
          <span>ProtocolX Hackathon MVP</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ice tracking-tight leading-tight">
          Miss less. <span className="text-transparent bg-clip-text bg-gradient-to-r from-mint via-mint-hover to-info">Know more.</span>
        </h1>

        <p className="text-lg sm:text-xl text-ice-muted max-w-2xl mx-auto font-normal leading-relaxed">
          Your private chat intelligence. Turn 300+ unread group chat messages into an <strong className="text-ice font-semibold">evidence-backed briefing</strong> in seconds — completely inside your browser.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button size="lg" onClick={onStart} className="w-full sm:w-auto shadow-xl shadow-mint/15">
            Start a briefing
            <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Button>

          <Button size="lg" variant="outline" onClick={onLoadSample} className="w-full sm:w-auto">
            Try synthetic sample
          </Button>
        </div>
      </section>

      {/* 3 Core Value Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card hoverable className="space-y-3">
          <div className="w-10 h-10 rounded-xl bg-mint-dim border border-mint/30 flex items-center justify-center text-mint">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-semibold text-lg text-ice">Evidence-First</h2>
          <p className="text-sm text-ice-muted leading-relaxed">
            Every task, deadline, and decision directly links back to its exact source message and line range. No invented facts.
          </p>
        </Card>

        <Card hoverable className="space-y-3">
          <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/30 flex items-center justify-center text-info">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="font-semibold text-lg text-ice">Explainable Priority</h2>
          <p className="text-sm text-ice-muted leading-relaxed">
            Deadlines, mentions, and assignments are ranked with visible human-readable reason tags. Urgency words alone don't elevate priority.
          </p>
        </Card>

        <Card hoverable className="space-y-3">
          <div className="w-10 h-10 rounded-xl bg-warn/10 border border-warn/30 flex items-center justify-center text-warn">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="font-semibold text-lg text-ice">100% Local Privacy</h2>
          <p className="text-sm text-ice-muted leading-relaxed">
            Analysis runs in your browser memory. Your chat transcript is never sent to cloud servers, third-party AI APIs, or persistent web storage.
          </p>
        </Card>
      </section>

      {/* Privacy Disclosure Box */}
      <section className="bg-graphite/60 border border-graphite-surface rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3 text-mint font-semibold">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3>How Missiq Protects Your Privacy</h3>
        </div>
        <p className="text-sm text-ice-muted leading-relaxed">
          Missiq analyzes your conversation in your browser. Your chat text isn't uploaded to a server or an AI service. Missiq's own files are downloaded from the website when you open it. Derived insights live in RAM and can be wiped instantly with one click.
        </p>

        <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-ice-muted">
          <span className="px-2.5 py-1 rounded bg-graphite-surface border border-graphite-surface/60">Supported: WhatsApp, Mobile export, ISO, Plain text</span>
          <span className="px-2.5 py-1 rounded bg-graphite-surface border border-graphite-surface/60">Limits: 1,000,000 chars / 20,000 lines</span>
        </div>
      </section>
    </main>
  );
};
