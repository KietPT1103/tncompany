"use client";

import { useEffect, useState } from "react";
import {
  getReportById,
  Report,
  updateReport,
  deleteReport,
} from "@/services/reportService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  Calendar,
  Pencil,
  Trash2,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import ResultTable from "@/components/ResultTable";
import { useParams, useRouter } from "next/navigation";

import RoleGuard from "@/components/RoleGuard";

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [originalReport, setOriginalReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!params?.id) return;
      try {
        const data = await getReportById(String(params.id));
        if (!data) {
          alert("Không tìm thấy báo cáo");
          router.push("/reports");
          return;
        }
        setReport(data);
        setOriginalReport(data);
      } catch (error) {
        console.error(error);
        alert("Lỗi khi tải báo cáo");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params, router]);

  const handleUpdateField = (field: string, value: number) => {
    if (!report) return;
    setReport({ ...report, [field]: value });
  };

  const handleSave = async () => {
    if (!report || !report.id) return;
    setSaving(true);
    try {
      // Recalculate total cost and profit
      const totalCost =
        report.totalMaterialCost +
        report.salary +
        report.electric +
        report.other;
      const profit = report.revenue - totalCost;

      const dataToUpdate = {
        revenue: report.revenue,
        salary: report.salary,
        electric: report.electric,
        other: report.other,
        totalCost,
        profit,
      };

      await updateReport(report.id, dataToUpdate);
      setReport({ ...report, ...dataToUpdate });
      setOriginalReport({ ...report, ...dataToUpdate });
      setIsEditing(false);
      alert("Đã cập nhật báo cáo");
    } catch (error) {
      console.error(error);
      alert("Lỗi khi cập nhật");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setReport(originalReport);
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!report?.id) return;
    if (!confirm("Bạn có chắc chắn muốn xoá báo cáo này không?")) return;
    try {
      await deleteReport(report.id);
      router.push("/reports");
    } catch (error) {
      console.error(error);
      alert("Lỗi khi xoá báo cáo");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Đang tải...
      </div>
    );
  }

  if (!report) return null;

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-gray-50 p-6 md:p-12 font-sans text-slate-800">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/reports"
                className="p-2 rounded-full hover:bg-white bg-white/50 transition-colors text-gray-600 shadow-sm"
                title="Quay lại danh sách"
              >
                <ArrowLeft className="w-6 h-6" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Chi tiết báo cáo
                </h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="w-4 h-4" />
                  {report.createdAt?.seconds
                    ? new Date(report.createdAt.seconds * 1000).toLocaleString(
                        "vi-VN"
                      )
                    : "N/A"}
                  <span className="mx-1">•</span>
                  <span className="font-medium text-gray-700">
                    {report.fileName}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 d-print-none">
              {!isEditing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => window.print()}
                    className="gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    In báo cáo
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setIsEditing(true)}
                    className="gap-2 bg-blue-600 hover:bg-blue-700"
                  >
                    <Pencil className="w-4 h-4" />
                    Chỉnh sửa
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xoá
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="gap-2"
                    disabled={saving}
                  >
                    <X className="w-4 h-4" />
                    Huỷ
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleSave}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                    disabled={saving}
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Summary Card */}
          <ResultTable
            revenue={report.revenue}
            materialCost={report.totalMaterialCost}
            salary={report.salary}
            electric={report.electric}
            other={report.other}
            isEditing={isEditing}
            onUpdate={handleUpdateField}
          />

          {/* Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Chi tiết sản phẩm</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden">
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground border-b">
                        Mã hàng
                      </th>
                      <th className="px-6 py-3 text-left font-medium text-muted-foreground border-b">
                        Tên sản phẩm
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground border-b">
                        Số lượng
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground border-b">
                        Cost/đơn
                      </th>
                      <th className="px-6 py-3 text-right font-medium text-muted-foreground border-b">
                        Tổng Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.details.map((r, i) => (
                      <tr
                        key={i}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-6 py-3 font-mono text-xs">
                          {r.product_code}
                        </td>
                        <td className="px-6 py-3">{r.product_name}</td>
                        <td className="px-6 py-3 text-right font-medium">
                          {r.quantity}
                        </td>
                        <td className="px-6 py-3 text-right text-muted-foreground">
                          {r.costUnit.toLocaleString()}
                        </td>
                        <td className="px-6 py-3 text-right font-medium">
                          {r.cost.toLocaleString()}
                        </td>
                      </tr>
                    ))}
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
