import type {
  AutoPost,
  CandidateItem,
  Digest,
  DigestDuration,
  DigestEntry,
  EmailDispatch,
  Source,
  Subscriber,
  ThoughtPost,
  WorkflowConfig
} from "@prisma/client";

export type FeedWindow = "24h" | "7d";

export type FeedPost = AutoPost & {
  candidateItem: CandidateItem;
};

export type PublicPost = AutoPost & {
  candidateItem: CandidateItem & {
    source: Source;
  };
};

export type DigestWithEntries = Digest & {
  entries: DigestEntry[];
};

export type SubscriberWithDispatches = Subscriber & {
  dispatches: EmailDispatch[];
};

export type DashboardSnapshot = {
  publishedCount: number;
  reviewCount: number;
  activeSourceCount: number;
  subscriberCount: number;
  lowRiskAutoPublishRate: number;
};

export type SourceInput = Pick<
  Source,
  "name" | "slug" | "type" | "url" | "description" | "frequency" | "priority" | "trustScore" | "tags"
>;

export type WorkflowInput = Pick<
  WorkflowConfig,
  | "name"
  | "summaryPrompt"
  | "highlightPrompt"
  | "riskKeywords"
  | "autoPublishMinTrust"
  | "digestRuleThree"
  | "digestRuleEight"
  | "notes"
>;

export type DurationTab = "3" | "8";

export type DurationEnum = DigestDuration;

export type ThoughtCollection = ThoughtPost[];
