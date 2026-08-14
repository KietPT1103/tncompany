"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createPayroll,
  deletePayroll,
  getPayrolls,
  Payroll,
  updatePayroll,
} from "@/services/payrolls";
import { getEmployees } from "@/services/employees";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { paginateItems, sortByCreatedAtDesc } from "@/lib/listPagination";
import {
  ArrowRight,
  CalendarRange,
  CalendarDays,
  CheckCircle2,
  Edit2,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatTimestampDate } from "./payrollShared";
type PayrollNotice = {
  variant: ToastVariant;
  title: string;
  description: string;
};

export default function PayrollManager({
  storeId,
  onSelectPayroll,
}: {
  storeId: string;
  onSelectPayroll: (payrollId: string) => void;
}) {
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [newPayrollName, setNewPayrollName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const router = useRouter();
  const [payrollPendingDelete, setPayrollPendingDelete] =
    useState<Payroll | null>(null);
  const [deletingPayrollId, setDeletingPayrollId] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState<PayrollNotice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
    loadPayrolls();
  }, [storeId]);

  const sortedPayrolls = useMemo(
    () => sortByCreatedAtDesc(payrolls),
    [payrolls],
  );
  const payrollPage = useMemo(
    () => paginateItems(sortedPayrolls, currentPage),
    [currentPage, sortedPayrolls],
  );

  useEffect(() => {
    if (currentPage !== payrollPage.pagination.currentPage) {
      setCurrentPage(payrollPage.pagination.currentPage);
    }
  }, [currentPage, payrollPage.pagination.currentPage]);

  async function loadPayrolls() {
    if (!storeId) return;
    try {
      setLoadError("");
      setPayrolls(await getPayrolls(storeId));
    } catch (error) {
      console.error(error);
      setPayrolls([]);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Không tải được danh sách bảng lương.",
      );
    }
  }
  function showNotice(
    variant: ToastVariant,
    title: string,
    description: string,
  ) {
    setNotice({ variant, title, description });
  }

  async function handleCreate() {
    if (!newPayrollName.trim()) {
      showNotice(
        "warning",
        "Chưa nhập tên kỳ lương",
        "Vui lòng nhập tên bảng lương trước khi tạo.",
      );
      return;
    }

    setLoading(true);
    try {
      const employees = await getEmployees(storeId);
      if (employees.length === 0) {
        showNotice(
          "warning",
          "Chưa có nhân viên",
          "Cần thêm ít nhất một nhân viên trước khi tạo kỳ lương.",
        );
        return;
      }

      const payrollId = await createPayroll(
        storeId,
        newPayrollName.trim(),
        employees,
      );
      setNewPayrollName("");
      setLoadError("");
      setCurrentPage(1);
      await loadPayrolls();
      onSelectPayroll(payrollId);
    } catch (error) {
      console.error(error);
      showNotice(
        "error",
        "Không thể tạo kỳ lương",
        "Đã xảy ra lỗi khi tạo kỳ lương. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }

  function requestDelete(payroll: Payroll) {
    if (!payroll.id) return;
    setPayrollPendingDelete(payroll);
  }

  async function confirmDelete() {
    if (!payrollPendingDelete?.id) return;
    const payrollToDelete = payrollPendingDelete;
    setDeletingPayrollId(payrollToDelete.id);

    try {
      await deletePayroll(payrollToDelete.id);
      await loadPayrolls();
      setPayrollPendingDelete(null);
      showNotice(
        "success",
        "Đã xóa kỳ lương",
        '"' + payrollToDelete.name + '" đã được xóa khỏi danh sách.',
      );
    } catch (error) {
      console.error(error);
      showNotice(
        "error",
        "Không thể xóa kỳ lương",
        "Đã xảy ra lỗi khi xóa kỳ lương. Vui lòng thử lại.",
      );
    } finally {
      setDeletingPayrollId(null);
    }
  }

  async function handleUpdateName(id: string) {
    if (!editName.trim()) return;
    try {
      await updatePayroll(id, { name: editName.trim() });
      setEditingId(null);
      await loadPayrolls();
    } catch (error) {
      console.error(error);
      showNotice(
        "error",
        "Không thể đổi tên",
        "Đã xảy ra lỗi khi cập nhật tên kỳ lương. Vui lòng thử lại.",
      );
    }
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-[6px_8px_14px_rgba(15,23,42,0.14)]">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold text-slate-950">
            Tạo kỳ lương
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Danh sách nhân sự hiện tại sẽ được sao chép vào kỳ lương mới.
          </p>
        </div>

        <div className="grid gap-2 p-4 xl:grid-cols-[minmax(280px,1fr)_auto_auto_auto]">
          <Input
            aria-label="Tên kỳ lương"
            placeholder="Ví dụ: Tháng 3 - Đợt 2"
            value={newPayrollName}
            onChange={(event) => setNewPayrollName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreate();
            }}
            className="h-10 rounded-[2px] border-slate-300 bg-white px-3"
          />
          <div className="grid gap-2 sm:grid-cols-3 xl:flex xl:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCreate}
              isLoading={loading}
              className="
                group h-10 gap-2 rounded-[2px] border border-emerald-700
                bg-emerald-700 px-4
                font-semibold text-white
                shadow-[0_2px_6px_rgba(4,120,87,0.22)]
                transition-[background-color,border-color,box-shadow,transform]
                duration-200 ease-out
                hover:border-emerald-800
                hover:bg-emerald-800
                hover:text-white
                hover:shadow-[0_4px_10px_rgba(4,120,87,0.28)]
                active:scale-[0.97]
                disabled:border-emerald-400
                disabled:bg-emerald-400
                disabled:text-white
                xl:w-auto
              "
            >
              <Plus
                className="
                h-4 w-4
                transition-transform duration-200
                group-hover:rotate-90
              "
              />
              Tạo bảng lương
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/timesheet")}
              className="
                group h-10 gap-2 rounded-[2px]
                border-slate-300 bg-white px-4
                font-semibold text-slate-800
                shadow-[0_1px_2px_rgba(15,23,42,0.05)]
                transition-[background-color,border-color,color,box-shadow,transform]
                duration-200 ease-out
                hover:border-emerald-800
                hover:bg-emerald-800
                hover:text-white
                hover:shadow-[0_4px_10px_rgba(4,120,87,0.25)]
                active:scale-[0.97]
              "
            >
              <ExternalLink
                className="
                  h-4 w-4 text-slate-500
                  transition-[color,transform] duration-200
                  group-hover:-translate-y-0.5
                  group-hover:translate-x-0.5
                  group-hover:text-white
                "
              />
              Import chấm công
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/payroll-estimate")}
              className="
                group h-10 gap-2 rounded-[2px]
                border-slate-300 bg-white px-4
                font-semibold text-slate-800
                shadow-[0_1px_2px_rgba(15,23,42,0.05)]
                transition-[background-color,border-color,color,box-shadow,transform]
                duration-200 ease-out
                hover:border-emerald-800
                hover:bg-emerald-800
                hover:text-white
                hover:shadow-[0_4px_10px_rgba(4,120,87,0.25)]
                active:scale-[0.97]
              "
            >
              <CalendarRange
                className="
                  h-4 w-4 text-slate-500
                  transition-colors duration-200
                  group-hover:text-white
                "
              />
              Ước lượng theo lịch
            </Button>
          </div>
        </div>
      </section>

      {loadError ? (
        <div
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {loadError}
        </div>
      ) : null}

      {payrolls.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            Chưa có bảng lương nào
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Tạo kỳ lương đầu tiên để quản lý chấm công và lương nhân sự.
          </p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[2px] border border-slate-200 bg-white shadow-[6px_8px_14px_rgba(15,23,42,0.14)]">
          <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Các kỳ lương
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {payrolls.length} kỳ lương
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {payrollPage.items.map((payroll) => {
              const isEditing = editingId === payroll.id;

              return (
                <article
                  key={payroll.id}
                  role={!isEditing ? "button" : undefined}
                  tabIndex={!isEditing ? 0 : -1}
                  onClick={() => {
                    if (!isEditing && payroll.id) {
                      onSelectPayroll(payroll.id);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (
                      !isEditing &&
                      payroll.id &&
                      (event.key === "Enter" || event.key === " ")
                    ) {
                      event.preventDefault();
                      onSelectPayroll(payroll.id);
                    }
                  }}
                  className={[
                    "group px-4 py-3 transition-[background-color,box-shadow] duration-200",
                    !isEditing
                      ? `
                        cursor-pointer
                        hover:bg-emerald-50/70
                        hover:shadow-[inset_3px_0_0_0_#047857]
                        focus-visible:bg-emerald-50/70
                        focus-visible:outline-none
                        focus-visible:ring-2
                        focus-visible:ring-inset
                        focus-visible:ring-emerald-800
                      `
                      : "bg-white",
                  ].join(" ")}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="
                          flex h-9 w-9 shrink-0 items-center justify-center
                          rounded-md bg-emerald-50 text-emerald-800
                          transition-colors duration-200
                          group-hover:bg-emerald-700
                          group-hover:text-[#F2C94C]
                        "
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={editName}
                              onChange={(event) =>
                                setEditName(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter")
                                  void handleUpdateName(payroll.id!);
                                if (event.key === "Escape") setEditingId(null);
                              }}
                              className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm outline-none transition-colors focus:border-emerald-800 focus:ring-2 focus:ring-emerald-500"
                              aria-label="Tên kỳ lương"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              className="h-9 w-9 rounded-md"
                              onClick={() => handleUpdateName(payroll.id!)}
                              aria-label="Lưu tên kỳ lương"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-md"
                              onClick={() => setEditingId(null)}
                              aria-label="Hủy đổi tên"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <h3 className="max-w-full truncate text-left text-sm font-semibold text-slate-950 transition-colors group-hover:text-emerald-700">
                              {payroll.name}
                            </h3>
                            <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
                              Tạo ngày {formatTimestampDate(payroll.createdAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {!isEditing ? (
                      <div
                        className="flex items-center gap-1 self-end sm:self-auto"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          className="
                              group h-8 gap-2 rounded-[2px] border-0
                              bg-[#ffb800] px-3
                              text-sm font-medium text-slate-950
                              shadow-none
                              transition-all duration-200
                              hover:bg-[#f2aa00] hover:text-slate-950
                              active:scale-[0.97]
                          "
                          onClick={(event) => {
                            event.stopPropagation();

                            if (payroll.id) {
                              onSelectPayroll(payroll.id);
                            }
                          }}
                        >
                          <span>Mở chi tiết</span>

                          <ArrowRight
                            className="
                              h-4 w-4
                              transition-transform duration-200
                              group-hover:translate-x-1
                            "
                          />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          onClick={() => {
                            setEditingId(payroll.id || null);
                            setEditName(payroll.name);
                          }}
                          aria-label="Đổi tên kỳ lương"
                          title="Đổi tên"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => requestDelete(payroll)}
                          aria-label="Xóa kỳ lương"
                          title="Xóa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination
            currentPage={payrollPage.pagination.currentPage}
            totalItems={sortedPayrolls.length}
            onPageChange={setCurrentPage}
          />
        </section>
      )}

      <ConfirmDialog
        open={Boolean(payrollPendingDelete)}
        title="Xóa kỳ lương?"
        description={
          <>
            Kỳ lương{" "}
            <span className="font-medium text-slate-900">
              {payrollPendingDelete?.name}
            </span>{" "}
            sẽ bị xóa khỏi danh sách. Hành động này không thể hoàn tác.
          </>
        }
        confirmLabel="Xóa kỳ lương"
        variant="destructive"
        icon={Trash2}
        isLoading={Boolean(deletingPayrollId)}
        onCancel={() => {
          if (!deletingPayrollId) setPayrollPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />

      <Toast
        open={Boolean(notice)}
        variant={notice?.variant ?? "info"}
        title={notice?.title ?? ""}
        description={notice?.description}
        onDismiss={() => setNotice(null)}
      />
    </div>
  );
}
