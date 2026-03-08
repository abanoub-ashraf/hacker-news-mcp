import { truncateText } from "./text-utils.js";
import { categorizeLaunchTopic, summarizeThreadData } from "./thread-analysis.js";
import type {
  FollowupRecommendation,
  InsightItem,
  NormalizedStorySearchResult,
  StartupInsights,
  ThreadSummary,
} from "./types.js";

const TARGET_USER_PATTERNS: Record<string, RegExp> = {
  developers: /\b(developers?|engineers?|programmers?)\b/i,
  founders: /\b(founders?|startups?)\b/i,
  designers: /\b(designers?|design teams?)\b/i,
  marketers: /\b(marketers?|growth teams?|seo)\b/i,
  sales: /\b(sales|revenue|bdr|sdr)\b/i,
  teams: /\b(teams?|companies|orgs|organizations)\b/i,
  writers: /\b(writers?|bloggers?|authors?)\b/i,
  students: /\b(students?|teachers?|educators?)\b/i,
  freelancers: /\b(freelancers?|consultants?|agencies?)\b/i,
  consumers: /\b(users?|consumers?|people)\b/i,
};

const PAIN_POINT_PATTERNS: Record<string, RegExp> = {
  manualWork: /\b(manual|tedious|time-consuming|repetitive|spreadsheet|copy paste)\b/i,
  complexity: /\b(confusing|complex|complicated|hard|difficult|steep)\b/i,
  reliability: /\b(bug|broken|issue|problem|error|crash|slow)\b/i,
  trust: /\b(security|privacy|trust|compliance|vendor lock[- ]?in)\b/i,
  cost: /\b(expensive|price|pricing|cost|budget)\b/i,
};

const OBJECTION_PATTERNS: Record<string, RegExp> = {
  competition: /\b(why not|instead of|already use|duplicate|same as|compared to)\b/i,
  pricing: /\b(expensive|too much|cost|pricing|subscription)\b/i,
  differentiation: /\b(unclear|not sure|what is different|unique|better than)\b/i,
  trust: /\b(security|privacy|trust|safe|data)\b/i,
};

const MONETIZATION_PATTERNS: Record<string, RegExp> = {
  willingnessToPay: /\b(i'd pay|would pay|worth paying|worth it|paid for)\b/i,
  pricingDebate: /\b(price|pricing|subscription|free tier|trial|enterprise|plan)\b/i,
  roiSignal: /\b(save(s|d)? time|save(s|d)? money|roi|revenue|monetize)\b/i,
};

const ALTERNATIVE_PATTERNS = [
  /\b(?:alternatives?\s+to|alternative\s+to|vs\.?)\s+([A-Z][-.+A-Za-z0-9]*(?:\s+[A-Z][-.+A-Za-z0-9]*){0,2})/gi,
  /\b(?:instead of|compared to|similar to|like|using|use)\s+([A-Z][-.+A-Za-z0-9]*(?:\s+[A-Z][-.+A-Za-z0-9]*){0,2})/gi,
];

interface InsightSource {
  id: number;
  title: string;
  hnUrl: string;
  text: string;
  summary?: ThreadSummary;
}

export function buildStartupInsightsFromThread(
  storyData: any,
  sourceType: "show" | "ask" | "story" | "comment" = "story"
): StartupInsights {
  const summary = summarizeThreadData(storyData, {
    maxDepth: 3,
    maxComments: 80,
  });
  const text = [storyData.title, storyData.text, ...summary.topCommentsUsed.map((comment) => comment.excerpt)]
    .filter(Boolean)
    .join("\n");

  return buildStartupInsights(
    [
      {
        id: summary.story.id,
        title: summary.story.title,
        hnUrl: summary.story.hnUrl,
        text,
        summary,
      },
    ],
    "story",
    sourceType
  );
}

export function buildStartupInsightsFromSearch(
  items: NormalizedStorySearchResult[],
  sourceType: "show" | "ask" | "story" | "comment"
): StartupInsights {
  const sources: InsightSource[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    hnUrl: item.hnUrl,
    text: [item.title, item.textPreview].filter(Boolean).join("\n"),
  }));

  return buildStartupInsights(sources, "query", sourceType);
}

