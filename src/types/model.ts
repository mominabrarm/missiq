/**
 * Missiq Core Data Model and TypeScript Interfaces
 * All types conform strictly to PRD.md Section 16 specification.
 */

/** Monotonic string ID for parsed messages in the format "m-<sourceIndex>" */
export type MessageId = string;

/** Parsing classification of individual transcript lines */
export type ParsingStatus =
  | "parsed"          // Standard header recognized (sender + optional timestamp)
  | "no-timestamp"    // Sender recognized without timestamp
  | "unattributed"    // Plain-text fallback line (sender unknown)
  | "system"          // System notification line (e.g. encryption notice, join event)
  | "malformed";      // Malformed header line retained as continuation or orphan

/** Character offset span into a string */
export interface TextSpan {
  /** Inclusive starting character index */
  start: number;
  /** Exclusive ending character index */
  end: number;
}

/** Timestamp metadata parsed from a chat header */
export interface ParsedTimestamp {
  /** Raw timestamp string verbatim as written in the chat */
  raw: string;
  /** ISO-8601 formatted date-time string if unambiguous */
  iso?: string;
  /** True if date format (DD/MM vs MM/DD) cannot be determined conclusively */
  ambiguous: boolean;
}

/** Represents a single parsed chat message in memory */
export interface ParsedMessage {
  id: MessageId;
  /** Zero-based original order index in transcript parsing */
  sourceIndex: number;
  /** 1-based starting line number in original input text */
  lineStart: number;
  /** 1-based ending line number in original input text */
  lineEnd: number;
  /** Sender name as written, or null if system/unattributed */
  sender: string | null;
  /** Parsed timestamp details if available */
  timestamp?: ParsedTimestamp;
  /** Verbatim text content of the message (multiline joined by \n) */
  text: string;
  parsingStatus: ParsingStatus;
  /** Reference to original message ID if this message is an exact duplicate */
  isDuplicateOf?: MessageId;
  /** Mentions of the configured user found in this message */
  mentions: Mention[];
}

/** Conversation metadata and parsed message collection */
export interface Conversation {
  messages: ParsedMessage[];
  /** List of unique participant names discovered */
  participants: string[];
  stats: {
    totalLines: number;
    nonEmptyLines: number;
    messageCount: number;
    unrecognizedLines: number;
    formatDetected: "F1" | "F2" | "F3" | "F4" | "mixed" | "none";
    firstTimestampIso?: string;
    lastTimestampIso?: string;
  };
  /** Indicates whether the conversation was loaded from synthetic sample data */
  isSample: boolean;
}

/** Extraction confidence level */
export type Confidence = "high" | "medium" | "low";

/** Stable pointer to a source message and optional evidence text span */
export interface SourceRef {
  messageId: MessageId;
  /** Optional character offset span highlighting specific evidence within the message */
  span?: TextSpan;
}

/** Uncertainty representation for insights */
export interface Uncertainty {
  level: Confidence;
  /** Human-readable explanation notes when confidence is not high */
  notes: string[];
}

/** Deadline metadata extracted from chat text */
export interface DeadlineInfo {
  /** Literal substring matched from the source message */
  rawText: string;
  /** ISO-8601 resolved timestamp if resolvable */
  resolvedIso?: string;
  resolution: "absolute" | "relative-resolved" | "unresolved" | "ambiguous";
  origin: "same-message" | "nearby-message";
}

/** Mention of the configured user in a message */
export interface Mention {
  messageId: MessageId;
  matchedText: string;
  span: TextSpan;
  kind: "name" | "alias" | "at-handle";
  /** True if name matching shares ambiguous roots with other participants */
  ambiguous: boolean;
}

/** Priority tier for insights */
export type PriorityCategory = "critical" | "high" | "medium" | "low" | "info";

/** Traceable priority attribution rule */
export interface PriorityReason {
  /** Rule identifier, e.g. "R-PRI-01" */
  ruleId: string;
  /** Human-readable explanation of why priority was assigned */
  label: string;
}

/** Prioritized insight item for the priority feed */
export interface PriorityInsight {
  id: string; // "p-<n>"
  kind: "task" | "decision" | "mention" | "deadline" | "announcement" | "question";
  /** Short single-line title (<= 160 chars) */
  title: string;
  category: PriorityCategory;
  basis: "explicit" | "inferred";
  reasons: PriorityReason[];
  /** Non-empty list of supporting source message references */
  sources: SourceRef[];
  uncertainty: Uncertainty;
  /** Related ActionItem.id or Decision.id if applicable */
  relatedId?: string;
}

