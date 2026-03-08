import { buildHnItemUrl, normalizeStoryMetadata } from "./normalize.js";
import { scoreCommentInterestingness } from "./ranking.js";
import {
  extractQuestionSentences,
  extractRepeatedPhrases,
  stripHtml,
  truncateText,
} from "./text-utils.js";
import type {
  EvidenceItem,
  PhraseSummary,
  ThreadSummary,
  TopCommentSummary,
} from "./types.js";

interface FlatComment {
  id: number;
  author: string;
  text: string;
  depth: number;
  parentId?: number;
  replyCount: number;
  score: number;
}

const PRO_PATTERNS = {
  simplicity: /\b(simple|minimal|clean|easy|straightforward|intuitive)\b/i,
  usefulness: /\b(useful|helpful|valuable|needed|handy|practical)\b/i,
  speed: /\b(fast|quick|snappy|responsive)\b/i,
  polish: /\b(polished|impressive|awesome|great|nice|cool|beautiful)\b/i,
};

const CON_PATTERNS = {
  pricing: /\b(expensive|price|pricing|cost|subscription|paywall)\b/i,
  complexity: /\b(complex|complicated|confusing|hard|difficult|steep)\b/i,
  reliability: /\b(bug|broken|issue|problem|error|crash|slow)\b/i,
  trust: /\b(trust|privacy|security|spam|data|lock[- ]?in)\b/i,
  competition: /\b(already use|why not|instead of|compared to|duplicate|competition)\b/i,
};

const REQUEST_PATTERNS = {
  integrations: /\b(api|webhook|zapier|integration|import|export|sync)\b/i,
  platformSupport: /\b(ios|android|mac|windows|linux|mobile|desktop|browser extension)\b/i,
  collaboration: /\b(team|shared|collaboration|multi-user|permissions)\b/i,
  onboarding: /\b(docs|documentation|tutorial|guide|example|demo)\b/i,
  pricing: /\b(free tier|trial|pricing|plan|lifetime|subscription)\b/i,
};

const FEATURE_SIGNAL_REGEX =
  /\b(would love|please add|needs|should support|it would be nice|i wish|missing|feature request|could you add)\b/i;

export function summarizeThreadData(
  storyData: any,
  options: {
    maxDepth?: number;
    maxComments?: number;
  } = {}
): ThreadSummary {
  const flatComments = flattenCommentTree(storyData.children ?? [], {
    maxDepth: options.maxDepth,
    maxComments: options.maxComments,
  });
  const commentTexts = flatComments.map((comment) => comment.text);

  const keyDiscussionThemes = extractThemes(commentTexts);
  const notablePros = summarizePatternBucket(flatComments, PRO_PATTERNS);
  const notableCons = summarizePatternBucket(flatComments, CON_PATTERNS);
  const featureRequests = summarizePatternBucket(flatComments, REQUEST_PATTERNS, true);
  const repeatedQuestions = extractQuestionSummaries(commentTexts);
  const topCommentsUsed = buildTopComments(flatComments);

  const positiveComments = countPatternMatches(flatComments, Object.values(PRO_PATTERNS));
  const negativeComments = countPatternMatches(flatComments, Object.values(CON_PATTERNS));
  const requestComments = flatComments.filter((comment) =>
    FEATURE_SIGNAL_REGEX.test(comment.text)
  ).length;
  const questionComments = flatComments.filter((comment) =>
    comment.text.includes("?")
  ).length;
  const neutralComments = flatComments.filter(
    (comment) =>
      !Object.values(PRO_PATTERNS).some((pattern) => pattern.test(comment.text)) &&
      !Object.values(CON_PATTERNS).some((pattern) => pattern.test(comment.text))
  ).length;

  return {
    story: normalizeStoryMetadata(storyData, storyData.text),
    analyzedComments: flatComments.length,
    keyDiscussionThemes,
    notablePros,
    notableCons,
    repeatedQuestions,
    featureRequests,
    sentimentSnapshot: {
      positiveComments,
      negativeComments,
      neutralComments,
      questionComments,
      requestComments,
      overall: overallSentiment(positiveComments, negativeComments),
    },
    topCommentsUsed,
  };
}

export function flattenCommentTree(
  comments: any[],
  options: {
    maxDepth?: number;
    maxComments?: number;
  } = {}
): FlatComment[] {
  const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;
  const maxComments = options.maxComments ?? Number.POSITIVE_INFINITY;
  const flattened: FlatComment[] = [];

  const visit = (comment: any, depth: number) => {
    if (!comment || flattened.length >= maxComments || depth > maxDepth) {
      return;
    }

    const text = stripHtml(comment.text);
    const replyCount = Array.isArray(comment.children) ? comment.children.length : 0;

    if (text) {
      flattened.push({
        id: Number(comment.id),
        author: comment.author ?? "deleted",
        text,
        depth,
        parentId: comment.parent_id,
        replyCount,
        score: scoreCommentInterestingness({
          depth,
          replyCount,
          textLength: text.length,
          hasQuestion: text.includes("?"),
          hasFeatureSignal: FEATURE_SIGNAL_REGEX.test(text),
        }),
      });
    }

    for (const child of comment.children ?? []) {
      visit(child, depth + 1);
      if (flattened.length >= maxComments) {
        return;
      }
    }
  };

  for (const comment of comments) {
    visit(comment, 0);
    if (flattened.length >= maxComments) {
      break;
    }
  }

  return flattened;
}

