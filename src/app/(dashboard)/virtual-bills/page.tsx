"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { parseSalesReportWorkbook } from "@/services/excel";
import { Product, getAllProducts } from "@/services/products.firebase";
import { generateVirtualBills, VirtualBill } from "@/services/virtualBillGenerator";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import RoleGuard from "@/components/RoleGuard";
import { useStore } from "@/context/StoreContext";
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  RefreshCcw,
  Upload,
  Wand2,
} from "lucide-react";

type VirtualBillFormState = {
  date: string;
  totalRevenue: string;
  billCount: string;
};

type VirtualBillRow = {
  date: string;
  billCode: string;
  productCode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("vi-VN", { minimumFractionDigits: 0 });

const formatDateInput = (date: Date) => {
  const local = new Date(date.getTime());
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().split("T")[0];
};

const parseMoney = (value: string) => {
  const amount = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
};

const parseLooseRevenueAmount = (text: string) => {
  const matches = text.match(/\d{1,3}(?:[.,]\d{3})+|\d+/g) || [];
  const values = matches
    .map((match) => Number(match.replace(/[^\d]/g, "")))
    .filter((value) => Number.isFinite(value) && value >= 1000);
  return values.length > 0 ? Math.max(...values) : 0;
};

const parseRevenueSeedFile = async (file: File) => {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".xls") || lowerName.endsWith(".xlsx")) {
    const workbook = await parseSalesReportWorkbook(file);
    const total = Math.round(workbook.totalRevenue || workbook.totalNetRevenue || 0);
    if (total <= 0) {
      throw new Error("Không đọc được tổng doanh thu từ file Excel.");
    }
    return total;
  }

  if (lowerName.endsWith(".pdf")) {
    const rawText = await file.text();
    const total = parseLooseRevenueAmount(rawText);
    if (total <= 0) {
      throw new Error("Chưa đọc được doanh thu từ file PDF này.");
    }
    return total;
  }

  throw new Error("Chỉ hỗ trợ file Excel hoặc PDF để gợi ý doanh thu.");
};

const buildVirtualBillRows = (bills: VirtualBill[]): VirtualBillRow[] =>
  bills.flatMap((bill) =>
    bill.items.map((item) => ({
      date: bill.createdAt.toLocaleDateString("vi-VN"),
      billCode: bill.billCode,
      productCode: item.productCode,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
    }))
  );

const exportVirtualBills = (rows: VirtualBillRow[], date: string) => {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Ngày: row.date,
      "Mã bill": row.billCode,
      "Mã hàng hóa": row.productCode,
      "Tên hàng hóa, dịch vụ": row.productName,
      SL: row.quantity,
      "Đơn giá": row.unitPrice,
      "Thành tiền": row.lineTotal,
    }))
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Bill ao");
  XLSX.writeFile(workbook, `bill-ao-${date || "export"}.xlsx`);
};

