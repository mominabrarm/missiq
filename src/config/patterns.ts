/**
 * Rule vocabularies and pattern data for deterministic extraction.
 * Per PRD §17.4, rules are data in patterns.ts, each with an id for reasons.
 * All patterns are reviewed for linear-time safety (no nested quantifiers on unbounded groups).
 */

// ─── Task Patterns ───────────────────────────────────────────────────

/** Verb allow-list for task extraction (PRD §17.4) */
export const TASK_VERBS = [
  'send', 'submit', 'review', 'update', 'prepare', 'finish', 'complete',
  'fix', 'write', 'share', 'upload', 'book', 'call', 'email', 'check',
  'confirm', 'bring', 'push', 'merge', 'deploy', 'test', 'schedule',
  'pay', 'register', 'sign', 'finalize', 'create', 'set up', 'add',
] as const;

/** Negation markers that suppress or cancel a task (R-TSK-N1) */
export const NEGATION_MARKERS = [
  'no need to',
  "don't need to",
  'do not need to',
  'not required',
  'already done',
  'cancelled',
  'canceled',
  'never mind',
  'scratch that',
  "don't worry about",
  'do not worry about',
  'no longer needed',
  'not necessary',
  "it's cancelled",
  "it's canceled",
] as const;

/** Commitment phrases for first-person task detection (R-TSK-03) */
export const COMMITMENT_PHRASES = [
  "i'll", 'i will', 'i am going to', 'i can take', 'i got',
  "i'm going to", 'i can handle', 'i can do',
] as const;

/** Unassigned request phrases (R-TSK-05) */
export const UNASSIGNED_REQUEST_PHRASES = [
  'we need to', 'we have to', 'we must', 'we should',
  'someone should', 'someone needs to', 'someone can',
  'can someone', 'can anyone', 'could someone',
  'please', 'pls',
] as const;

/** Explicit task markers (R-TSK-06) */
export const EXPLICIT_TASK_MARKERS = [
  'todo:', 'to-do:', 'action item:', 'action:', 'task:',
] as const;

// ─── Decision Patterns ───────────────────────────────────────────────

/** Confirmed decision phrases (R-DEC-01) */
export const CONFIRMED_DECISION_PHRASES = [
  'we decided', 'decision:', 'final:', "it's settled",
  "let's go with", 'going with', 'approved', 'agreed on',
  'final decision', "we're going with",
] as const;

/** Proposal phrases (R-DEC-03) */
export const PROPOSAL_PHRASES = [
  'what if we', 'i propose', 'proposal:', 'how about',
  'shall we', 'we could go with',
] as const;

/** Suggestion phrases (R-DEC-04) — never confirmed alone */
export const SUGGESTION_PHRASES = [
  'maybe we should', 'maybe we could',
  'i think we should', 'i think we could',
  'we might want to', 'perhaps we should',
  'we could', 'might want to',
] as const;

/** Affirmation phrases for confirming proposals (R-DEC-02) */
export const AFFIRMATION_PHRASES = [
  'agreed', 'sounds good', 'works for me', '+1',
  'yes', '👍', 'i agree', 'makes sense', 'perfect',
  'go for it', 'sure',
] as const;

/** Objection phrases for disagreement (R-DEC-06) */
export const OBJECTION_PHRASES = [
  'no', 'i disagree', 'not sure about', "i'd rather",
  'i dont think', "i don't think", 'bad idea',
  'i prefer', "let's not",
] as const;

// ─── Urgency / Priority Markers ──────────────────────────────────────

/** Urgency markers (R-PRI-03) */
export const URGENCY_MARKERS = [
  'urgent', 'asap', 'immediately', 'important', '!!',
  'critical', 'must', 'priority',
] as const;

/** Important announcement markers (R-PRI-09) — note: FYI does NOT qualify */
export const ANNOUNCEMENT_MARKERS = [
  'announcement', 'reminder', 'heads up', 'note:',
  'please note', 'update:', 'meeting at', 'class cancelled',
  'class canceled', 'moved to', 'postponed',
] as const;

/** Deadline phrases (FR-009) */
export const DEADLINE_PHRASES = [
  'by', 'before', 'due', 'deadline',
] as const;

/** Relative day expressions */
export const RELATIVE_DAY_EXPRESSIONS = [
  'today', 'tomorrow', 'tonight',
] as const;

/** Time expressions like EOD, end of day */
export const TIME_EXPRESSIONS = [
  'eod', 'end of day', 'end of business',
] as const;

/** Day of week names */
export const WEEKDAY_NAMES = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
] as const;

/** Month names */
export const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

// ─── System Message Patterns ─────────────────────────────────────────

/** System/notification lines to flag as kind: "system" */
export const SYSTEM_LINE_PATTERNS = [
  /messages and calls are end-to-end encrypted/i,
  /^this message was deleted$/i,
  /^you deleted this message$/i,
  /^\u200e/,       // zero-width joiner prefix (WhatsApp system lines)
  /joined using this group/i,
  /left the group/i,
  /changed the group/i,
  /created group/i,
  /added you/i,
  /removed you/i,
  /changed the subject/i,
  /changed this group/i,
  /your security code/i,
] as const;

// ─── Stop Words for Topic Extraction ─────────────────────────────────

export const STOP_WORDS = new Set<string>([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'need', 'dare',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'up', 'down', 'about', 'against',
  'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
  'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'only', 'same', 'than', 'too', 'very',
  'just', 'also', 'now', 'here', 'there', 'then', 'once', 'when',
  'where', 'why', 'how', 'what', 'which', 'who', 'whom', 'whose',
  'that', 'this', 'these', 'those', 'i', 'me', 'my', 'mine', 'we',
  'us', 'our', 'ours', 'you', 'your', 'yours', 'he', 'him', 'his',
  'she', 'her', 'hers', 'it', 'its', 'they', 'them', 'their', 'theirs',
  'if', 'because', 'while', 'until', 'although', 'though', 'since',
  'unless', 'whether', 'like', 'well', 'back', 'even', 'still', 'way',
  'take', 'come', 'make', 'know', 'think', 'see', 'look', 'say',
  'give', 'go', 'get', 'let', 'keep', 'put', 'try', 'start', 'show',
  'ok', 'okay', 'yeah', 'yes', 'hey', 'hi', 'hello', 'thanks',
  'thank', 'please', 'pls', "i'm", "i'll", "it's", "don't", "can't",
  "won't", "doesn't", "didn't", "isn't", "aren't", "wasn't", "weren't",
  "i've", "we've", "they've", "you've", "he's", "she's", "we're", "they're",
  "you're",
]);

