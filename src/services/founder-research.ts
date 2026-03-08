import { algoliaApi } from "../api/algolia.js";
import { buildHnItemUrl, isAskHNTitle, isShowHNTitle, normalizeAlgoliaStoryHit, normalizeStoryMetadata } from "../analysis/normalize.js";
import { scoreSearchResult } from "../analysis/ranking.js";
import { buildStartupInsightsFromSearch, buildStartupInsightsFromThread } from "../analysis/startup-insights.js";
import { analyzeTitleStyle, categorizeLaunchTopic, summarizeThreadData } from "../analysis/thread-analysis.js";
import { isDateInRange, truncateText } from "../analysis/text-utils.js";
import type {
  ComparedLaunch,
  LaunchComparison,
  NormalizedStorySearchResult,
  StartupInsights,
  ThreadSummary,
} from "../analysis/types.js";

interface FilteredSearchParams {
  query: string;
  page?: number;
  hitsPerPage?: number;
  minPoints?: number;
  minComments?: number;
  dateFrom?: string;
  dateTo?: string;
}

export async function findShowHNStories(
  params: FilteredSearchParams
): Promise<NormalizedStorySearchResult[]> {
  return searchFocusedStories("show", params);
}

export async function findAskHNStories(
  params: FilteredSearchParams
): Promise<NormalizedStorySearchResult[]> {
  return searchFocusedStories("ask", params);
}

export async function summarizeThread(
  storyId: number,
  options: {
    maxDepth?: number;
    maxComments?: number;
  } = {}
): Promise<ThreadSummary> {
  const thread = await algoliaApi.getStoryWithComments(storyId);
  if (!thread || !thread.id || !thread.title) {
    throw new Error(`Story with ID ${storyId} not found`);
  }

  return summarizeThreadData(thread, options);
}

export async function extractStartupInsights(params: {
  storyId?: number;
  query?: string;
  sourceType?: "show" | "ask" | "story" | "comment";
  maxItems?: number;
}): Promise<StartupInsights> {
  const sourceType = params.sourceType ?? "story";
  const maxItems = params.maxItems ?? 5;

  if (params.storyId !== undefined) {
    const thread = await algoliaApi.getStoryWithComments(params.storyId);
    if (!thread || !thread.id || !thread.title) {
      throw new Error(`Story with ID ${params.storyId} not found`);
    }

    return buildStartupInsightsFromThread(thread, sourceType);
  }

  if (!params.query) {
    throw new Error("Either storyId or query must be provided");
  }

  switch (sourceType) {
    case "show": {
      const stories = await findShowHNStories({
        query: params.query,
        hitsPerPage: maxItems,
      });
      return buildStartupInsightsFromSearch(stories.slice(0, maxItems), "show");
    }
    case "ask": {
      const stories = await findAskHNStories({
        query: params.query,
        hitsPerPage: maxItems,
      });
      return buildStartupInsightsFromSearch(stories.slice(0, maxItems), "ask");
    }
    case "comment": {
      const searchResults = await algoliaApi.search(params.query, {
        tags: "comment",
        hitsPerPage: Math.min(Math.max(maxItems, 1), 20),
      });
      const normalized = (searchResults.hits ?? [])
        .map((hit: any) => ({
          id: Number.parseInt(String(hit.objectID), 10),
          title: hit.story_title ?? `Comment ${hit.objectID}`,
          url: undefined,
          author: hit.author ?? "unknown",
          points: hit.points ?? 0,
          numComments: hit.num_comments ?? 0,
          createdAt: hit.created_at,
          hnUrl: buildHnItemUrl(Number.parseInt(String(hit.objectID), 10)),
          textPreview: truncateText(hit.comment_text ?? hit.story_text ?? hit.text),
        }))
        .filter((item: NormalizedStorySearchResult) => Number.isFinite(item.id));
      return buildStartupInsightsFromSearch(normalized, "comment");
    }
    case "story":
    default: {
      const searchResults = await algoliaApi.searchStories(params.query, {
        hitsPerPage: Math.min(Math.max(maxItems, 1), 20),
      });
      const normalized = (searchResults.hits ?? [])
        .map(normalizeAlgoliaStoryHit)
        .filter((item: NormalizedStorySearchResult | null): item is NormalizedStorySearchResult => item !== null);
      return buildStartupInsightsFromSearch(normalized.slice(0, maxItems), "story");
    }
  }
}

export async function compareLaunches(storyIds: number[]): Promise<LaunchComparison> {
  const results = await Promise.all(
    storyIds.map(async (storyId) => {
      const thread = await algoliaApi.getStoryWithComments(storyId);
      if (!thread || !thread.id || !thread.title) {
        return null;
      }

      const summary = summarizeThreadData(thread, {
        maxDepth: 3,
        maxComments: 60,
      });

      const tractionDrivers = deriveTractionDrivers(summary);

      const launch: ComparedLaunch = {
        story: normalizeStoryMetadata(thread, thread.text),
        titleStyle: analyzeTitleStyle(thread.title),
        topicCategory: categorizeLaunchTopic(thread.title, summary.story.textPreview),
        commonPraise: summary.notablePros.slice(0, 3),
        commonCriticism: summary.notableCons.slice(0, 3),
        likelyTractionDrivers: tractionDrivers,
      };

      return { launch, summary };
    })
  );

  const launchesWithSummaries = results.filter(
    (item): item is { launch: ComparedLaunch; summary: ThreadSummary } => item !== null
  );

  const skippedStoryIds = storyIds.filter(
    (storyId) => !launchesWithSummaries.some((item) => item.launch.story.id === storyId)
  );

  return {
    launches: launchesWithSummaries.map((item) => item.launch),
    skippedStoryIds,
    sharedPatterns: {
      titlePatterns: summarizeTitlePatterns(launchesWithSummaries.map((item) => item.launch)),
      topicCategories: summarizeTopicCategories(launchesWithSummaries.map((item) => item.launch)),
      commonPraise: mergeEvidence(launchesWithSummaries.flatMap((item) => item.summary.notablePros), 6),
      commonCriticism: mergeEvidence(
        launchesWithSummaries.flatMap((item) => item.summary.notableCons),
        6
      ),
      tractionDrivers: mergeInsightItems(
        launchesWithSummaries.flatMap((item) => item.launch.likelyTractionDrivers),
        6
      ),
    },
  };
}

