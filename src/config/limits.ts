/**
 * Input limits and processing constraints per PRD §20.
 */

/** Maximum characters allowed in a single transcript input */
export const MAX_CHARACTERS = 1_000_000;

/** Character count threshold that triggers a size warning */
export const WARN_CHARACTERS = 200_000;

/** Maximum lines allowed in a single transcript input */
export const MAX_LINES = 20_000;

/** Maximum file size in bytes for .txt uploads */
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Maximum character length for a single line before truncation warning */
export const MAX_LINE_LENGTH = 10_000;

/** Maximum characters for action item descriptions */
export const MAX_EXCERPT_LENGTH = 200;

/** Maximum characters for insight titles */
export const MAX_TITLE_LENGTH = 160;

/** Number of messages to look back/forward for nearby-message deadline linking */
export const NEARBY_MESSAGE_RANGE = 3;

/** Number of messages to look forward for decision affirmation/objection */
export const DECISION_WINDOW = 10;

/** Number of messages to look forward for open question reply detection */
export const QUESTION_REPLY_WINDOW = 8;

/** Number of messages for duplicate detection window */
export const DUPLICATE_WINDOW = 5;

/** Number of hours for critical deadline threshold */
export const CRITICAL_DEADLINE_HOURS = 48;

/** Number of messages to look forward for task cancellation */
export const CANCELLATION_WINDOW = 10;

/** Minimum message count for a topic to qualify */
export const MIN_TOPIC_COUNT = 3;

/** Maximum topics to show */
export const MAX_TOPICS = 5;

/** Maximum items per briefing section */
export const MAX_BRIEFING_ITEMS = 5;

/** Maximum aliases per user identity */
export const MAX_ALIASES = 5;

/** Maximum alias length */
export const MAX_ALIAS_LENGTH = 40;
