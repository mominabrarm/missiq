import React, { useState } from 'react';
import { AnalysisResult, SourceRef } from '../../types/model';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Card } from '../common/Card';

interface ResultsViewProps {
  result: AnalysisResult;
  userName: string;
  completedIds: Record<string, true>;
  onToggleCompleted: (id: string) => void;
  onUndoCompleted?: (id: string) => void;
  lastCompletedId?: string | null;
  onSelectSource: (source: SourceRef) => void;
  onAnalyzeAnother: () => void;
  onClearAll: () => void;
}

type TabType = 'all' | 'attention' | 'tasks' | 'decisions' | 'mentions';

export const ResultsView: React.FC<ResultsViewProps> = ({
  result,
  userName,
  completedIds,
  onToggleCompleted,
  onUndoCompleted,
  lastCompletedId,
  onSelectSource,
  onAnalyzeAnother,
  onClearAll,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high-critical' | 'medium-low'>('all');
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'completed'>('all');
  const [mineOnly, setMineOnly] = useState(false);

  const { summary, conversation, actions, decisions, insights, mentions } = result;

  // Filter Tasks
  const filteredActions = actions.filter((action) => {
    // Task completion filter
    const isCompleted = !!completedIds[action.id];
    if (taskFilter === 'open' && isCompleted) return false;
    if (taskFilter === 'completed' && !isCompleted) return false;

    // Priority filter
    if (priorityFilter === 'high-critical' && action.category !== 'critical' && action.category !== 'high') {
      return false;
    }
    if (priorityFilter === 'medium-low' && (action.category === 'critical' || action.category === 'high')) {
      return false;
    }

    // Mine only filter
    if (mineOnly && userName) {
      const isAssignedToMe = action.kind === 'assigned-to-user' ||
        (action.assignee && action.assignee.toLowerCase() === userName.toLowerCase());
      if (!isAssignedToMe) return false;
    }

    return true;
  });

  // Filter Attention Items
  const attentionInsights = insights.filter((i) => {
    if (i.category !== 'critical' && i.category !== 'high') return false;
    if (mineOnly && userName) {
      const mentionsUser = mentions.some((m) => m.messageId === i.sources[0]?.messageId);
      const isMyTask = actions.some((a) => a.id === i.relatedId && (a.kind === 'assigned-to-user' || a.assignee?.toLowerCase() === userName.toLowerCase()));
      if (!mentionsUser && !isMyTask) return false;
    }
    return true;
  });

  // Filter Decisions
  const filteredDecisions = decisions.filter((d) => {
    if (priorityFilter === 'high-critical' && d.status !== 'confirmed') return false;
    return true;
  });

  // Filter Mentions
  const filteredMentions = mentions;

  const hasActiveFilters = priorityFilter !== 'all' || taskFilter !== 'all' || mineOnly;

  const resetFilters = () => {
    setPriorityFilter('all');
    setTaskFilter('all');
    setMineOnly(false);
  };

  return (
    <main id="main-content" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Undo Toast Notification */}
      {lastCompletedId && onUndoCompleted && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-40 bg-graphite border border-mint/40 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 animate-slide-up"
        >
          <svg className="w-5 h-5 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-ice">Task marked complete</span>
          <button
            onClick={() => onUndoCompleted(lastCompletedId)}
            className="text-xs font-semibold text-mint hover:text-mint-hover uppercase tracking-wider underline focus:outline-none"
          >
            Undo
          </button>
        </div>
      )}

      {/* Header & Meta Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-graphite-surface/60 pb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-mint-dim text-mint border border-mint/30">
              <span className="w-1.5 h-1.5 rounded-full bg-mint" />
              Processed locally
            </span>

            {conversation.isSample && (
              <Badge category="sample" label="Sample data (PRD Appx A)" />
            )}

            <span className="text-xs font-mono text-ice-muted">
              {summary.coverage.messagesAnalyzed} messages parsed · {summary.coverage.unrecognizedLines} unrecognized lines
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-ice tracking-tight">
            Conversation Briefing
          </h1>
          <p className="text-sm text-ice-muted mt-1">
            Rule-based evidence extraction. Every item cites verbatim source messages.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={onAnalyzeAnother}>
            <svg className="w-4 h-4 mr-1 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Analyze another
          </Button>

          <Button variant="danger" size="sm" onClick={onClearAll}>
            Clear data
          </Button>
        </div>
      </div>

      {/* Tabs and Filters Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-graphite/40 border border-graphite-surface p-2 rounded-2xl">
        {/* Primary Tabs */}
        <div role="tablist" className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            role="tab"
            aria-selected={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-mint text-midnight shadow-md shadow-mint/10'
                : 'text-ice-muted hover:text-ice hover:bg-graphite-surface'
            }`}
          >
            All Insights
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'attention'}
            onClick={() => setActiveTab('attention')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'attention'
                ? 'bg-mint text-midnight shadow-md shadow-mint/10'
                : 'text-ice-muted hover:text-ice hover:bg-graphite-surface'
            }`}
          >
            <span>Needs Attention</span>
            {attentionInsights.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'attention' ? 'bg-midnight/30 text-midnight' : 'bg-danger/20 text-danger'
              }`}>
                {attentionInsights.length}
              </span>
            )}
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'tasks'}
            onClick={() => setActiveTab('tasks')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'tasks'
                ? 'bg-mint text-midnight shadow-md shadow-mint/10'
                : 'text-ice-muted hover:text-ice hover:bg-graphite-surface'
            }`}
          >
            <span>Tasks & Deadlines</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'tasks' ? 'bg-midnight/30 text-midnight' : 'bg-graphite-surface text-ice-muted'
            }`}>
              {actions.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'decisions'}
            onClick={() => setActiveTab('decisions')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'decisions'
                ? 'bg-mint text-midnight shadow-md shadow-mint/10'
                : 'text-ice-muted hover:text-ice hover:bg-graphite-surface'
            }`}
          >
            <span>Decisions</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'decisions' ? 'bg-midnight/30 text-midnight' : 'bg-graphite-surface text-ice-muted'
            }`}>
              {decisions.length}
            </span>
          </button>

          {mentions.length > 0 && (
            <button
              role="tab"
              aria-selected={activeTab === 'mentions'}
              onClick={() => setActiveTab('mentions')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'mentions'
                  ? 'bg-mint text-midnight shadow-md shadow-mint/10'
                  : 'text-ice-muted hover:text-ice hover:bg-graphite-surface'
              }`}
            >
              <span>Mentions</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'mentions' ? 'bg-midnight/30 text-midnight' : 'bg-mint-dim text-mint'
              }`}>
                {mentions.length}
              </span>
            </button>
          )}
        </div>

        {/* Secondary Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
            className="bg-graphite-surface border border-graphite-surface/80 text-ice rounded-lg px-2.5 py-1 focus:outline-none focus:border-mint text-xs"
            aria-label="Filter by priority"
          >
            <option value="all">All Priorities</option>
            <option value="high-critical">Critical & High</option>
            <option value="medium-low">Medium & Low</option>
          </select>

          {/* Task filter */}
          {(activeTab === 'all' || activeTab === 'tasks') && (
            <select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value as typeof taskFilter)}
              className="bg-graphite-surface border border-graphite-surface/80 text-ice rounded-lg px-2.5 py-1 focus:outline-none focus:border-mint text-xs"
              aria-label="Filter tasks by completion status"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open Only</option>
              <option value="completed">Completed Only</option>
            </select>
          )}

          {/* Mine only toggle */}
          {userName && (
            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-ice-muted hover:text-ice px-2 py-1 bg-graphite-surface/60 rounded-lg border border-graphite-surface">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(e) => setMineOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-mint focus:ring-mint border-graphite-surface"
              />
              <span>Mine only ({userName})</span>
            </label>
          )}

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs text-mint hover:underline font-semibold px-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="space-y-10">
        {/* ================= SECTION 1: NEEDS ATTENTION ================= */}
        {(activeTab === 'all' || activeTab === 'attention') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-danger/15 border border-danger/30 text-danger flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ice">Needs Attention</h2>
                  <p className="text-xs text-ice-muted">Imminent deadlines and urgent items requiring action</p>
                </div>
              </div>
              <span className="text-xs font-mono text-ice-muted">
                {attentionInsights.length} item{attentionInsights.length === 1 ? '' : 's'}
              </span>
            </div>

            {attentionInsights.length === 0 ? (
              <Card className="text-center py-8 text-xs text-ice-muted bg-graphite/40">
                No urgent attention items detected in this transcript.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attentionInsights.map((insight) => (
                  <Card
                    key={insight.id}
                    hoverable
                    className="border-graphite-surface hover:border-danger/40 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge category={insight.category} />
                          <Badge category={insight.basis} />
                        </div>
                        {insight.sources[0] && (
                          <button
                            onClick={() => onSelectSource(insight.sources[0])}
                            className="text-xs text-mint hover:underline font-mono inline-flex items-center gap-1 focus:outline-none"
                            aria-label={`Inspect source for ${insight.title}`}
                          >
                            <span>Source</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <h3 className="font-semibold text-sm text-ice leading-snug">
                        {insight.title}
                      </h3>

                      {insight.reasons.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {insight.reasons.map((r, idx) => (
                            <span
                              key={idx}
                              className="text-[11px] font-mono text-ice-muted bg-graphite-surface/80 px-2 py-0.5 rounded border border-graphite-surface"
                            >
                              {r.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================= SECTION 2: TASKS & DEADLINES ================= */}
        {(activeTab === 'all' || activeTab === 'tasks') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-mint-dim border border-mint/30 text-mint flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ice">Tasks & Deadlines</h2>
                  <p className="text-xs text-ice-muted">Extracted actionable commitments, assignments, and requests</p>
                </div>
              </div>
              <span className="text-xs font-mono text-ice-muted">
                {filteredActions.length} task{filteredActions.length === 1 ? '' : 's'}
              </span>
            </div>

            {filteredActions.length === 0 ? (
              <Card className="text-center py-8 text-xs text-ice-muted bg-graphite/40">
                {hasActiveFilters ? 'No tasks match current filters.' : 'No tasks or action items were detected.'}
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredActions.map((task) => {
                  const isCompleted = !!completedIds[task.id];
                  const isCancelled = task.status === 'possibly-cancelled';

                  return (
                    <Card
                      key={task.id}
                      className={`border-graphite-surface transition-all ${
                        isCompleted ? 'opacity-60 bg-graphite/40' : 'hover:border-mint/30'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Completion Checkbox */}
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            checked={isCompleted}
                            onChange={() => onToggleCompleted(task.id)}
                            className="w-4 h-4 rounded text-mint bg-graphite border-graphite-surface focus:ring-mint cursor-pointer"
                            aria-label={`Mark task as complete: ${task.description}`}
                          />
                        </div>

                        {/* Task Content */}
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge category={task.category} />
                              <Badge category={task.kind} />
                              {isCancelled && <Badge category="cancelled" label="Possibly cancelled" />}
                            </div>

                            {task.sources[0] && (
                              <button
                                onClick={() => onSelectSource(task.sources[0])}
                                className="text-xs text-mint hover:underline font-mono inline-flex items-center gap-1 self-start sm:self-auto focus:outline-none"
                                aria-label={`Inspect source for ${task.description}`}
                              >
                                <span>Source</span>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </button>
                            )}
                          </div>

                          <p className={`text-sm text-ice leading-relaxed ${isCompleted ? 'line-through text-ice-muted' : ''}`}>
                            {task.description}
                          </p>

                          {/* Task Meta: Assignee & Deadline */}
                          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            {task.assignee && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-graphite-surface text-ice font-medium">
                                <svg className="w-3.5 h-3.5 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span>Assignee: {task.assignee}</span>
                              </span>
                            )}

                            {task.deadline && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-warn/10 border border-warn/30 text-warn font-medium font-mono text-[11px]">
                                <svg className="w-3.5 h-3.5 text-warn" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Due: {task.deadline.rawText}</span>
                                {task.deadline.resolution === 'unresolved' && (
                                  <span className="text-[10px] text-warn/80">(unresolved)</span>
                                )}
                              </span>
                            )}

                            {task.reasons.map((r, idx) => (
                              <span key={idx} className="text-[11px] font-mono text-ice-muted bg-graphite-surface/60 px-2 py-0.5 rounded">
                                {r.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ================= SECTION 3: IMPORTANT DECISIONS ================= */}
        {(activeTab === 'all' || activeTab === 'decisions') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-info/15 border border-info/30 text-info flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ice">Important Decisions</h2>
                  <p className="text-xs text-ice-muted">Resolved agreements, proposals, and team consensus</p>
                </div>
              </div>
              <span className="text-xs font-mono text-ice-muted">
                {filteredDecisions.length} decision{filteredDecisions.length === 1 ? '' : 's'}
              </span>
            </div>

            {filteredDecisions.length === 0 ? (
              <Card className="text-center py-8 text-xs text-ice-muted bg-graphite/40">
                No decisions or proposals detected.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredDecisions.map((decision) => (
                  <Card
                    key={decision.id}
                    hoverable
                    className="border-graphite-surface hover:border-mint/30 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge category={decision.status} />

                        {decision.sources[0] && (
                          <button
                            onClick={() => onSelectSource(decision.sources[0])}
                            className="text-xs text-mint hover:underline font-mono inline-flex items-center gap-1 focus:outline-none"
                            aria-label={`Inspect source for ${decision.summary}`}
                          >
                            <span>Source</span>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </button>
                        )}
                      </div>

                      <p className="font-medium text-sm text-ice leading-snug">
                        {decision.summary}
                      </p>

                      {decision.supersededBy && (
                        <div className="text-[11px] text-warn bg-warn/10 border border-warn/20 rounded px-2 py-1 font-mono">
                          Note: This item was superseded by a later decision in the chat.
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================= SECTION 4: MENTIONS ================= */}
        {activeTab === 'mentions' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-mint-dim border border-mint/30 text-mint flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ice">Direct Mentions</h2>
                  <p className="text-xs text-ice-muted">Messages specifically addressing you or your configured aliases</p>
                </div>
              </div>
              <span className="text-xs font-mono text-ice-muted">
                {filteredMentions.length} mention{filteredMentions.length === 1 ? '' : 's'}
              </span>
            </div>

            {filteredMentions.length === 0 ? (
              <Card className="text-center py-8 text-xs text-ice-muted bg-graphite/40">
                No direct mentions detected for {userName || 'you'}.
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredMentions.map((mention, idx) => {
                  const msg = conversation.messages.find((m) => m.id === mention.messageId);

                  return (
                    <Card key={idx} hoverable className="border-graphite-surface space-y-2">
                      <div className="flex items-center justify-between text-xs text-ice-muted">
                        <span className="font-semibold text-ice">{msg?.sender || 'Unknown'}</span>
                        <div className="flex items-center gap-2">
                          <span>{msg?.timestamp?.raw || ''}</span>
                          <button
                            onClick={() => onSelectSource({ messageId: mention.messageId, span: mention.span })}
                            className="text-mint hover:underline font-mono inline-flex items-center gap-1"
                          >
                            <span>Source</span>
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-mono text-ice bg-midnight/60 p-3 rounded-xl border border-graphite-surface">
                        {msg?.text}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
};