function buildStartupInsights(
  sources: InsightSource[],
  mode: "story" | "query",
  sourceType: "show" | "ask" | "story" | "comment"
): StartupInsights {
  const aggregatedText = sources.map((source) => source.text);
  const launchFeedback = buildLaunchFeedback(sources);
  const painPoints = buildInsightItems(aggregatedText, PAIN_POINT_PATTERNS);
  const objections = buildInsightItems(aggregatedText, OBJECTION_PATTERNS);
  const targetUsers = buildInsightItems(aggregatedText, TARGET_USER_PATTERNS);
  const monetizationSignals = buildInsightItems(aggregatedText, MONETIZATION_PATTERNS);
  const alternativesMentioned = buildAlternatives(aggregatedText);
  const opportunities = buildOpportunities(painPoints, targetUsers);
  const risks = buildRisks(objections, alternativesMentioned);
  const recommendedFollowups = buildFollowups({
    targetUsers,
    painPoints,
    objections,
    monetizationSignals,
    alternativesMentioned,
  });

  return {
    mode,
    sourceType,
    analyzedItems: sources.map((source) => ({
      id: source.id,
      title: source.title,
      hnUrl: source.hnUrl,
    })),
    targetUsers,
    painPoints,
    alternativesMentioned,
    objections,
    monetizationSignals,
    launchFeedback,
    opportunities,
    risks,
    recommendedFollowups,
    lowConfidenceAreas: buildLowConfidenceAreas({
      targetUsers,
      alternativesMentioned,
      monetizationSignals,
      sourceType,
      sourceCount: sources.length,
    }),
  };
}

function buildInsightItems(
  texts: string[],
  patterns: Record<string, RegExp>
): InsightItem[] {
  return Object.entries(patterns)
    .map(([label, pattern]) => {
      const matches = texts.filter((text) => pattern.test(text));
      if (matches.length === 0) {
        return null;
      }

      return {
        label,
        mentions: matches.length,
        confidence: confidenceFromMentions(matches.length),
        examples: matches.slice(0, 3).map((text) => truncateText(text, 160)),
      };
    })
    .filter((item): item is InsightItem => item !== null)
    .sort((left, right) => {
      if (right.mentions !== left.mentions) {
        return right.mentions - left.mentions;
      }
      return left.label.localeCompare(right.label);
    });
}

function buildAlternatives(texts: string[]): InsightItem[] {
  const counts = new Map<string, { mentions: number; examples: string[] }>();

  for (const text of texts) {
    for (const pattern of ALTERNATIVE_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const raw = match[1]?.trim().split(/\s+(?:for|with|on|in)\b/i)[0];
        if (!raw || raw.length < 2 || /^I\b/.test(raw)) {
          continue;
        }

        const normalized = raw.replace(/[.,;:!?]+$/, "");
        const current = counts.get(normalized) ?? { mentions: 0, examples: [] };
        current.mentions += 1;
        if (current.examples.length < 3) {
          current.examples.push(truncateText(text, 160));
        }
        counts.set(normalized, current);
      }
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1].mentions !== left[1].mentions) {
        return right[1].mentions - left[1].mentions;
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 6)
    .map(([label, value]) => ({
      label,
      mentions: value.mentions,
      confidence: confidenceFromMentions(value.mentions),
      examples: value.examples,
    }));
}

function buildLaunchFeedback(sources: InsightSource[]): InsightItem[] {
  const items: InsightItem[] = [];

  for (const source of sources) {
    const topic = categorizeLaunchTopic(source.title, source.text);
    items.push({
      label: `topic:${topic}`,
      mentions: 1,
      confidence: "low",
      examples: [source.title],
    });

    if (source.summary) {
      if (source.summary.sentimentSnapshot.overall !== "neutral") {
        items.push({
          label: `sentiment:${source.summary.sentimentSnapshot.overall}`,
          mentions: 1,
          confidence: "medium",
          examples: [source.summary.story.title],
        });
      }

      for (const pro of source.summary.notablePros.slice(0, 2)) {
        items.push({
          label: `praise:${pro.theme}`,
          mentions: pro.mentions,
          confidence: pro.confidence,
          examples: pro.examples,
        });
      }
    }
  }

  return mergeInsightItems(items, 8);
}

function buildOpportunities(
  painPoints: InsightItem[],
  targetUsers: InsightItem[]
): InsightItem[] {
  const opportunities: InsightItem[] = [];

  for (const painPoint of painPoints.slice(0, 4)) {
    const audience = targetUsers[0]?.label ?? "users";
    opportunities.push({
      label: `Solve ${painPoint.label} for ${audience}`,
      mentions: painPoint.mentions,
      confidence: painPoint.confidence,
      examples: painPoint.examples,
    });
  }

  return opportunities;
}

