import type { NormalizedStorySearchResult } from "./types.js";

export function scoreSearchResult(result: NormalizedStorySearchResult): number {
  const pointsWeight = Math.min(result.points, 500) * 1.2;
  const commentsWeight = Math.min(result.numComments, 300) * 1.5;
  const titleBonus = result.title.includes(":") ? 8 : 0;
  const textBonus = result.textPreview ? Math.min(result.textPreview.length / 20, 10) : 0;

  return roundScore(pointsWeight + commentsWeight + titleBonus + textBonus);
}

export function scoreCommentInterestingness(input: {
  depth: number;
  replyCount: number;
  textLength: number;
  hasQuestion: boolean;
  hasFeatureSignal: boolean;
}): number {
  const depthBonus = input.depth === 0 ? 6 : Math.max(0, 4 - input.depth);
  const repliesBonus = Math.min(input.replyCount, 10) * 2;
  const textBonus = Math.min(input.textLength / 60, 8);
  const questionBonus = input.hasQuestion ? 2 : 0;
  const featureBonus = input.hasFeatureSignal ? 3 : 0;

  return roundScore(
    depthBonus + repliesBonus + textBonus + questionBonus + featureBonus
  );
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
