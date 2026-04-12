import { apiRequest } from "@/lib/api";

export type SocialListeningComment = {
  id: string;
  commentId: string;
  videoId: string;
  authorName?: string | null;
  authorId?: string | null;
  commentText: string;
  normalizedText: string;
  parentCommentId?: string | null;
  platformCreatedAt?: string | null;
  collectedAt: string;
  commentDate: string;
  reportMonth: string;
  likeCount: number;
  brandGroup: string;
  brandLabel: string;
  brandConfidence: number;
  brandScores: Record<string, number>;
  sentiment: "positive" | "neutral" | "negative";
  sentimentScore: number;
  topicTags: string[];
  matchedKeywords: string[];
  metadata: Record<string, unknown>;
  processingVersion: string;
};

export type SocialListeningDashboard = {
  filters: Record<string, unknown>;
  overview: {
    totalComments: number;
    brandBreakdown: Array<{
      brandGroup: string;
      brandLabel: string;
      count: number;
    }>;
    comparison: {
      previousTotalComments: number;
      delta: number;
      percentChange: number | null;
    };
  };
  sentiment: {
    overall: {
      positive: number;
      neutral: number;
      negative: number;
      total: number;
      positiveRate: number;
      neutralRate: number;
      negativeRate: number;
    };
    byBrand: Array<{
      brandGroup: string;
      brandLabel: string;
      positive: number;
      neutral: number;
      negative: number;
      total: number;
      positiveRate: number;
      neutralRate: number;
      negativeRate: number;
    }>;
  };
  topics: {
    topTopics: Array<{
      topicTag: string;
      label: string;
      count: number;
    }>;
    topKeywords: Array<{
      keyword: string;
      count: number;
    }>;
  };
  alerts: {
    negativeComments: SocialListeningComment[];
    repeatedIssues: Array<{
      type: "topic" | "keyword";
      label: string;
      count: number;
    }>;
  };
  timeSeries: Array<{
    bucket: string;
    total: number;
    brands: Array<{
      brandGroup: string;
      count: number;
    }>;
  }>;
};

export type SocialListeningSavedReport = {
  id: string;
  reportMonth: string;
  title: string;
  totalComments: number;
  generatedAt: string;
  report?: Record<string, unknown>;
  markdown?: string;
  html?: string;
  csv?: string;
};

export type SocialListeningGeneratedReport = {
  id?: string | null;
  report: Record<string, unknown>;
  exports: {
    json: string;
    markdown: string;
    html: string;
    csv: string;
  };
};

function buildParams(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

export async function getSocialListeningDashboard(params: {
  month?: string;
  startDate?: string;
  endDate?: string;
  brandGroup?: string;
  sentiment?: string;
  topicTag?: string;
  granularity?: "day" | "week" | "month";
}) {
  const query = buildParams({
    action: "dashboard",
    month: params.month,
    startDate: params.startDate,
    endDate: params.endDate,
    brandGroup: params.brandGroup,
    sentiment: params.sentiment,
    topicTag: params.topicTag,
    granularity: params.granularity || "day",
  });

  return apiRequest<{
    dashboard: SocialListeningDashboard;
    savedReport: SocialListeningSavedReport | null;
  }>(`/social-listening.php?${query}`, {
    method: "GET",
  });
}

export async function getSocialListeningComments(params: {
  month?: string;
  startDate?: string;
  endDate?: string;
  brandGroup?: string;
  sentiment?: string;
  topicTag?: string;
  limit?: number;
}) {
  const query = buildParams({
    action: "comments",
    month: params.month,
    startDate: params.startDate,
    endDate: params.endDate,
    brandGroup: params.brandGroup,
    sentiment: params.sentiment,
    topicTag: params.topicTag,
    limit: params.limit || 50,
  });

  const response = await apiRequest<{ items: SocialListeningComment[] }>(
    `/social-listening.php?${query}`,
    {
      method: "GET",
    }
  );

  return response.items || [];
}

export async function listSocialListeningReports(limit = 12) {
  const query = buildParams({
    action: "reports",
    limit,
  });

  const response = await apiRequest<{ items: SocialListeningSavedReport[] }>(
    `/social-listening.php?${query}`,
    {
      method: "GET",
    }
  );

  return response.items || [];
}

export async function getSocialListeningReport(month: string) {
  const query = buildParams({
    action: "reports",
    month,
  });

  const response = await apiRequest<{ item: SocialListeningSavedReport | null }>(
    `/social-listening.php?${query}`,
    {
      method: "GET",
    }
  );

  return response.item;
}

export async function seedSocialListeningData(month: string, count = 24) {
  return apiRequest<{
    seededMonth: string;
    result: {
      processed: number;
      inserted: number;
      updated: number;
    };
  }>("/social-listening.php?action=seed", {
    method: "POST",
    body: JSON.stringify({
      month,
      count,
    }),
  });
}

export async function generateSocialListeningReport(month: string, persist = true) {
  return apiRequest<SocialListeningGeneratedReport>(
    "/social-listening.php?action=generate-report",
    {
      method: "POST",
      body: JSON.stringify({
        month,
        persist,
      }),
    }
  );
}