async function searchFocusedStories(
  mode: "show" | "ask",
  params: FilteredSearchParams
): Promise<NormalizedStorySearchResult[]> {
  const requestedHits = Math.min(Math.max((params.hitsPerPage ?? 20) * 3, 10), 100);
  const query = mode === "show" ? `show hn ${params.query}` : `ask hn ${params.query}`;
  const results = await algoliaApi.searchStories(query, {
    page: params.page ?? 0,
    hitsPerPage: requestedHits,
  });

  const titleCheck = mode === "show" ? isShowHNTitle : isAskHNTitle;

  return (results.hits ?? [])
    .map(normalizeAlgoliaStoryHit)
    .filter((item: NormalizedStorySearchResult | null): item is NormalizedStorySearchResult => item !== null)
    .filter((item: NormalizedStorySearchResult) => titleCheck(item.title))
    .filter((item: NormalizedStorySearchResult) => matchesSearchFilters(item, params))
    .sort(
      (left: NormalizedStorySearchResult, right: NormalizedStorySearchResult) =>
        scoreSearchResult(right) - scoreSearchResult(left)
    )
    .slice(0, params.hitsPerPage ?? 20);
}

function matchesSearchFilters(
  item: NormalizedStorySearchResult,
  params: FilteredSearchParams
): boolean {
  if (params.minPoints !== undefined && item.points < params.minPoints) {
    return false;
  }

  if (params.minComments !== undefined && item.numComments < params.minComments) {
    return false;
  }

  if (!isDateInRange(item.createdAt, params.dateFrom, params.dateTo)) {
    return false;
  }

  return true;
}

function deriveTractionDrivers(summary: ThreadSummary) {
  const drivers = [];

  if (summary.story.points >= 150) {
    drivers.push({
      label: "high-point momentum",
      mentions: summary.story.points,
      confidence: summary.story.points >= 300 ? ("high" as const) : ("medium" as const),
      examples: [summary.story.title],
    });
  }

  if (summary.story.numComments >= 40) {
    drivers.push({
      label: "discussion-heavy launch",
      mentions: summary.story.numComments,
      confidence: summary.story.numComments >= 100 ? ("high" as const) : ("medium" as const),
      examples: [summary.story.hnUrl],
    });
  }

  if (summary.notablePros.some((item) => item.theme === "simplicity")) {
    drivers.push({
      label: "clear simplicity/polish value prop",
      mentions: 1,
      confidence: "medium" as const,
      examples: summary.notablePros.flatMap((item) => item.examples).slice(0, 2),
    });
  }

  if (categorizeLaunchTopic(summary.story.title, summary.story.textPreview) === "developer-tools") {
    drivers.push({
      label: "strong HN audience fit",
      mentions: 1,
      confidence: "medium" as const,
      examples: [summary.story.title],
    });
  }

  return drivers;
}

function summarizeTitlePatterns(launches: ComparedLaunch[]) {
  const counts = new Map<string, number>();

  for (const launch of launches) {
    const patterns = [
      `prefix:${launch.titleStyle.prefix}`,
      `length:${launch.titleStyle.lengthBucket}`,
      launch.titleStyle.hasColon ? "has-colon" : "no-colon",
      launch.titleStyle.includesAudienceSignal ? "audience-signal" : "no-audience-signal",
    ];

    for (const pattern of patterns) {
      counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([phrase, mentions]) => ({ phrase, mentions }));
}

function summarizeTopicCategories(launches: ComparedLaunch[]) {
  const counts = new Map<string, number>();

  for (const launch of launches) {
    counts.set(launch.topicCategory, (counts.get(launch.topicCategory) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([phrase, mentions]) => ({ phrase, mentions }));
}

function mergeEvidence(
  items: Array<{ theme: string; mentions: number; confidence: "low" | "medium" | "high"; examples: string[] }>,
  limit: number
) {
  return mergeInsightItems(
    items.map((item) => ({
      label: item.theme,
      mentions: item.mentions,
      confidence: item.confidence,
      examples: item.examples,
    })),
    limit
  );
}

function mergeInsightItems(
  items: Array<{
    label: string;
    mentions: number;
    confidence: "low" | "medium" | "high";
    examples: string[];
  }>,
  limit: number
) {
  const merged = new Map<
    string,
    {
      label: string;
      mentions: number;
      confidence: "low" | "medium" | "high";
      examples: string[];
    }
  >();

  for (const item of items) {
    const current = merged.get(item.label);
    if (!current) {
      merged.set(item.label, { ...item });
      continue;
    }

    current.mentions += item.mentions;
    current.examples = [...new Set([...current.examples, ...item.examples])].slice(0, 3);
    if (item.confidence === "high" || (item.confidence === "medium" && current.confidence === "low")) {
      current.confidence = item.confidence;
    }
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
