/**
 * Analysis Pipeline — clean, typed public entry point.
 *
 * Orchestrates: validation → parsing → normalization → extraction →
 * prioritization → briefing → source validation → AnalysisResult.
 *
 * All processing is deterministic, local, and in-memory.
 * No cloud AI calls. No backend.
 *
 * Per PRD §17.3 pipeline steps 1–15.
 */

import { AnalysisResult, Mention } from '../types/model';
import { parseTranscript, parseAsPlainText, ParseResult } from './parse/parseTranscript';
import { extractDeadlines } from './extract/dates';
import { extractTasks } from './extract/tasks';
import { detectMentions } from './extract/mentions';
import { extractDecisions } from './extract/decisions';
import { detectQuestions } from './extract/questions';
import { detectAnnouncements } from './extract/announcements';
import { extractTopics } from './extract/topics';
import { prioritize } from './prioritize';
import { buildBriefing } from './briefing';
import { validateReferences, ValidationReport } from './sourceRefs';

export interface AnalysisOptions {
  /** Raw transcript text */
  rawText: string;
  /** User's name for mention detection */
  userName: string;
  /** User's aliases for mention detection */
  userAliases: string[];
  /** Reference date for relative deadline resolution (ISO string) */
  referenceDateIso?: string;
  /** Whether this is sample data */
  isSample: boolean;
  /** Monotonic run ID for stale-result prevention */
  runId: number;
  /** If true, force plain-text parsing (unsupported format fallback) */
  forcePlainText?: boolean;
}

export interface AnalysisPipelineResult {
  result: AnalysisResult;
  validation: ValidationReport;
}

/**
 * Run the full analysis pipeline.
 * This is the single public entry point for the analysis engine.
 *
 * The pipeline is:
 * 1. Parse transcript (format detection, header matching, multiline, dedup)
 * 2. Extract deadlines/dates
 * 3. Extract tasks
 * 4. Detect mentions
 * 5. Extract decisions
 * 6. Detect questions
 * 7. Detect announcements
 * 8. Extract topics
 * 9. Prioritize all insights
 * 10. Build briefing
 * 11. Validate source references (V-01..V-10)
 * 12. Return AnalysisResult
 */
export function runAnalysis(options: AnalysisOptions): AnalysisPipelineResult {
  const {
    rawText, userName, userAliases, referenceDateIso,
    isSample, runId, forcePlainText,
  } = options;

  // Reject binary input containing null bytes per PRD §17.3, §21.1
  if (rawText.includes('\0')) {
    throw new Error('E-IMP-BINARY');
  }

  // Step 1: Parse transcript
  let parseResult: ParseResult;
  if (forcePlainText) {
    parseResult = parseAsPlainText(rawText, isSample);
  } else {
    parseResult = parseTranscript(rawText, isSample);

    // Check if parsing succeeded — if no messages, may need plain text fallback
    if (parseResult.conversation.messages.length === 0) {
      // Return result with no insights and a warning
      const emptyResult: AnalysisResult = {
        runId,
        conversation: parseResult.conversation,
        summary: {
          method: 'rule-based',
          coverage: {
            messagesAnalyzed: 0,
            unrecognizedLines: parseResult.conversation.stats.unrecognizedLines,
            totalLines: parseResult.conversation.stats.totalLines,
          },
          attention: [],
          deadlines: [],
          decisions: [],
          announcements: [],
          openQuestions: [],
          topics: [],
          activity: {
            messageCount: 0,
            participantCount: 0,
          },
        },
        insights: [],
        actions: [],
        decisions: [],
        mentions: [],
        warnings: parseResult.warnings,
      };
      const validation = validateReferences(emptyResult);
      return { result: emptyResult, validation };
    }
  }

  const { conversation, warnings } = parseResult;
  const messages = conversation.messages;

  // Use reference date: user-supplied, or last message timestamp, or undefined
  const effectiveRefDate = referenceDateIso
    ?? conversation.stats.lastTimestampIso
    ?? undefined;

  // Step 2: Extract deadlines
  const deadlineCandidates = extractDeadlines(messages, parseResult.dateFieldOrder);

  // Step 3: Extract tasks
  const actions = extractTasks(
    messages, deadlineCandidates,
    userName, userAliases,
    conversation.participants,
  );

  // Step 4: Detect mentions
  let mentions: Mention[] = [];
  const mentionWarnings: string[] = [];
  if (userName.trim()) {
    const mentionResult = detectMentions(
      messages, userName, userAliases, conversation.participants
    );
    mentions = mentionResult.mentions;
    if (mentionResult.ambiguousParticipants.length > 0) {
      mentionWarnings.push(
        `Multiple participants match your name: ${mentionResult.ambiguousParticipants.join(', ')}`
      );
    }
  }

  // Step 5: Extract decisions
  const decisions = extractDecisions(messages);

  // Step 6: Detect questions
  const questions = detectQuestions(messages);

  // Step 7: Detect announcements
  const announcements = detectAnnouncements(messages);

  // Step 8: Extract topics
  const topics = extractTopics(messages);

  // Build message text lookup for prioritizer
  const messageTexts = new Map<string, string>();
  for (const msg of messages) {
    messageTexts.set(msg.id, msg.text);
  }

  // Step 9: Prioritize all insights
  const insights = prioritize({
    actions,
    decisions,
    mentions,
    deadlines: deadlineCandidates,
    announcements,
    questions,
    userName,
    referenceDateIso: effectiveRefDate,
    messageTexts,
  });

  // Step 10: Build briefing
  const summary = buildBriefing({
    conversation,
    insights,
    actions,
    decisions,
    deadlines: deadlineCandidates,
    announcements,
    questions,
    topics,
    userName,
  });

  // Step 11: Assemble AnalysisResult
  const result: AnalysisResult = {
    runId,
    conversation,
    summary,
    insights,
    actions,
    decisions,
    mentions,
    warnings: [...warnings, ...mentionWarnings],
  };

  // Step 12: Validate source references
  const validation = validateReferences(result);

  // Drop insights with invalid references
  if (!validation.isValid && validation.droppedInsightIds.length > 0) {
    result.insights = result.insights.filter(
      i => !validation.droppedInsightIds.includes(i.id)
    );
    result.actions = result.actions.filter(
      a => !validation.droppedInsightIds.includes(a.id)
    );
    result.decisions = result.decisions.filter(
      d => !validation.droppedInsightIds.includes(d.id)
    );

    if (validation.droppedInsightIds.length > 0) {
      result.warnings.push(
        `${validation.droppedInsightIds.length} item(s) removed because they could not be traced to a source.`
      );
    }
  }

  return { result, validation };
}

/**
 * Convenience function to analyze transcript with positional arguments.
 */
export function analyzeTranscript(
  rawText: string,
  userName: string = '',
  referenceDateIso?: string,
  isSample: boolean = false,
  userAliases: string[] = [],
  runId: number = 1,
): AnalysisPipelineResult {
  return runAnalysis({
    rawText,
    userName,
    userAliases,
    referenceDateIso,
    isSample,
    runId,
  });
}