export default function VirtualBillsPage() {
  const { storeId } = useStore();
  const todayInput = formatDateInput(new Date());

  const [productCatalog, setProductCatalog] = useState<Product[]>([]);
  const [productLoading, setProductLoading] = useState(true);
  const [virtualBillForm, setVirtualBillForm] = useState<VirtualBillFormState>({
    date: todayInput,
    totalRevenue: "",
    billCount: "10",
  });
  const [readingRevenueFile, setReadingRevenueFile] = useState(false);
  const [generatingVirtualBills, setGeneratingVirtualBills] = useState(false);
  const [virtualRevenueSource, setVirtualRevenueSource] = useState("Nhập tay");
  const [virtualBills, setVirtualBills] = useState<VirtualBill[]>([]);
  const [virtualBillRows, setVirtualBillRows] = useState<VirtualBillRow[]>([]);
  const [virtualBillError, setVirtualBillError] = useState("");

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      setProductLoading(true);
      try {
        const items = await getAllProducts(storeId);
        if (active) {
          setProductCatalog(items);
        }
      } catch (error) {
        console.error(error);
        if (active) {
          setProductCatalog([]);
          setVirtualBillError("Không tải được danh mục sản phẩm để tạo bill ảo.");
        }
      } finally {
        if (active) {
          setProductLoading(false);
        }
      }
    };

    loadProducts();

    return () => {
      active = false;
    };
  }, [storeId]);

  const virtualGeneratedTotal = useMemo(
    () => virtualBills.reduce((sum, bill) => sum + bill.total, 0),
    [virtualBills]
  );

  const handleRevenueFileUpload = async (file: File) => {
    setReadingRevenueFile(true);
    try {
      const detectedRevenue = await parseRevenueSeedFile(file);
      setVirtualBillForm((prev) => ({
        ...prev,
        totalRevenue: String(detectedRevenue),
      }));
      setVirtualRevenueSource(`Từ file ${file.name}`);
      setVirtualBillError("");
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Không đọc được doanh thu từ file.");
    } finally {
      setReadingRevenueFile(false);
    }
  };

  const handleGenerateVirtualBills = async () => {
    const totalRevenue = parseMoney(virtualBillForm.totalRevenue);
    const billCount = Number(virtualBillForm.billCount);

    if (!virtualBillForm.date) {
      setVirtualBillError("Vui lòng chọn ngày cho bill ảo.");
      return;
    }
    if (Number.isNaN(billCount) || billCount <= 0) {
      setVirtualBillError("Số lượng bill không hợp lệ.");
      return;
    }
    if (totalRevenue <= 0) {
      setVirtualBillError("Doanh thu phải lớn hơn 0.");
      return;
    }
    if (productCatalog.length === 0) {
      setVirtualBillError("Danh mục sản phẩm chưa sẵn sàng để tạo bill ảo.");
      return;
    }

    setGeneratingVirtualBills(true);
    try {
      const generatedBills = generateVirtualBills({
        date: virtualBillForm.date,
        totalRevenue,
        billCount,
        products: productCatalog,
      });
      setVirtualBills(generatedBills);
      setVirtualBillRows(buildVirtualBillRows(generatedBills));
      setVirtualBillError("");
    } catch (error) {
      console.error(error);
      setVirtualBills([]);
      setVirtualBillRows([]);
      setVirtualBillError(
        error instanceof Error ? error.message : "Không thể tạo bill ảo với dữ liệu hiện tại."
      );
    } finally {
      setGeneratingVirtualBills(false);
    }
  };

  const handleResetVirtualBills = () => {
    setVirtualBillForm({
      date: todayInput,
      totalRevenue: "",
      billCount: "10",
    });
    setVirtualBills([]);
    setVirtualBillRows([]);
    setVirtualBillError("");
    setVirtualRevenueSource("Nhập tay");
  };

  return (
    <RoleGuard allowedRoles={["admin"]} permission="virtual_bills.access">
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/bills"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-100"
                title="Quay về hóa đơn"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  <Wand2 className="h-4 w-4" />
                  Công cụ doanh thu
                </p>
                <h1 className="text-2xl font-bold text-slate-900">Tạo bill ảo</h1>
                <p className="text-sm text-slate-500">
                  Tách biệt khỏi trang bill và chỉ sinh dữ liệu tạm, không lưu vào DB.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="gap-2"
                disabled={virtualBillRows.length === 0}
                onClick={() => exportVirtualBills(virtualBillRows, virtualBillForm.date)}
              >
                <Download className="h-4 w-4" />
                Xuất Excel
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Wand2 className="h-5 w-5 text-amber-600" />
                    Thiết lập
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Hệ thống sẽ chọn món ngẫu nhiên theo bảng giá hiện tại, sao cho đúng tổng doanh
                    thu và đúng số bill bạn yêu cầu.
                  </div>

                  <Input
                    label="Ngày"
                    type="date"
                    value={virtualBillForm.date}
                    onChange={(event) =>
                      setVirtualBillForm((prev) => ({
                        ...prev,
                        date: event.target.value,
                      }))
                    }
                  />

                  <Input
                    label="Tổng doanh thu"
                    type="text"
                    inputMode="numeric"
                    placeholder="Ví dụ: 595276"
                    value={virtualBillForm.totalRevenue}
                    onChange={(event) =>
                      setVirtualBillForm((prev) => ({
                        ...prev,
                        totalRevenue: event.target.value.replace(/[^\d]/g, ""),
                      }))
                    }
                  />

                  <Input
                    label="Số lượng bill"
                    type="number"
                    min={1}
                    value={virtualBillForm.billCount}
                    onChange={(event) =>
                      setVirtualBillForm((prev) => ({
                        ...prev,
                        billCount: event.target.value.replace(/[^\d]/g, ""),
                      }))
                    }
                  />

                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">
                          Upload file doanh thu để tự điền tổng
                        </p>
                        <p className="text-xs text-slate-500">
                          Excel đọc chính xác hơn, PDF hiện dùng để gợi ý số doanh thu.
                        </p>
                        <p className="text-xs text-slate-600">
                          Nguồn hiện tại: <span className="font-semibold">{virtualRevenueSource}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          Menu sẵn sàng:{" "}
                          <span className="font-semibold text-slate-700">
                            {productLoading ? "Đang tải..." : `${productCatalog.length} sản phẩm`}
                          </span>
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                        {readingRevenueFile ? (
                          <RefreshCcw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        Chọn file
                        <input
                          type="file"
                          accept=".xls,.xlsx,.pdf"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void handleRevenueFileUpload(file);
                            }
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {virtualBillError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {virtualBillError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="gap-2 bg-amber-600 hover:bg-amber-700"
                      onClick={handleGenerateVirtualBills}
                      isLoading={generatingVirtualBills}
                    >
                      <Wand2 className="h-4 w-4" />
                      Tạo bill ảo
                    </Button>
                    <Button variant="outline" onClick={handleResetVirtualBills}>
                      Xóa kết quả
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="overflow-hidden">
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileSpreadsheet className="h-5 w-5 text-amber-700" />
                      Bill ảo đã tạo ({virtualBills.length})
                    </CardTitle>
                    <p className="text-sm text-slate-500">
                      Hiển thị từng dòng món để bạn đối chiếu hoặc xuất file.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {virtualBills.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      Chưa có bill ảo. Nhập doanh thu, số bill rồi bấm tạo.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase text-amber-700">Tổng bill</p>
                          <p className="text-2xl font-bold text-amber-900">{virtualBills.length}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase text-emerald-700">
                            Tổng doanh thu tạo ra
                          </p>
                          <p className="text-2xl font-bold text-emerald-900">
                            {formatCurrency(virtualGeneratedTotal)} VND
                          </p>
                        </div>
                        <div className="rounded-lg border border-sky-100 bg-sky-50 px-4 py-3">
                          <p className="text-xs font-semibold uppercase text-sky-700">Số dòng món</p>
                          <p className="text-2xl font-bold text-sky-900">{virtualBillRows.length}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                        {virtualBills.map((bill) => (
                          <div
                            key={bill.billCode}
                            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-slate-900">{bill.billCode}</p>
                                <p className="text-xs text-slate-500">
                                  {bill.createdAt.toLocaleString("vi-VN")}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-emerald-700">
                                  {formatCurrency(bill.total)} VND
                                </p>
                                <p className="text-xs text-slate-500">
                                  {bill.items.reduce((sum, item) => sum + item.quantity, 0)} món
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="overflow-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 text-slate-600">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Ngày</th>
                              <th className="px-4 py-3 text-left font-semibold">Mã bill</th>
                              <th className="px-4 py-3 text-left font-semibold">Mã hàng hóa</th>
                              <th className="px-4 py-3 text-left font-semibold">
                                Tên hàng hóa, dịch vụ
                              </th>
                              <th className="px-4 py-3 text-right font-semibold">SL</th>
                              <th className="px-4 py-3 text-right font-semibold">Đơn giá</th>
                              <th className="px-4 py-3 text-right font-semibold">Thành tiền</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {virtualBillRows.map((row, index) => (
                              <tr
                                key={`${row.billCode}-${row.productCode}-${index}`}
                                className="hover:bg-slate-50"
                              >
                                <td className="px-4 py-3 text-slate-700">{row.date}</td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                                  {row.billCode}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-slate-600">
                                  {row.productCode}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-900">
                                  {row.productName}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700">
                                  {row.quantity}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-700">
                                  {formatCurrency(row.unitPrice)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                  {formatCurrency(row.lineTotal)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </RoleGuard>
  );
}