function buildRisks(
  objections: InsightItem[],
  alternatives: InsightItem[]
): InsightItem[] {
  const risks = [...objections];

  if (alternatives.length > 0) {
    risks.push({
      label: "strong incumbent alternatives",
      mentions: alternatives.reduce((total, item) => total + item.mentions, 0),
      confidence: alternatives.length >= 2 ? "medium" : "low",
      examples: alternatives.slice(0, 3).map((item) => item.label),
    });
  }

  return mergeInsightItems(risks, 6);
}

function buildFollowups(input: {
  targetUsers: InsightItem[];
  painPoints: InsightItem[];
  objections: InsightItem[];
  monetizationSignals: InsightItem[];
  alternativesMentioned: InsightItem[];
}): FollowupRecommendation[] {
  const followups: FollowupRecommendation[] = [];

  if (input.targetUsers.length === 0) {
    followups.push({
      action: "Clarify the target user in launch copy and landing page messaging",
      rationale: "The discussion does not repeat a strong audience signal yet.",
      confidence: "medium",
    });
  }

  if (input.painPoints.some((item) => item.label === "manualWork")) {
    followups.push({
      action: "Lead with the manual-work reduction angle in demos and copy",
      rationale: "Manual and tedious workflows are showing up as a repeated pain point.",
      confidence: "medium",
    });
  }

  if (input.objections.some((item) => item.label === "pricing")) {
    followups.push({
      action: "Test pricing positioning, free tier, or trial messaging",
      rationale: "Pricing objections show up in the thread/search evidence.",
      confidence: "medium",
    });
  }

  if (input.alternativesMentioned.length > 0) {
    followups.push({
      action: "Create comparison messaging against the main alternatives users already mention",
      rationale: "Users are anchoring the product against incumbent tools.",
      confidence: input.alternativesMentioned.length > 1 ? "medium" : "low",
    });
  }

  if (input.monetizationSignals.length > 0) {
    followups.push({
      action: "Validate willingness-to-pay with a pricing page or concierge offer",
      rationale: "There are direct pricing or ROI signals worth converting into tests.",
      confidence: "medium",
    });
  }

  return followups.slice(0, 5);
}

function buildLowConfidenceAreas(input: {
  targetUsers: InsightItem[];
  alternativesMentioned: InsightItem[];
  monetizationSignals: InsightItem[];
  sourceType: "show" | "ask" | "story" | "comment";
  sourceCount: number;
}): string[] {
  const areas: string[] = [];

  if (input.sourceCount <= 1) {
    areas.push("Only one source item was analyzed, so pattern quality is limited.");
  }

  if (input.targetUsers.length === 0) {
    areas.push("Target users were inferred weakly because the language was not explicit.");
  }

  if (input.alternativesMentioned.length === 0) {
    areas.push("Alternative products were not clearly named in the available text.");
  }

  if (input.monetizationSignals.length === 0 && input.sourceType !== "comment") {
    areas.push("Monetization signals are light, so pricing guidance is low-confidence.");
  }

  return areas;
}

function mergeInsightItems(items: InsightItem[], limit: number): InsightItem[] {
  const merged = new Map<string, InsightItem>();

  for (const item of items) {
    const current = merged.get(item.label);
    if (!current) {
      merged.set(item.label, { ...item });
      continue;
    }

    current.mentions += item.mentions;
    current.confidence = strongerConfidence(current.confidence, item.confidence);
    current.examples = [...new Set([...current.examples, ...item.examples])].slice(0, 3);
  }

  return [...merged.values()]
    .sort((left, right) => {
      if (right.mentions !== left.mentions) {
        return right.mentions - left.mentions;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, limit);
}

function confidenceFromMentions(mentions: number): "low" | "medium" | "high" {
  if (mentions >= 4) {
    return "high";
  }

  if (mentions >= 2) {
    return "medium";
  }

  return "low";
}

function strongerConfidence(
  left: "low" | "medium" | "high",
  right: "low" | "medium" | "high"
): "low" | "medium" | "high" {
  const order = { low: 1, medium: 2, high: 3 };
  return order[left] >= order[right] ? left : right;
}
