import test from "node:test";
import assert from "node:assert/strict";

import { normalizeAlgoliaStoryHit } from "../src/analysis/normalize.js";
import { buildStartupInsightsFromSearch } from "../src/analysis/startup-insights.js";
import { summarizeThreadData } from "../src/analysis/thread-analysis.js";
import { extractRepeatedPhrases, stripHtml } from "../src/analysis/text-utils.js";

test("normalizeAlgoliaStoryHit returns founder-friendly normalized fields", () => {
  const normalized = normalizeAlgoliaStoryHit({
    objectID: "123",
    title: "Show HN: Tiny CRM for solo founders",
    url: "https://example.com",
    author: "maker",
    points: 42,
    num_comments: 9,
    created_at: "2026-01-01T00:00:00.000Z",
    story_text: "<p>Simple CRM for indie hackers</p>",
  });

  assert.ok(normalized);
  assert.equal(normalized.id, 123);
  assert.equal(normalized.hnUrl, "https://news.ycombinator.com/item?id=123");
  assert.equal(normalized.textPreview, "Simple CRM for indie hackers");
});

test("summarizeThreadData extracts themes, pros, cons, and feature requests deterministically", () => {
  const summary = summarizeThreadData(
    {
      id: 100,
      title: "Show HN: Tiny CRM for solo founders",
      url: "https://example.com",
      author: "maker",
      points: 120,
      created_at: "2026-01-01T00:00:00.000Z",
      children: [
        {
          id: 1,
          author: "alice",
          text: "This is a simple and useful CRM. I would love an API integration.",
          parent_id: 100,
          children: [],
        },
        {
          id: 2,
          author: "bob",
          text: "Looks useful, but the pricing feels expensive. Why not just use HubSpot?",
          parent_id: 100,
          children: [],
        },
        {
          id: 3,
          author: "carol",
          text: "Can it support teams? Please add collaboration features.",
          parent_id: 100,
          children: [],
        },
      ],
    },
    { maxDepth: 2, maxComments: 10 }
  );

  assert.equal(summary.story.id, 100);
  assert.equal(summary.analyzedComments, 3);
  assert.ok(summary.notablePros.some((item) => item.theme === "simplicity"));
  assert.ok(summary.notableCons.some((item) => item.theme === "pricing"));
  assert.ok(summary.featureRequests.some((item) => item.theme === "integrations"));
  assert.ok(summary.repeatedQuestions.some((item) => item.theme.includes("Why not")));
});

test("buildStartupInsightsFromSearch surfaces pain points and monetization signals", () => {
  const insights = buildStartupInsightsFromSearch(
    [
      {
        id: 10,
        title: "Ask HN: Tools for reducing manual invoicing work",
        author: "founder1",
        points: 50,
        numComments: 20,
        createdAt: "2026-01-01T00:00:00.000Z",
        hnUrl: "https://news.ycombinator.com/item?id=10",
        textPreview:
          "Manual invoicing is tedious. I'd pay for something that saves time and handles pricing cleanly.",
      },
      {
        id: 11,
        title: "Ask HN: Alternatives to QuickBooks for freelancers",
        author: "founder2",
        points: 35,
        numComments: 12,
        createdAt: "2026-01-02T00:00:00.000Z",
        hnUrl: "https://news.ycombinator.com/item?id=11",
        textPreview:
          "QuickBooks feels expensive and complicated for solo freelancers. Looking for a simpler workflow.",
      },
    ],
    "ask"
  );

  assert.ok(insights.painPoints.some((item) => item.label === "manualWork"));
  assert.ok(insights.objections.some((item) => item.label === "pricing"));
  assert.ok(insights.monetizationSignals.some((item) => item.label === "pricingDebate"));
  assert.ok(insights.alternativesMentioned.some((item) => item.label === "QuickBooks"));
});

test("text helpers strip HTML and extract repeated phrases", () => {
  assert.equal(stripHtml("<p>Hello &amp; welcome</p><br>world"), "Hello & welcome world");

  const phrases = extractRepeatedPhrases([
    "solo founder workflow automation",
    "workflow automation for solo founder",
    "founder workflow automation tool",
  ]);

  assert.ok(phrases.some((entry) => entry.phrase === "workflow automation"));
});
