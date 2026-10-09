import React, { useEffect } from 'react';
import { Conversation, ParsedMessage, SourceRef } from '../../types/model';
import { Button } from '../common/Button';

interface SourceDrawerProps {
  sourceRef: SourceRef;
  conversation: Conversation;
  onClose: () => void;
}

export const SourceDrawer: React.FC<SourceDrawerProps> = ({
  sourceRef,
  conversation,
  onClose,
}) => {
  const [showSurroundingContext, setShowSurroundingContext] = React.useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const targetMessage = conversation.messages.find((m) => m.id === sourceRef.messageId);
  const totalMessages = conversation.messages.length;

  if (!targetMessage) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-drawer-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-midnight/80 backdrop-blur-sm"
      >
        <div className="bg-graphite border border-graphite-surface rounded-2xl p-6 max-w-md w-full space-y-4">
          <h2 id="source-drawer-title" className="text-lg font-bold text-ice">Source Not Found</h2>
          <p className="text-sm text-ice-muted">The referenced message could not be located in this transcript.</p>
          <Button variant="secondary" onClick={onClose} className="w-full">Close</Button>
        </div>
      </div>
    );
  }

  const messageIndex = conversation.messages.findIndex((m) => m.id === targetMessage.id);
  const beforeMessages: ParsedMessage[] = showSurroundingContext && messageIndex > 0
    ? conversation.messages.slice(Math.max(0, messageIndex - 2), messageIndex)
    : [];
  const afterMessages: ParsedMessage[] = showSurroundingContext && messageIndex < totalMessages - 1
    ? conversation.messages.slice(messageIndex + 1, Math.min(totalMessages, messageIndex + 3))
    : [];

  const renderMessageContent = (msg: ParsedMessage, highlightSpan?: SourceRef['span']) => {
    const text = msg.text;
    if (highlightSpan && highlightSpan.start >= 0 && highlightSpan.end <= text.length && highlightSpan.start < highlightSpan.end) {
      const before = text.substring(0, highlightSpan.start);
      const highlighted = text.substring(highlightSpan.start, highlightSpan.end);
      const after = text.substring(highlightSpan.end);

      return (
        <span className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {before}
          <mark className="bg-mint/20 text-mint border-b border-mint font-semibold px-1 py-0.5 rounded">
            {highlighted}
          </mark>
          {after}
        </span>
      );
    }

    return (
      <span className="font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {text}
      </span>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="source-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-midnight/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl h-full bg-graphite border-l border-graphite-surface shadow-2xl flex flex-col p-6 overflow-y-auto space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-graphite-surface/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-mint-dim text-mint border border-mint/30">
                Message {targetMessage.sourceIndex + 1} of {totalMessages}
              </span>
              <span className="text-xs font-mono text-ice-muted">
                Lines {targetMessage.lineStart}–{targetMessage.lineEnd}
              </span>
            </div>
            <h2 id="source-drawer-title" className="text-xl font-bold text-ice mt-2">
              Source Message Inspection
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-ice-muted hover:text-ice rounded-lg hover:bg-graphite-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            aria-label="Close source drawer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Target Message Card */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-ice-muted">
            <span className="font-semibold text-ice text-sm">
              {targetMessage.sender || 'Unattributed message'}
            </span>
            <span>
              {targetMessage.timestamp?.raw || 'No timestamp'}
            </span>
          </div>

          {/* Context: Preceding messages */}
          {beforeMessages.length > 0 && (
            <div className="space-y-2 opacity-60">
              <span className="text-[11px] font-mono text-ice-muted block">Preceding context:</span>
              {beforeMessages.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-midnight/60 border border-graphite-surface text-xs space-y-1">
                  <div className="flex justify-between text-ice-muted/70 text-[11px]">
                    <span className="font-semibold">{m.sender || 'Unknown'}</span>
                    <span>{m.timestamp?.raw || ''}</span>
                  </div>
                  <div className="text-ice-muted font-mono">{m.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* Target Message Content */}
          <div className="p-4 rounded-xl bg-midnight border-2 border-mint/40 shadow-lg text-ice space-y-2">
            <div className="flex items-center justify-between text-xs text-mint font-semibold">
              <span>Primary Evidence</span>
              {sourceRef.span && (
                <span className="text-[11px] font-mono text-mint/80 bg-mint-dim px-2 py-0.5 rounded">
                  Highlighted span [{sourceRef.span.start}..{sourceRef.span.end}]
                </span>
              )}
            </div>
            <div>{renderMessageContent(targetMessage, sourceRef.span)}</div>
          </div>

          {/* Context: Subsequent messages */}
          {afterMessages.length > 0 && (
            <div className="space-y-2 opacity-60">
              <span className="text-[11px] font-mono text-ice-muted block">Subsequent context:</span>
              {afterMessages.map((m) => (
                <div key={m.id} className="p-3 rounded-xl bg-midnight/60 border border-graphite-surface text-xs space-y-1">
                  <div className="flex justify-between text-ice-muted/70 text-[11px]">
                    <span className="font-semibold">{m.sender || 'Unknown'}</span>
                    <span>{m.timestamp?.raw || ''}</span>
                  </div>
                  <div className="text-ice-muted font-mono">{m.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Toggle Context Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSurroundingContext(!showSurroundingContext)}
            className="w-full text-xs"
          >
            {showSurroundingContext ? 'Hide surrounding messages' : 'Show surrounding conversation (±2 messages)'}
          </Button>
        </div>

        {/* Privacy Note */}
        <div className="mt-auto pt-6 border-t border-graphite-surface/60 text-xs text-ice-muted flex items-center gap-2">
          <svg className="w-4 h-4 text-mint flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>All text rendered strictly from local memory without cloud analysis.</span>
        </div>
      </div>
    </div>
  );
};
