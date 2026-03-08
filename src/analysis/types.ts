export interface NormalizedStorySearchResult {
  id: number;
  title: string;
  url?: string;
  author: string;
  points: number;
  numComments: number;
  createdAt: string;
  hnUrl: string;
  textPreview?: string;
}

export interface PhraseSummary {
  phrase: string;
  mentions: number;
}

export interface EvidenceItem {
  theme: string;
  mentions: number;
  examples: string[];
  confidence: "low" | "medium" | "high";
}

export interface TopCommentSummary {
  id: number;
  author: string;
  excerpt: string;
  depth: number;
  replyCount: number;
  score: number;
  hnUrl: string;
}

export interface ThreadStoryMetadata {
  id: number;
  title: string;
  url?: string;
  author: string;
  points: number;
  numComments: number;
  createdAt: string;
  hnUrl: string;
  textPreview?: string;
}

export interface SentimentSnapshot {
  positiveComments: number;
  negativeComments: number;
  neutralComments: number;
  questionComments: number;
  requestComments: number;
  overall: "positive" | "mixed" | "negative" | "neutral";
}

export interface ThreadSummary {
  story: ThreadStoryMetadata;
  analyzedComments: number;
  keyDiscussionThemes: PhraseSummary[];
  notablePros: EvidenceItem[];
  notableCons: EvidenceItem[];
  repeatedQuestions: EvidenceItem[];
  featureRequests: EvidenceItem[];
  sentimentSnapshot: SentimentSnapshot;
  topCommentsUsed: TopCommentSummary[];
}

export interface InsightItem {
  label: string;
  mentions: number;
  confidence: "low" | "medium" | "high";
  examples: string[];
}

export interface FollowupRecommendation {
  action: string;
  rationale: string;
  confidence: "low" | "medium" | "high";
}

export interface StartupInsights {
  mode: "story" | "query";
  sourceType: "show" | "ask" | "story" | "comment";
  analyzedItems: Array<{
    id: number;
    title: string;
    hnUrl: string;
  }>;
  targetUsers: InsightItem[];
  painPoints: InsightItem[];
  alternativesMentioned: InsightItem[];
  objections: InsightItem[];
  monetizationSignals: InsightItem[];
  launchFeedback: InsightItem[];
  opportunities: InsightItem[];
  risks: InsightItem[];
  recommendedFollowups: FollowupRecommendation[];
  lowConfidenceAreas: string[];
}

export interface LaunchTitleStyle {
  prefix: "show-hn" | "ask-hn" | "plain";
  hasColon: boolean;
  wordCount: number;
  lengthBucket: "short" | "medium" | "long";
  includesAudienceSignal: boolean;
}

export interface ComparedLaunch {
  story: ThreadStoryMetadata;
  titleStyle: LaunchTitleStyle;
  topicCategory: string;
  commonPraise: EvidenceItem[];
  commonCriticism: EvidenceItem[];
  likelyTractionDrivers: InsightItem[];
}

export interface LaunchComparison {
  launches: ComparedLaunch[];
  skippedStoryIds: number[];
  sharedPatterns: {
    titlePatterns: PhraseSummary[];
    topicCategories: PhraseSummary[];
    commonPraise: InsightItem[];
    commonCriticism: InsightItem[];
    tractionDrivers: InsightItem[];
  };
}
