import { z } from "zod";

const DateStringSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Expected a valid date string",
  });

// Story schemas
export const StorySchema = z.object({
  id: z.number(),
  title: z.string(),
  url: z.string().optional(),
  text: z.string().optional(),
  by: z.string(),
  score: z.number(),
  time: z.number(),
  descendants: z.number(),
  kids: z.array(z.number()).optional(),
  type: z.literal("story"),
});

// Comment schemas
export const CommentSchema = z.object({
  id: z.number(),
  text: z.string(),
  by: z.string(),
  time: z.number(),
  parent: z.number(),
  kids: z.array(z.number()).optional(),
  type: z.literal("comment"),
});

// User schemas
export const UserSchema = z.object({
  id: z.string(),
  karma: z.number(),
  created: z.number(),
  about: z.string().optional(),
  submitted: z.array(z.number()).optional(),
});

// Request schemas
export const SearchParamsSchema = z.object({
  query: z.string(),
  type: z.enum(["all", "story", "comment"]).default("all"),
  page: z.number().int().min(0).default(0),
  hitsPerPage: z.number().int().min(1).max(100).default(20),
});

export const FilteredStorySearchSchema = z.object({
  query: z.string().min(1),
  page: z.number().int().min(0).default(0),
  hitsPerPage: z.number().int().min(1).max(100).default(20),
  minPoints: z.number().int().min(0).optional(),
  minComments: z.number().int().min(0).optional(),
  dateFrom: DateStringSchema.optional(),
  dateTo: DateStringSchema.optional(),
});

export const StoryRequestSchema = z.object({
  id: z.number().int().positive(),
});

export const CommentRequestSchema = z.object({
  id: z.number().int().positive(),
});

export const CommentsRequestSchema = z.object({
  storyId: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).default(30),
});

export const CommentTreeRequestSchema = z.object({
  storyId: z.number().int().positive(),
});

export const SummarizeThreadRequestSchema = z.object({
  storyId: z.number().int().positive(),
  maxDepth: z.number().int().min(0).max(10).default(3),
  maxComments: z.number().int().min(1).max(200).default(80),
});

export const UserRequestSchema = z.object({
  id: z.string(),
});

export const StoriesRequestSchema = z.object({
  type: z.enum(["top", "new", "best", "ask", "show", "job"]),
  limit: z.number().int().min(1).max(100).default(30),
});

export const ExtractStartupInsightsRequestSchema = z
  .object({
    storyId: z.number().int().positive().optional(),
    query: z.string().min(1).optional(),
    sourceType: z.enum(["show", "ask", "story", "comment"]).default("story"),
    maxItems: z.number().int().min(1).max(20).default(5),
  })
  .refine((value) => value.storyId !== undefined || value.query !== undefined, {
    message: "Either storyId or query must be provided",
    path: ["storyId"],
  });

export const CompareLaunchesRequestSchema = z.object({
  storyIds: z.array(z.number().int().positive()).min(1).max(10),
});
