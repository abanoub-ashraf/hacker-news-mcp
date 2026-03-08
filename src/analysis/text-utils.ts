const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "how",
  "i",
  "if",
  "in",
  "is",
  "it",
  "its",
  "just",
  "me",
  "my",
  "not",
  "of",
  "on",
  "or",
  "our",
  "so",
  "than",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "to",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "will",
  "with",
  "you",
  "your",
]);

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&nbsp;": " ",
};

export function stripHtml(input?: string | null): string {
  if (!input) {
    return "";
  }

  const withoutTags = input
    .replace(/<p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withoutTags).replace(/\s+/g, " ").trim();
}

export function truncateText(input?: string | null, maxLength: number = 220): string {
  const text = stripHtml(input);
  if (!text || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function tokenize(input?: string | null): string[] {
  return stripHtml(input)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function extractRepeatedPhrases(
  texts: string[],
  options: {
    minWords?: number;
    maxWords?: number;
    minMentions?: number;
    limit?: number;
  } = {}
): Array<{ phrase: string; mentions: number }> {
  const minWords = options.minWords ?? 2;
  const maxWords = options.maxWords ?? 3;
  const minMentions = options.minMentions ?? 2;
  const limit = options.limit ?? 5;
  const counts = new Map<string, number>();

  for (const text of texts) {
    const tokens = tokenize(text);
    const seen = new Set<string>();

    for (let size = minWords; size <= maxWords; size += 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const phrase = tokens.slice(index, index + size).join(" ");
        if (seen.has(phrase)) {
          continue;
        }

        seen.add(phrase);
        counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, mentions]) => mentions >= minMentions)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([phrase, mentions]) => ({ phrase, mentions }));
}

export function extractQuestionSentences(
  texts: string[],
  limit: number = 5
): Array<{ question: string; mentions: number }> {
  const counts = new Map<string, number>();

  for (const text of texts) {
    const seen = new Set<string>();
    const sentences = stripHtml(text).split(/(?<=[?.!])\s+/);

    for (const sentence of sentences) {
      if (!sentence.includes("?")) {
        continue;
      }

      const normalized = normalizeSentence(sentence);
      if (!normalized || normalized.length < 12 || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([question, mentions]) => ({ question, mentions }));
}

export function normalizeDateString(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }

  const parsed = Date.parse(input);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

export function isDateInRange(
  dateString: string,
  dateFrom?: string,
  dateTo?: string
): boolean {
  const timestamp = Date.parse(dateString);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const fromTimestamp = dateFrom ? Date.parse(dateFrom) : undefined;
  const toTimestamp = dateTo ? Date.parse(dateTo) : undefined;

  if (fromTimestamp !== undefined && !Number.isNaN(fromTimestamp) && timestamp < fromTimestamp) {
    return false;
  }

  if (toTimestamp !== undefined && !Number.isNaN(toTimestamp) && timestamp > toTimestamp) {
    return false;
  }

  return true;
}

function decodeHtmlEntities(input: string): string {
  let output = input;

  for (const [entity, value] of Object.entries(HTML_ENTITIES)) {
    output = output.replace(new RegExp(entity, "g"), value);
  }

  return output;
}

function normalizeSentence(input: string): string {
  return input.replace(/\s+/g, " ").replace(/[“”]/g, '"').trim();
}
