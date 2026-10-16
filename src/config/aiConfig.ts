// Groq settings. Verified against Groq's documentation on 2026-10-16 (see docs/ai-spec.md).
// Every number here is a choice unless marked VERIFIED.

/** VERIFIED: OpenAI-compatible chat completions endpoint. */
export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * VERIFIED: a production model that supports Structured Outputs with `strict: true` (constrained
 * decoding to the JSON schema). openai/gpt-oss-20b also supports it and is the documented fallback.
 */
export const AI_MODEL = 'openai/gpt-oss-120b';

/** Low temperature: the model picks and words, it should not improvise. */
export const AI_TEMPERATURE = 0.2;
export const AI_MAX_COMPLETION_TOKENS = 1500;

/** One call gives up after this long, then the rule-based form runs. */
export const AI_TIMEOUT_MS = 20_000;
/** On 429, wait the server's retry-after (capped here) and try once more. */
export const AI_RETRY_AFTER_CAP_MS = 8_000;
export const AI_MAX_RETRIES = 1;

/** At most this many candidate questions go into one call, never the whole bank. */
export const AI_MAX_CANDIDATES = 60;
/** Per question, plain text is cut to this many characters. */
export const AI_MAX_TEXT_CHARS = 600;
/**
 * VERIFIED limit: the free/developer tier allows 8K tokens per minute for gpt-oss models. Requests
 * are kept under this estimate (about 4 characters per token) by dropping the lowest-ranked
 * candidates' text first.
 */
export const AI_TOKEN_BUDGET = 6_000;

/** One line beside the text toggle. Full summary and sources in docs/ai-spec.md. */
export const GROQ_POLICY_LINE =
  'Groq says it does not keep API request data by default, but may log inputs and outputs for up to 30 days to investigate abuse or failures unless Zero Data Retention is turned on in your Groq console. Its docs page does not say whether API data is used for training.';
