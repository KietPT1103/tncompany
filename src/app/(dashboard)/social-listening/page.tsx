"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import RoleGuard from "@/components/RoleGuard";
import {
  generateSocialListeningReport,
  getSocialListeningComments,
  getSocialListeningDashboard,
  listSocialListeningReports,
  seedSocialListeningData,
  SocialListeningComment,
  SocialListeningDashboard,
  SocialListeningGeneratedReport,
  SocialListeningSavedReport,
} from "@/services/socialListeningService";
import {
  BarChart3,
  CalendarDays,
  Download,
  FileJson,
  FileText,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  TriangleAlert,
  WandSparkles,
} from "lucide-react";

const BRAND_OPTIONS = [
  { value: "", label: "Tất cả nhóm" },
  { value: "cafe_ong_quan", label: "Cà phê Ông Quan" },
  { value: "lau_ong_quan", label: "Lẩu Ông Quan" },
  { value: "ong_quan_farm", label: "Ông Quan Farm" },
  { value: "general_ong_quan", label: "Ông Quan tổng quát" },
  { value: "unknown", label: "Unknown" },
];

const SENTIMENT_OPTIONS = [
  { value: "", label: "Tất cả sentiment" },
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

function getDefaultMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(month: string) {
  if (!month) return { startDate: "", endDate: "" };
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  const format = (value: Date) => value.toISOString().split("T")[0];

  return {
    startDate: format(start),
    endDate: format(end),
  };
}

function downloadTextFile(fileName: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({
  title,
  value,
  note,
  icon,
}: {
  title: string;
  value: string | number;
  note: string;
  icon: ReactNode;
}) {
  return (
    <Card className="rounded-[24px] border-slate-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-500">{title}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{value}</div>
            <div className="mt-2 text-xs text-slate-500">{note}</div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SocialListeningPage() {
  const [month, setMonth] = useState(getDefaultMonth);
  const [brandGroup, setBrandGroup] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [dashboard, setDashboard] = useState<SocialListeningDashboard | null>(null);
  const [comments, setComments] = useState<SocialListeningComment[]>([]);
  const [reports, setReports] = useState<SocialListeningSavedReport[]>([]);
  const [savedReport, setSavedReport] = useState<SocialListeningSavedReport | null>(null);
  const [generatedReport, setGeneratedReport] = useState<SocialListeningGeneratedReport | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");

  async function loadData(activeMonth = month) {
    setLoading(true);
    setError("");

    try {
      const range = getMonthRange(activeMonth);
      const [dashboardResponse, commentItems, reportItems] = await Promise.all([
        getSocialListeningDashboard({
          month: activeMonth,
          startDate: range.startDate,
          endDate: range.endDate,
          brandGroup: brandGroup || undefined,
          sentiment: sentiment || undefined,
          granularity: "week",
        }),
        getSocialListeningComments({
          month: activeMonth,
          startDate: range.startDate,
          endDate: range.endDate,
          brandGroup: brandGroup || undefined,
          sentiment: sentiment || undefined,
          limit: 20,
        }),
        listSocialListeningReports(6),
      ]);

      setDashboard(dashboardResponse.dashboard);
      setComments(commentItems);
      setReports(reportItems);
      setSavedReport(dashboardResponse.savedReport);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError instanceof Error ? loadError.message : "Không tải được social listening.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [month, brandGroup, sentiment]);

  async function handleSeed() {
    setBusyAction("seed");
    setError("");

    try {
      await seedSocialListeningData(month, 36);
      await loadData(month);
    } catch (seedError) {
      console.error(seedError);
      setError(seedError instanceof Error ? seedError.message : "Không seed được dữ liệu mẫu.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleGenerateReport() {
    setBusyAction("report");
    setError("");

    try {
      const response = await generateSocialListeningReport(month, true);
      setGeneratedReport(response);
      await loadData(month);
    } catch (reportError) {
      console.error(reportError);
      setError(
        reportError instanceof Error ? reportError.message : "Không tạo được báo cáo tháng."
      );
    } finally {
      setBusyAction("");
    }
  }

  async function handleRefresh() {
    setBusyAction("refresh");
    setError("");

    try {
      await loadData(month);
    } finally {
      setBusyAction("");
    }
  }

  const exports = generatedReport?.exports ?? null;
  const delta = dashboard?.overview.comparison.delta ?? 0;
  const percent = dashboard?.overview.comparison.percentChange;
  const totalComments = dashboard?.overview.totalComments ?? 0;
  const overallSentiment = dashboard?.sentiment.overall ?? {
    positive: 0,
    neutral: 0,
    negative: 0,
    total: 0,
    positiveRate: 0,
    neutralRate: 0,
    negativeRate: 0,
  };
  const brandBreakdown = dashboard?.overview.brandBreakdown ?? [];
  const topTopics = dashboard?.topics.topTopics ?? [];
  const topKeywords = dashboard?.topics.topKeywords ?? [];
  const repeatedIssues = dashboard?.alerts.repeatedIssues ?? [];

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 rounded-[32px] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#14532d_100%)] p-6 text-white shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-semibold">
                  <MessageSquareText className="h-4 w-4" />
                  Admin module · TikTok social listening
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  Theo dõi comment TikTok cho hệ thương hiệu Ông Quan
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200">
                  Module nội bộ cho admin nhằm theo dõi nhắc đến thương hiệu, sentiment,
                  topic nổi bật, comment tiêu cực và báo cáo tháng phục vụ điều hướng nội dung.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Input
                  label="Tháng phân tích"
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className="h-11 rounded-2xl border-white/10 bg-white/10 text-white"
                />

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-100">Nhóm thương hiệu</span>
                  <select
                    value={brandGroup}
                    onChange={(event) => setBrandGroup(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/10 px-3 text-sm text-white outline-none"
                  >
                    {BRAND_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value} className="text-slate-900">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-100">Sentiment</span>
                  <select
                    value={sentiment}
                    onChange={(event) => setSentiment(event.target.value)}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/10 px-3 text-sm text-white outline-none"
                  >
                    {SENTIMENT_OPTIONS.map((option) => (
                      <option key={option.value || "all"} value={option.value} className="text-slate-900">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end gap-2">
                  <Button
                    variant="secondary"
                    className="h-11 flex-1 rounded-2xl bg-white text-slate-900 hover:bg-slate-100"
                    onClick={() => void handleRefresh()}
                    isLoading={busyAction === "refresh"}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                className="rounded-2xl bg-emerald-500 hover:bg-emerald-400"
                onClick={() => void handleGenerateReport()}
                isLoading={busyAction === "report"}
              >
                <WandSparkles className="mr-2 h-4 w-4" />
                Generate báo cáo tháng
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void handleSeed()}
                isLoading={busyAction === "seed"}
              >
                <CalendarDays className="mr-2 h-4 w-4" />
                Seed mock data
              </Button>
              {exports ? (
                <>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() =>
                      downloadTextFile(`social-listening-${month}.json`, exports.json, "application/json")
                    }
                  >
                    <FileJson className="mr-2 h-4 w-4" />
                    Export JSON
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() =>
                      downloadTextFile(`social-listening-${month}.md`, exports.markdown, "text/markdown")
                    }
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Export Markdown
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl border-white/15 bg-white/5 text-white hover:bg-white/10"
                    onClick={() =>
                      downloadTextFile(`social-listening-${month}.csv`, exports.csv, "text/csv;charset=utf-8")
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          {error ? (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[240px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-white">
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="Tổng comment"
                  value={totalComments}
                  note={`Tháng ${month}`}
                  icon={<MessageSquareText className="h-5 w-5" />}
                />
                <StatCard
                  title="Tỷ lệ negative"
                  value={`${overallSentiment.negativeRate}%`}
                  note={`${overallSentiment.negative} comment tiêu cực`}
                  icon={<TriangleAlert className="h-5 w-5" />}
                />
                <StatCard
                  title="So với tháng trước"
                  value={delta >= 0 ? `+${delta}` : delta}
                  note={percent == null ? "Không có dữ liệu so sánh" : `${percent}%`}
                  icon={<BarChart3 className="h-5 w-5" />}
                />
                <StatCard
                  title="Saved reports"
                  value={reports.length}
                  note={savedReport ? `Đã có báo cáo lưu cho ${month}` : "Chưa lưu báo cáo tháng này"}
                  icon={<FileText className="h-5 w-5" />}
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
                <Card className="rounded-[28px] border-slate-200">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl text-slate-900">Phân bổ nhóm thương hiệu</CardTitle>
                      <p className="mt-2 text-sm text-slate-500">
                        Rule-based classification cho 3 mảng chính và fallback group.
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {brandBreakdown.length ? (
                      brandBreakdown.map((row) => {
                        const total = Math.max(1, totalComments);
                        const width = (row.count / total) * 100;

                        return (
                          <div key={row.brandGroup} className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="font-medium text-slate-700">{row.brandLabel}</span>
                              <span className="text-slate-500">{row.count} comment</span>
                            </div>
                            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-emerald-500"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                        Chưa có dữ liệu trong tháng được chọn.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-900">Sentiment tổng quan</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      {
                        label: "Positive",
                        value: overallSentiment.positive,
                        rate: overallSentiment.positiveRate,
                        color: "bg-emerald-500",
                      },
                      {
                        label: "Neutral",
                        value: overallSentiment.neutral,
                        rate: overallSentiment.neutralRate,
                        color: "bg-slate-400",
                      },
                      {
                        label: "Negative",
                        value: overallSentiment.negative,
                        rate: overallSentiment.negativeRate,
                        color: "bg-rose-500",
                      },
                    ].map((row) => (
                      <div key={row.label} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{row.label}</span>
                          <span className="text-slate-500">
                            {row.value} · {row.rate}%
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.rate}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <Card className="rounded-[28px] border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-900">Comment cần chú ý</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {comments.length ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="rounded-[24px] border border-slate-200 bg-white p-4">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                              {comment.brandLabel}
                            </span>
                            <span
                              className={`rounded-full px-3 py-1 ${
                                comment.sentiment === "negative"
                                  ? "bg-rose-50 text-rose-700"
                                  : comment.sentiment === "positive"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {comment.sentiment}
                            </span>
                            <span className="text-slate-400">{comment.commentDate}</span>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-slate-700">{comment.commentText}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {comment.topicTags.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        Không có comment phù hợp filter hiện tại.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="rounded-[28px] border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-xl text-slate-900">Top topic & keyword</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
                      <div>
                        <div className="text-sm font-semibold text-slate-700">Topic nổi bật</div>
                        <div className="mt-3 space-y-2">
                          {topTopics.map((topic) => (
                            <div
                              key={topic.topicTag}
                              className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-3"
                            >
                              <span className="text-sm text-slate-700">{topic.label}</span>
                              <span className="text-sm font-semibold text-slate-900">{topic.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-semibold text-slate-700">Keyword nổi bật</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {topKeywords.map((keyword) => (
                            <span
                              key={keyword.keyword}
                              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                            >
                              {keyword.keyword} · {keyword.count}
                            </span>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[28px] border-slate-200">
                    <CardHeader>
                      <CardTitle className="text-xl text-slate-900">Vấn đề lặp lại</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {repeatedIssues.length ? (
                        repeatedIssues.map((issue) => (
                          <div
                            key={`${issue.type}-${issue.label}`}
                            className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                          >
                            <div>
                              <div className="text-sm font-medium text-slate-800">{issue.label}</div>
                              <div className="text-xs text-slate-500">{issue.type}</div>
                            </div>
                            <div className="text-sm font-semibold text-rose-600">{issue.count}</div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                          Chưa có cụm vấn đề lặp lại đủ mạnh.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
                <Card className="rounded-[28px] border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-900">Bản tóm tắt báo cáo tháng</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {"exports" in (generatedReport || {}) && generatedReport?.exports.markdown ? (
                      <pre className="max-h-[480px] overflow-auto rounded-[24px] bg-slate-950 p-5 text-sm leading-6 text-slate-100">
                        {generatedReport.exports.markdown}
                      </pre>
                    ) : savedReport?.markdown ? (
                      <pre className="max-h-[480px] overflow-auto rounded-[24px] bg-slate-950 p-5 text-sm leading-6 text-slate-100">
                        {savedReport.markdown}
                      </pre>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        Chưa có báo cáo được generate cho tháng này.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[28px] border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-xl text-slate-900">Lịch sử báo cáo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {reports.length ? (
                      reports.map((report) => (
                        <div key={report.id} className="rounded-[24px] border border-slate-200 p-4">
                          <div className="text-sm font-semibold text-slate-900">{report.reportMonth}</div>
                          <div className="mt-1 text-sm text-slate-600">{report.title}</div>
                          <div className="mt-2 text-xs text-slate-500">
                            {report.totalComments} comment · {report.generatedAt}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        Chưa có báo cáo lưu.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </main>
    </RoleGuard>
  );
}
