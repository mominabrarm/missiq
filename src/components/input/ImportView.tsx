import React, { useState, useRef, useId } from 'react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { MAX_CHARACTERS, MAX_LINES, MAX_FILE_BYTES, WARN_CHARACTERS, MAX_ALIASES } from '../../config/limits';
import { SAMPLE_TRANSCRIPT, SAMPLE_USER_NAME } from '../../testing/fixtures/sample';

interface ImportViewProps {
  rawText: string;
  userName: string;
  userAliases: string[];
  referenceDateIso?: string;
  isSample: boolean;
  onTextChange: (text: string, isSample?: boolean) => void;
  onIdentityChange: (name: string, aliases: string[], referenceDateIso?: string) => void;
  onAnalyze: () => void;
  onBackToWelcome: () => void;
}

export const ImportView: React.FC<ImportViewProps> = ({
  rawText,
  userName,
  userAliases,
  referenceDateIso,
  isSample,
  onTextChange,
  onIdentityChange,
  onAnalyze,
  onBackToWelcome,
}) => {
  const [fileError, setFileError] = useState<string | null>(null);
  const [showFormats, setShowFormats] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaId = useId();
  const nameInputId = useId();
  const aliasesInputId = useId();
  const dateInputId = useId();

  // Metrics
  const charCount = rawText.length;
  const lineCount = rawText ? rawText.split(/\r?\n/).length : 0;
  const isTooLongChars = charCount > MAX_CHARACTERS;
  const isTooLongLines = lineCount > MAX_LINES;
  const isNearLimit = charCount > WARN_CHARACTERS && !isTooLongChars;
  const isEmpty = rawText.trim().length === 0;

  // Validation
  let validationError: string | null = fileError;
  if (isTooLongChars) {
    validationError = `Transcript exceeds maximum length (${charCount.toLocaleString()} / ${MAX_CHARACTERS.toLocaleString()} characters allowed).`;
  } else if (isTooLongLines) {
    validationError = `Transcript exceeds maximum line limit (${lineCount.toLocaleString()} / ${MAX_LINES.toLocaleString()} lines allowed).`;
  }

  const canAnalyze = !isEmpty && !isTooLongChars && !isTooLongLines;

  const handleFileUpload = (file: File) => {
    setFileError(null);

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.txt') && file.type !== 'text/plain' && file.type !== '') {
      setFileError('Only .txt text export files are supported (PRD E-IMP-TYPE).');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is 5 MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        onTextChange(content, false);
      }
    };
    reader.onerror = () => {
      setFileError('Failed to read the file. Please try pasting the transcript text directly.');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleLoadSample = () => {
    setFileError(null);
    onTextChange(SAMPLE_TRANSCRIPT, true);
    onIdentityChange(SAMPLE_USER_NAME, [], '2026-03-10');
  };

  const handleClear = () => {
    setFileError(null);
    onTextChange('', false);
  };

  const handleAliasesChange = (val: string) => {
    const list = val
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, MAX_ALIASES);
    onIdentityChange(userName, list, referenceDateIso);
  };

  return (
    <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Navigation & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-graphite-surface/60 pb-6">
        <div>
          <button
            onClick={onBackToWelcome}
            className="text-xs text-ice-muted hover:text-mint inline-flex items-center gap-1.5 mb-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-mint rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Welcome
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-ice tracking-tight">
            Import Conversation
          </h1>
          <p className="text-sm text-ice-muted mt-1">
            Paste group chat messages or upload a plain <code className="text-mint font-mono text-xs">.txt</code> export.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadSample}
            type="button"
          >
            Load sample
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <svg className="w-4 h-4 mr-1 text-ice-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload .txt
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
                e.target.value = '';
              }
            }}
          />

          {rawText.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              type="button"
              className="text-ice-muted hover:text-danger"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Validation Error Banner */}
      {validationError && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm"
        >
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 font-medium">{validationError}</div>
        </div>
      )}

      {/* Warning Banner for near limit */}
      {isNearLimit && !validationError && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-warn/10 border border-warn/30 text-warn text-xs">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Transcript is large ({charCount.toLocaleString()} chars). Processing runs locally and may take a moment.</span>
        </div>
      )}

      {/* Main Grid: Input on Left, Identity & Settings on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Transcript Paste Area */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="text-sm font-semibold text-ice flex items-center gap-2"
            >
              <span>Chat Transcript</span>
              {isSample && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-mint-dim text-mint border border-mint/30">
                  Synthetic sample loaded
                </span>
              )}
            </label>

            {/* Counters */}
            <div className="text-xs font-mono text-ice-muted flex items-center gap-3">
              <span className={isTooLongChars ? 'text-danger font-semibold' : ''}>
                {charCount.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()} chars
              </span>
              <span>•</span>
              <span className={isTooLongLines ? 'text-danger font-semibold' : ''}>
                {lineCount.toLocaleString()} lines
              </span>
            </div>
          </div>

          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="relative rounded-2xl border border-graphite-surface bg-graphite/80 focus-within:border-mint transition-colors"
          >
            <textarea
              id={textareaId}
              value={rawText}
              onChange={(e) => {
                setFileError(null);
                onTextChange(e.target.value, false);
              }}
              placeholder={`Paste your chat messages here...\n\nExample formats supported:\n[10/03/2026, 09:12] Priya: Reminder: demo on Friday\n10/03/2026, 09:15 - Aarav: Got it, working on slides\n2026-03-10 09:20 Rohan: I'll review tonight`}
              rows={16}
              className="w-full bg-transparent p-4 text-sm font-mono text-ice placeholder:text-ice-muted/40 focus:outline-none resize-y leading-relaxed"
              aria-describedby="transcript-hints"
            />

            {isEmpty && (
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-graphite-surface/40 border border-graphite-surface flex items-center justify-center text-ice-muted mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-ice-muted">
                  Paste copied chat text, or drag and drop a .txt file here
                </p>
                <p className="text-xs text-ice-muted/60 mt-1">
                  WhatsApp, mobile exports, ISO timestamps, and bracketed chats supported
                </p>
              </div>
            )}
          </div>

          <div id="transcript-hints" className="flex items-center justify-between text-xs text-ice-muted pt-1">
            <span>All text remains in your browser's memory only.</span>
            <button
              type="button"
              onClick={() => setShowFormats(!showFormats)}
              className="text-mint hover:underline font-medium"
            >
              {showFormats ? 'Hide format examples' : 'View supported formats'}
            </button>
          </div>

          {showFormats && (
            <Card className="text-xs text-ice-muted space-y-2 mt-2 bg-midnight/90 border-graphite-surface">
              <h4 className="font-semibold text-ice">Supported Transcript Formats:</h4>
              <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                <li><strong className="text-mint">F1:</strong> <code>[10/03/2026, 09:12] Sender: message</code></li>
                <li><strong className="text-mint">F2:</strong> <code>10/03/2026, 09:12 - Sender: message</code></li>
                <li><strong className="text-mint">F3:</strong> <code>2026-03-10 09:12 Sender: message</code></li>
                <li><strong className="text-mint">F4:</strong> <code>[09:12] Sender: message</code></li>
                <li><strong className="text-mint">Fallback:</strong> Plain text (unattributed lines analyze safely)</li>
              </ul>
            </Card>
          )}
        </div>

        {/* Right Col: Personalization & Analyze Button */}
        <div className="space-y-6">
          <Card className="space-y-5">
            <h2 className="text-base font-semibold text-ice flex items-center gap-2">
              <svg className="w-4 h-4 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Personalization</span>
            </h2>
            <p className="text-xs text-ice-muted leading-relaxed">
              Tell Missiq who you are to prioritize tasks assigned to you and highlight your mentions.
            </p>

            {/* Your Name */}
            <div className="space-y-1.5">
              <label htmlFor={nameInputId} className="text-xs font-semibold text-ice">
                Your name in this chat
              </label>
              <input
                id={nameInputId}
                type="text"
                value={userName}
                onChange={(e) => onIdentityChange(e.target.value, userAliases, referenceDateIso)}
                placeholder="e.g. Aarav"
                maxLength={40}
                className="w-full bg-graphite-surface/60 border border-graphite-surface rounded-xl px-3 py-2 text-sm text-ice placeholder:text-ice-muted/50 focus:outline-none focus:border-mint"
              />
              <span className="text-[11px] text-ice-muted block">
                Matches messages where you are addressed or assigned.
              </span>
            </div>

            {/* Aliases */}
            <div className="space-y-1.5">
              <label htmlFor={aliasesInputId} className="text-xs font-semibold text-ice">
                Aliases / nicknames (comma-separated)
              </label>
              <input
                id={aliasesInputId}
                type="text"
                value={userAliases.join(', ')}
                onChange={(e) => handleAliasesChange(e.target.value)}
                placeholder="e.g. avi, @aarav"
                className="w-full bg-graphite-surface/60 border border-graphite-surface rounded-xl px-3 py-2 text-sm text-ice placeholder:text-ice-muted/50 focus:outline-none focus:border-mint"
              />
              <span className="text-[11px] text-ice-muted block">
                Up to 5 nicknames or @handles.
              </span>
            </div>

            {/* Reference Date */}
            <div className="space-y-1.5 pt-2 border-t border-graphite-surface/60">
              <label htmlFor={dateInputId} className="text-xs font-semibold text-ice flex items-center justify-between">
                <span>Reference date</span>
                <span className="text-[10px] text-ice-muted font-normal">(Optional)</span>
              </label>
              <input
                id={dateInputId}
                type="date"
                value={referenceDateIso || ''}
                onChange={(e) => onIdentityChange(userName, userAliases, e.target.value || undefined)}
                className="w-full bg-graphite-surface/60 border border-graphite-surface rounded-xl px-3 py-2 text-sm text-ice placeholder:text-ice-muted/50 focus:outline-none focus:border-mint"
              />
              <span className="text-[11px] text-ice-muted block">
                Used to resolve relative dates like "tomorrow" or "by Friday". Defaults to transcript's latest timestamp.
              </span>
            </div>
          </Card>

          {/* Analyze CTA Card */}
          <Card className="bg-gradient-to-b from-graphite to-midnight border-mint/20 p-5 space-y-4 shadow-xl">
            <div className="space-y-1">
              <h3 className="font-semibold text-sm text-ice">Ready to analyze</h3>
              <p className="text-xs text-ice-muted">
                Runs 100% locally in your browser memory.
              </p>
            </div>

            <Button
              size="lg"
              variant="primary"
              onClick={onAnalyze}
              disabled={!canAnalyze}
              className="w-full justify-center shadow-lg shadow-mint/20"
            >
              <svg className="w-5 h-5 mr-1 text-midnight" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Analyze messages
            </Button>

            {isEmpty && (
              <p className="text-center text-xs text-ice-muted">
                Paste text or click "Load sample" to begin.
              </p>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
};
