"use client";

import { useEffect, useState } from "react";
import { getReports, Report, updateReport } from "@/services/reportService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";
import { ArrowLeft, FileText, Search, Calendar, Pencil, Check, X, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

import RoleGuard from "@/components/RoleGuard";

import { useAuth } from "@/context/AuthContext";
import { useStore } from "@/context/StoreContext";

export default function ReportsPage() {
  const { storeId } = useStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleToggleCashFlow(report: Report) {
    if (!report.id) return;
    try {
      const newValue = !(report.includeInCashFlow ?? true);
      await updateReport(report.id, { includeInCashFlow: newValue });
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id ? { ...r, includeInCashFlow: newValue } : r
        )
      );
    } catch (error) {
      console.error(error);
      alert("Lỗi khi cập nhật trạng thái");
    }
  }

  function startEdit(report: Report) {
    setEditingId(report.id || null);
    setEditName(report.fileName);
  }

  async function saveEdit(id: string) {
    try {
      await updateReport(id, { fileName: editName });
      setReports((prev) =>
        prev.map((r) => (r.id === id ? { ...r, fileName: editName } : r))
      );
      setEditingId(null);
    } catch (error) {
      console.error(error);
      alert("Lỗi khi đổi tên file");
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const start = startDate ? new Date(startDate) : undefined;
      const end = endDate ? new Date(endDate) : undefined;
      if (end) end.setHours(23, 59, 59, 999);

      const data = await getReports(50, start, end, storeId);
      setReports(data);
    } catch (error) {
      console.error(error);
      alert("Lỗi khi tải danh sách báo cáo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [startDate, endDate, storeId]);

  const filteredReports = reports.filter((r) =>
    r.fileName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans text-slate-800">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href="/"
              className="p-2 rounded-full hover:bg-white bg-white/50 transition-colors text-gray-600 shadow-sm"
              title="Trở về trang chủ"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Lịch sử báo cáo
              </h1>
              <p className="text-muted-foreground">
                Xem lại các bảng tính chi phí đã lưu
              </p>
            </div>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-1/3">
                <label className="text-sm font-medium mb-1 block">
                  Tìm kiếm tên file
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Nhập tên file..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="w-full md:w-auto">
                <label className="text-sm font-medium mb-1 block">
                  Từ ngày
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="w-full md:w-auto">
                <label className="text-sm font-medium mb-1 block">
                  Đến ngày
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Danh sách báo cáo ({filteredReports.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-y">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-gray-500">
                        Ngày tạo
                      </th>
                      <th className="px-6 py-3 text-left font-medium text-gray-500">
                        Tên file
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500">
                        Doanh thu
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500">
                        Tổng chi phí
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-gray-500">
                        Lợi nhuận
                      </th>
                      <th className="px-6 py-3 text-center font-medium text-gray-500">
                        Dòng tiền
                      </th>
                      <th className="px-6 py-3 text-center font-medium text-gray-500">
                        Hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center">
                          Đang tải dữ liệu...
                        </td>
                      </tr>
                    ) : filteredReports.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          Không tìm thấy báo cáo nào
                        </td>
                      </tr>
                    ) : (
                      filteredReports.map((r) => (
                        <tr
                          key={r.id}
                          className="hover:bg-gray-50/80 transition-colors group"
                        >
                          <td className="px-6 py-4 text-gray-500">
                            {r.createdAt?.seconds
                              ? new Date(
                                  r.createdAt.seconds * 1000
                                ).toLocaleString("vi-VN")
                              : "N/A"}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {editingId === r.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="h-8 text-sm"
                                />
                                <Button
                                  size="icon"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  variant="ghost"
                                  onClick={() => r.id && saveEdit(r.id)}
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  variant="ghost"
                                  onClick={() => setEditingId(null)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group/edit">
                                <span>{r.fileName}</span>
                                <button
                                  onClick={() => startEdit(r)}
                                  className="opacity-0 group-hover/edit:opacity-100 transition-opacity text-gray-400 hover:text-blue-600"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.revenue.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {r.totalCost.toLocaleString()}
                          </td>
                          <td
                            className={`px-6 py-4 text-right font-semibold ${
                              r.profit >= 0 ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {r.profit.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleToggleCashFlow(r)}
                              className="text-gray-400 hover:text-emerald-600 transition-colors"
                              title="Bật/tắt tính vào dòng tiền"
                            >
                              {r.includeInCashFlow !== false ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <XCircle className="w-5 h-5" />
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Link href={`/reports/${r.id}`}>
                              <Button variant="ghost" size="sm">
                                Xem chi tiết
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </RoleGuard>
  );
}
