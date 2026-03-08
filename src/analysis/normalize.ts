import type { Story } from "../models/story.js";
import { truncateText } from "./text-utils.js";
import type { NormalizedStorySearchResult, ThreadStoryMetadata } from "./types.js";

export function buildHnItemUrl(id: number): string {
  return `https://news.ycombinator.com/item?id=${id}`;
}

export function isShowHNTitle(title?: string | null): boolean {
  return (title ?? "").toLowerCase().startsWith("show hn:");
}

export function isAskHNTitle(title?: string | null): boolean {
  return (title ?? "").toLowerCase().startsWith("ask hn:");
}

export function normalizeAlgoliaStoryHit(hit: any): NormalizedStorySearchResult | null {
  const id = Number.parseInt(String(hit.objectID ?? hit.story_id ?? ""), 10);
  const title = hit.title ?? hit.story_title;

  if (!Number.isFinite(id) || !title) {
    return null;
  }

  return {
    id,
    title,
    url: hit.url ?? undefined,
    author: hit.author ?? "unknown",
    points: hit.points ?? 0,
    numComments: hit.num_comments ?? 0,
    createdAt: hit.created_at ?? new Date((hit.created_at_i ?? 0) * 1000).toISOString(),
    hnUrl: buildHnItemUrl(id),
    textPreview: truncateText(hit.story_text ?? hit.comment_text ?? hit.text),
  };
}

export function normalizeStoryMetadata(
  story: Story | any,
  textOverride?: string
): ThreadStoryMetadata {
  const storyId = Number(story.id);

  return {
    id: storyId,
    title: story.title ?? "Untitled",
    url: story.url ?? undefined,
    author: story.by ?? story.author ?? "unknown",
    points: story.score ?? story.points ?? 0,
    numComments: story.descendants ?? story.children?.length ?? story.num_comments ?? 0,
    createdAt:
      story.created_at ??
      new Date((story.time ?? story.created_at_i ?? 0) * 1000).toISOString(),
    hnUrl: buildHnItemUrl(storyId),
    textPreview: truncateText(textOverride ?? story.text ?? story.story_text),
  };
}