/** Classification of action items */
export type ActionKind =
  | "assigned-to-user"
  | "assigned-to-other"
  | "commitment"
  | "unassigned-request"
  | "inferred";

/** Action item task structure */
export interface ActionItem {
  id: string; // "a-<n>"
  kind: ActionKind;
  /** Excerpt description (<= 200 chars) */
  description: string;
  /** Name of assignee as written in source text */
  assignee?: string;
  deadline?: DeadlineInfo;
  category: PriorityCategory;
  basis: "explicit" | "inferred";
  reasons: PriorityReason[];
  sources: SourceRef[];
  status: "open" | "possibly-cancelled";
  uncertainty: Uncertainty;
}

/** Classification of decision status */
export type DecisionStatus =
  | "confirmed"
  | "proposal"
  | "suggestion"
  | "question"
  | "disagreement";

/** Decision item structure */
export interface Decision {
  id: string; // "d-<n>"
  status: DecisionStatus;
  /** Short summary (<= 200 chars) */
  summary: string;
  /** Non-empty list of supporting source message references */
  sources: SourceRef[];
  /** Decision ID that supersedes this decision if updated later */
  supersededBy?: string;
  uncertainty: Uncertainty;
}

/** Individual line in the generated briefing */
export interface BriefingLine {
  text: string;
  sources: SourceRef[];
  insightId?: string;
}

/** Executive conversation briefing summary structure */
export interface Summary {
  /** Literal indicator distinguishing rule-based baseline from optional on-device model */
  method: "rule-based" | "on-device-model";
  coverage: {
    messagesAnalyzed: number;
    unrecognizedLines: number;
    totalLines: number;
  };
  attention: BriefingLine[];
  deadlines: BriefingLine[];
  decisions: BriefingLine[];
  announcements: BriefingLine[];
  openQuestions: BriefingLine[];
  topics: { label: string; messageCount: number; sources: SourceRef[] }[];
  activity: {
    messageCount: number;
    participantCount: number;
    spanIso?: [string, string];
  };
}

/** Complete pipeline result structure returned from worker analysis */
export interface AnalysisResult {
  runId: number;
  conversation: Conversation;
  summary: Summary;
  insights: PriorityInsight[];
  actions: ActionItem[];
  decisions: Decision[];
  mentions: Mention[];
  /** Content-free user-facing warning messages */
  warnings: string[];
}

/** Processing execution mode */
export type ProcessingMode = "none" | "rule-based-local" | "on-device-model";

/** Standard error codes for app operations */
export type ErrorCode =
  | "E-IMP-EMPTY"
  | "E-IMP-TYPE"
  | "E-IMP-BINARY"
  | "E-IMP-TOOLARGE"
  | "E-IMP-READ"
  | "E-PAR-NOMSG"
  | "E-PAR-UNSUPPORTED"
  | "E-ANA-INTERNAL"
  | "E-ANA-TIMEOUT"
  | "E-ANA-CANCELLED";

/** Honest local processing status state machine */
export type ProcessingStatus =
  | { phase: "idle" }
  | { phase: "analyzing"; mode: ProcessingMode; stage: "parse" | "extract" | "prioritize" | "brief"; progress: number }
  | { phase: "complete"; mode: ProcessingMode; modelName?: string }
  | { phase: "cleared" }
  | { phase: "error"; code: ErrorCode };

/** Main application state container held in RAM reducer */
export interface AppState {
  view: "welcome" | "import" | "analyzing" | "results" | "cleared";
  rawText: string;
  identity: {
    name: string;
    aliases: string[];
    referenceDateIso?: string;
  };
  isSample: boolean;
  runId: number;
  status: ProcessingStatus;
  result?: AnalysisResult;
  /** In-memory map of completed action item IDs */
  completedIds: Record<string, true>;
  filters: {
    categories: PriorityCategory[];
    kinds: string[];
    completion: "all" | "open" | "done";
    mineOnly: boolean;
  };
  selectedSource?: SourceRef;
  undo?: {
    id: string;
    expiresAt: number;
  };
}
