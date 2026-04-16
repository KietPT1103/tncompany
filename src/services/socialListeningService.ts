import { apiRequest } from "@/lib/api";

export type TikTokSearchRecord = {
  id: string;
  platform: string;
  keyword: string;
  date_from: string;
  date_to: string;
  status: string;
  provider?: string | null;
  progress_message?: string | null;
  requested_by?: string | null;
  total_videos: number;
  total_comments: number;
  queued_jobs: number;
  processed_jobs: number;
  failed_jobs?: number;
  active_jobs?: number;
  error_message?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
  updated_at: string;
  is_terminal?: boolean;
};

export type TikTokCommentRecord = {
  id: string;
  comment_id: string;
  content: string;
  username: string;
  created_at: string;
  video_id: string;
  video_url?: string | null;
  share_url?: string | null;
  video_username?: string | null;
  keyword: string;
  post_url: string;
};

export type TikTokCommentPagination = {
  page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
  last_page: number;
};

function buildParams(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

export async function createTikTokSearch(input: {
  keyword: string;
  date_from: string;
  date_to: string;
}) {
  return apiRequest<{ search: TikTokSearchRecord }>("/tiktok/search.php", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getTikTokSearchStatus(searchId: string) {
  const query = buildParams({
    search_id: searchId,
  });

  return apiRequest<{ search: TikTokSearchRecord }>(`/tiktok/status.php?${query}`, {
    method: "GET",
  });
}

export async function getTikTokComments(params: {
  search_id: string;
  page?: number;
  per_page?: number;
}) {
  const query = buildParams({
    search_id: params.search_id,
    page: params.page || 1,
    per_page: params.per_page || 10,
  });

  return apiRequest<{
    search: TikTokSearchRecord;
    items: TikTokCommentRecord[];
    pagination: TikTokCommentPagination;
  }>(`/tiktok/comments.php?${query}`, {
    method: "GET",
  });
}

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
    repeatedIssues: Array<{
      type: "topic" | "keyword";
      label: string;
      count: number;
    }>;
  };
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

export async function seedSocialListeningData(_month?: string, _count?: number) {
  throw new Error("Seed mock data đã bị vô hiệu hóa. Module này chỉ chấp nhận dữ liệu TikTok thật.");
}
