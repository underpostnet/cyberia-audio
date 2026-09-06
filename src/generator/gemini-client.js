/**
 * Minimal Google Gemini (Generative Language API) client.
 *
 * Deliberately thin and dependency-free: the module generator needs one structured JSON
 * completion per stage, so only the `:generateContent` endpoint is wired. Authentication uses the
 * `x-goog-api-key` header sourced from `GEMINI_API_KEY`; no key is ever written to disk or into a
 * generated module.
 */

/** Generative Language API model base. `<model>:generateContent` is appended. */
export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Default model id. Flash is the one the free tier actually serves — `gemini-2.5-pro` answers
 * `limit: 0` there — and the pipeline's stages are small and structured enough to suit it.
 * Override per call with `--model`, or globally with `GEMINI_MODEL`.
 */
export const GEMINI_DEFAULT_MODEL = 'gemma-4-26b-a4b-it';

/** A key, a quota or a model-name mistake is not transient: retrying only multiplies the wait. */
const PERMANENT_STATUS = new Set([400, 401, 403, 404]);

/**
 * Every balanced `{...}` span in a text, scanned string-aware so a brace inside a JSON string —
 * which is where generated JavaScript lives — is not mistaken for structure.
 */
function* objectSpans(text) {
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const character = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') inString = true;
      else if (character === '{') depth++;
      else if (character === '}' && --depth === 0) {
        yield text.slice(start, i + 1);
        break;
      }
    }
  }
}

/**
 * Best-effort extraction of one JSON object from a completion: tolerates fences and prose.
 *
 * An instruction-tuned model narrates its plan before it answers, and that narration quotes the
 * response schema back — `{"source": "<javascript>"}` — as an example. Reading from the first
 * brace to the last would start inside the prose and end inside the answer, so the largest span
 * that actually parses wins instead.
 */
export function parseJsonLoose(text) {
  const candidate = String(text ?? '').trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  for (const source of [candidate, fence?.[1]?.trim()]) {
    if (!source) continue;
    try {
      return JSON.parse(source);
    } catch {
      // Not the whole answer; fall through to the spans.
    }
  }
  let best;
  let length = 0;
  for (const span of objectSpans(candidate)) {
    if (span.length <= length) continue;
    try {
      best = JSON.parse(span);
      length = span.length;
    } catch {
      // Prose that happens to contain a brace.
    }
  }
  if (length === 0) throw new Error('Gemini response contained no JSON object.');
  return best;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class GeminiClient {
  #apiKey;

  constructor({
    apiKey = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL,
    baseUrl = GEMINI_API_BASE,
    timeout = 300000,
    maxRetries = 2,
    temperature,
  } = {}) {
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not set. Put it in ./.env, export it, or point --env-file at the file that holds it.',
      );
    }
    this.#apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.timeout = timeout;
    this.maxRetries = maxRetries;
    this.temperature = temperature;
  }

  /** One `:generateContent` request. Returns the answer text, skipping any thinking parts. */
  async generateContent({ prompt, generationConfig = {} }) {
    const response = await fetch(`${this.baseUrl}/${this.model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': this.#apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 400);
      const error = new Error(`Gemini ${this.model} responded ${response.status}: ${detail || response.statusText}`);
      error.status = response.status;
      throw error;
    }
    const data = await response.json();
    const text = (data?.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => typeof part?.text === 'string' && !part.thought)
      .map((part) => part.text)
      .join('');
    if (!text) throw new Error(`Gemini ${this.model} returned an empty completion.`);
    return text;
  }

  /**
   * One completion parsed as JSON, retried on transient failure.
   *
   * The schema is requested in-prompt as well as through `responseMimeType`, so a model that
   * ignores the JSON response mode still answers in the shape the caller asked for.
   */
  async chatJson({ system, user, temperature = this.temperature, onRetry }) {
    const prompt = [
      system,
      '',
      user,
      '',
      'Respond with ONLY a single valid JSON object. No markdown fences, no prose, no trailing commentary.',
      'Do not restate the task and do not explain your plan: the JSON object is the entire answer.',
    ].join('\n');
    const generationConfig = { responseMimeType: 'application/json' };
    if (typeof temperature === 'number') generationConfig.temperature = temperature;

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return parseJsonLoose(await this.generateContent({ prompt, generationConfig }));
      } catch (error) {
        lastError = error;
        if (PERMANENT_STATUS.has(error.status) || attempt === this.maxRetries) break;
        const backoff = 1000 * (attempt + 1);
        onRetry?.({ attempt: attempt + 1, attempts: this.maxRetries + 1, error, backoff });
        await sleep(backoff);
      }
    }
    throw lastError;
  }
}