export function categorizeLaunchTopic(title: string, textPreview?: string): string {
  const haystack = `${title} ${textPreview ?? ""}`.toLowerCase();

  const categories: Array<[string, RegExp]> = [
    ["ai", /\b(ai|llm|gpt|model|agent|inference|prompt)\b/i],
    ["developer-tools", /\b(api|sdk|cli|developer|code|git|deploy|testing)\b/i],
    ["productivity", /\b(calendar|planner|notes|task|todo|workflow|automation)\b/i],
    ["design", /\b(design|ui|ux|figma|visual|mockup)\b/i],
    ["finance", /\b(finance|billing|invoice|accounting|bank|budget)\b/i],
    ["data-analytics", /\b(analytics|dashboard|metrics|data|observability)\b/i],
    ["marketplace", /\b(marketplace|directory|jobs|hiring|talent)\b/i],
    ["consumer", /\b(photo|video|social|music|travel|fitness|dating)\b/i],
  ];

  return categories.find(([, pattern]) => pattern.test(haystack))?.[0] ?? "general";
}

export function analyzeTitleStyle(title: string) {
  const wordCount = title.trim().split(/\s+/).filter(Boolean).length;
  const lower = title.toLowerCase();

  return {
    prefix: lower.startsWith("show hn:")
      ? ("show-hn" as const)
      : lower.startsWith("ask hn:")
        ? ("ask-hn" as const)
        : ("plain" as const),
    hasColon: title.includes(":"),
    wordCount,
    lengthBucket:
      wordCount <= 6 ? ("short" as const) : wordCount <= 12 ? ("medium" as const) : ("long" as const),
    includesAudienceSignal: /\bfor\s+\w+|\bdevelopers\b|\bteams\b|\bfounders\b|\bdesigners\b/i.test(
      title
    ),
  };
}

function extractThemes(commentTexts: string[]): PhraseSummary[] {
  const repeatedPhrases = extractRepeatedPhrases(commentTexts, {
    minWords: 2,
    maxWords: 3,
    minMentions: 2,
    limit: 6,
  });

  if (repeatedPhrases.length > 0) {
    return repeatedPhrases;
  }

  return extractRepeatedPhrases(commentTexts, {
    minWords: 1,
    maxWords: 2,
    minMentions: 2,
    limit: 4,
  });
}

function summarizePatternBucket(
  comments: FlatComment[],
  patterns: Record<string, RegExp>,
  requireFeatureSignal: boolean = false
): EvidenceItem[] {
  return Object.entries(patterns)
    .map(([theme, pattern]) => {
      const matches = comments.filter((comment) => {
        if (requireFeatureSignal && !FEATURE_SIGNAL_REGEX.test(comment.text)) {
          return false;
        }

        return pattern.test(comment.text);
      });

      return toEvidenceItem(theme, matches);
    })
    .filter((item): item is EvidenceItem => item !== null)
    .sort((left, right) => {
      if (right.mentions !== left.mentions) {
        return right.mentions - left.mentions;
      }
      return left.theme.localeCompare(right.theme);
    })
    .slice(0, 5);
}

function extractQuestionSummaries(commentTexts: string[]): EvidenceItem[] {
  return extractQuestionSentences(commentTexts, 5).map((entry) => ({
    theme: entry.question,
    mentions: entry.mentions,
    examples: [entry.question],
    confidence: confidenceFromMentions(entry.mentions),
  }));
}

function buildTopComments(comments: FlatComment[]): TopCommentSummary[] {
  return [...comments]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.id - right.id;
    })
    .slice(0, 5)
    .map((comment) => ({
      id: comment.id,
      author: comment.author,
      excerpt: truncateText(comment.text, 240),
      depth: comment.depth,
      replyCount: comment.replyCount,
      score: comment.score,
      hnUrl: buildHnItemUrl(comment.id),
    }));
}

function countPatternMatches(comments: FlatComment[], patterns: RegExp[]): number {
  return comments.filter((comment) =>
    patterns.some((pattern) => pattern.test(comment.text))
  ).length;
}

function overallSentiment(
  positiveComments: number,
  negativeComments: number
): "positive" | "mixed" | "negative" | "neutral" {
  if (positiveComments === 0 && negativeComments === 0) {
    return "neutral";
  }

  if (positiveComments >= negativeComments * 1.5) {
    return "positive";
  }

  if (negativeComments >= positiveComments * 1.5) {
    return "negative";
  }

  return "mixed";
}

function toEvidenceItem(theme: string, matches: FlatComment[]): EvidenceItem | null {
  if (matches.length === 0) {
    return null;
  }

  const examples = matches
    .slice()
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((comment) => truncateText(comment.text, 180));

  return {
    theme,
    mentions: matches.length,
    examples,
    confidence: confidenceFromMentions(matches.length),
  };
}

function confidenceFromMentions(mentions: number): "low" | "medium" | "high" {
  if (mentions >= 5) {
    return "high";
  }

  if (mentions >= 3) {
    return "medium";
  }

  return "low";
}
