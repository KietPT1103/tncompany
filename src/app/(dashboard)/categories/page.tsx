"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  FolderTree,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import RoleGuard from "@/components/RoleGuard";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Toast, type ToastVariant } from "@/components/ui/Toast";
import { useStore } from "@/context/StoreContext";
import { paginateItems } from "@/lib/listPagination";
import {
  getAllProducts,
  replaceProductCategoryName,
} from "@/services/products.firebase";
import {
  addCategory,
  type Category,
  getCategories,
  removeCategory,
  updateCategory,
} from "@/services/categoryService";

type CategoryFormState = {
  name: string;
  description: string;
};

type ToastState = {
  open: boolean;
  title: string;
  description?: string;
  variant: ToastVariant;
};

const emptyForm: CategoryFormState = {
  name: "",
  description: "",
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .trim();

function CategoryModal({
  open,
  editingCategory,
  form,
  saving,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean;
  editingCategory: Category | null;
  form: CategoryFormState;
  saving: boolean;
  onClose: () => void;
  onChange: (changes: Partial<CategoryFormState>) => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  const isEditing = Boolean(editingCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 backdrop-blur-[2px] sm:items-center sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? "Sửa danh mục" : "Thêm danh mục"}
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_24px_80px_rgba(15,23,42,0.35)] sm:rounded-xl"
      >
        <header className="flex items-start justify-between bg-[linear-gradient(135deg,#064E3B,#033C2F)] px-5 py-5 text-white sm:px-6">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#F6C85F] ring-1 ring-white/15">
              {isEditing ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Chỉnh sửa
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Tạo mới
                </>
              )}
            </div>

            <h2 className="text-xl font-bold sm:text-2xl">
              {isEditing ? "Sửa danh mục" : "Thêm danh mục"}
            </h2>

            <p className="mt-1 text-sm leading-5 text-emerald-100">
              {isEditing
                ? `Cập nhật thông tin cho ${editingCategory?.name || "danh mục"}.`
                : "Tạo nhóm phân loại mới cho danh sách hàng hóa."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Đóng popup"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-emerald-100 transition-[background-color,color,transform] hover:bg-white/15 hover:text-[#F6C85F] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-[6px_8px_14px_rgba(15,23,42,0.12)] sm:p-5">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Thông tin danh mục
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Tên danh mục dùng để phân loại và lọc hàng hóa.
              </p>
            </div>

            <div className="space-y-4">
              <Input
                label="Tên danh mục"
                value={form.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder="VD: Nguyên liệu"
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-900">
                  Mô tả
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    onChange({ description: event.target.value })
                  }
                  rows={4}
                  placeholder="Nhập mô tả ngắn cho danh mục"
                  className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-[border-color,box-shadow] placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="hidden text-xs text-slate-500 sm:block">
            Tên danh mục không được trùng với danh mục hiện có.
          </p>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
              className="h-11 min-w-[96px] rounded-md border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 shadow-none transition-[background-color,border-color,color,transform] hover:border-slate-400 hover:bg-slate-100 active:scale-[0.97]"
            >
              Hủy
            </Button>

            <Button
              type="button"
              onClick={onSubmit}
              isLoading={saving}
              className="h-11 min-w-[170px] gap-2 whitespace-nowrap rounded-md bg-emerald-800 px-5 text-sm font-semibold text-[#F6C85F] shadow-none transition-[background-color,color,transform] hover:bg-[#F6C85F] hover:text-emerald-900 active:scale-[0.97]"
            >
              <Check className="h-4 w-4 shrink-0" />
              {isEditing ? "Lưu thay đổi" : "Thêm danh mục"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function CategoryManagementPage() {
  const { storeId, storeName } = useStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [usageCountMap, setUsageCountMap] = useState<Record<string, number>>(
    {},
  );
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingHiddenId, setUpdatingHiddenId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);

  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    open: false,
    title: "",
    description: "",
    variant: "info",
  });

  const showToast = (
    title: string,
    variant: ToastVariant,
    description?: string,
  ) => {
    setToast({
      open: true,
      title,
      description,
      variant,
    });
  };

  const closeToast = () => {
    setToast((current) => ({
      ...current,
      open: false,
    }));
  };

  async function loadData() {
    setLoading(true);

    try {
      const [categoryList, productList] = await Promise.all([
        getCategories(storeId),
        getAllProducts(storeId),
      ]);

      setCategories(categoryList);

      const counts: Record<string, number> = {};

      categoryList.forEach((category) => {
        counts[category.id] = productList.filter(
          (product) =>
            product.category === category.id ||
            product.category === category.name ||
            product.categoryName === category.name,
        ).length;
      });

      setUsageCountMap(counts);
    } catch (error) {
      console.error(error);

      showToast(
        "Không tải được danh mục",
        "error",
        error instanceof Error
          ? error.message
          : "Vui lòng tải lại trang và thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const filteredCategories = useMemo(() => {
    const keyword = normalizeText(query);

    if (!keyword) return categories;

    return categories.filter(
      (category) =>
        normalizeText(category.name).includes(keyword) ||
        normalizeText(category.description || "").includes(keyword),
    );
  }, [categories, query]);

  const categoryPage = useMemo(
    () => paginateItems(filteredCategories, currentPage),
    [currentPage, filteredCategories],
  );

  useEffect(() => {
    if (currentPage !== categoryPage.pagination.currentPage) {
      setCurrentPage(categoryPage.pagination.currentPage);
    }
  }, [categoryPage.pagination.currentPage, currentPage]);

  const stats = useMemo(
    () => ({
      total: categories.length,
      visible: categories.filter((category) => !category.isHidden).length,
      hidden: categories.filter((category) => category.isHidden).length,
      products: Object.values(usageCountMap).reduce(
        (sum, value) => sum + value,
        0,
      ),
    }),
    [categories, usageCountMap],
  );

  const openCreateModal = () => {
    setEditingCategory(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name || "",
      description: category.description || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingCategory(null);
    setForm({ ...emptyForm });
  };

  async function handleSaveCategory() {
    const normalizedName = form.name.trim();

    if (!normalizedName) {
      showToast(
        "Thông tin chưa đầy đủ",
        "warning",
        "Vui lòng nhập tên danh mục.",
      );
      return;
    }

    const duplicate = categories.some(
      (category) =>
        category.id !== editingCategory?.id &&
        normalizeText(category.name) === normalizeText(normalizedName),
    );

    if (duplicate) {
      showToast(
        "Tên danh mục đã tồn tại",
        "warning",
        "Vui lòng sử dụng một tên danh mục khác.",
      );
      return;
    }

    setSaving(true);

    try {
      if (editingCategory) {
        const oldName = editingCategory.name.trim();

        await updateCategory(editingCategory.id, {
          name: normalizedName,
          description: form.description.trim(),
        });

        if (normalizeText(oldName) !== normalizeText(normalizedName)) {
          await replaceProductCategoryName(oldName, normalizedName, storeId);
        }

        showToast(
          "Đã cập nhật danh mục",
          "success",
          `${normalizedName} đã được cập nhật thành công.`,
        );
      } else {
        await addCategory(normalizedName, form.description.trim(), storeId);

        setCurrentPage(1);

        showToast(
          "Đã thêm danh mục",
          "success",
          `${normalizedName} đã được thêm vào hệ thống.`,
        );
      }

      await loadData();
      closeModal();
    } catch (error) {
      console.error(error);

      showToast(
        "Không thể lưu danh mục",
        "error",
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi. Vui lòng thử lại.",
      );
    } finally {
      setSaving(false);
    }
  }

  const openDeleteDialog = (category: Category) => {
    const usageCount = usageCountMap[category.id] || 0;

    if (usageCount > 0) {
      showToast(
        "Không thể xóa danh mục",
        "warning",
        `Danh mục đang được sử dụng bởi ${usageCount} sản phẩm.`,
      );
      return;
    }

    setDeletingCategory(category);
  };

  const closeDeleteDialog = () => {
    if (deleting) return;
    setDeletingCategory(null);
  };

  async function confirmDeleteCategory() {
    if (!deletingCategory) return;

    setDeleting(true);

    try {
      const categoryName = deletingCategory.name;

      await removeCategory(deletingCategory.id);
      setDeletingCategory(null);

      await loadData();

      showToast(
        "Đã xóa danh mục",
        "success",
        `${categoryName} đã được xóa khỏi hệ thống.`,
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Không thể xóa danh mục",
        "error",
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi. Vui lòng thử lại.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleCategoryHidden(category: Category) {
    setUpdatingHiddenId(category.id);

    try {
      const nextHiddenState = !category.isHidden;

      await updateCategory(category.id, {
        isHidden: nextHiddenState,
      });

      await loadData();

      showToast(
        nextHiddenState ? "Đã ẩn danh mục" : "Đã hiển thị danh mục",
        "success",
        `${category.name} đã được ${
          nextHiddenState ? "ẩn khỏi danh sách bán" : "hiển thị trở lại"
        }.`,
      );
    } catch (error) {
      console.error(error);

      showToast(
        "Không thể cập nhật trạng thái",
        "error",
        error instanceof Error ? error.message : "Vui lòng thử lại.",
      );
    } finally {
      setUpdatingHiddenId(null);
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="min-h-screen bg-slate-50 text-slate-950 antialiased">
        <div className="mx-auto max-w-[1520px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <header className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-smooch text-5xl font-bold text-emerald-800">
                Quản lý danh mục
              </h1>

              <p className="font-firasans mt-1 text-sm font-bold text-[#d6ba5d]">
                Phân loại hàng hóa tại {storeName || "gian hàng hiện tại"}
              </p>
            </div>

            <Button
              type="button"
              onClick={openCreateModal}
              className="h-10 gap-1.5 rounded-[2px] border-2 border-slate-900 bg-emerald-700 px-3 text-sm font-semibold text-white shadow-[4px_4px_0_#0f172a] transition-[background-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-0.5 hover:bg-emerald-800 hover:text-white hover:shadow-[6px_6px_0_#0f172a] active:translate-x-[2px] active:translate-y-[2px] active:scale-100 active:shadow-[2px_2px_0_#0f172a]"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Thêm danh mục
            </Button>
          </header>

          <section className="overflow-hidden rounded border border-slate-200 bg-white">
            <div className="grid grid-cols-2 border-b border-slate-200 lg:grid-cols-4">
              {[
                ["Tổng danh mục", stats.total],
                ["Đang hiển thị", stats.visible],
                ["Đang ẩn", stats.hidden],
                ["Sản phẩm đã gắn", stats.products],
              ].map(([label, value], index) => (
                <div
                  key={label}
                  className={`group relative bg-white px-4 py-4 transition-[transform,box-shadow,background-color] duration-300 ease-out hover:z-10 hover:-translate-y-1 hover:bg-emerald-50/40 hover:shadow-[0_14px_30px_rgba(15,23,42,0.14)] lg:px-5 ${
                    index > 0 ? "border-l border-slate-200" : ""
                  } ${
                    index > 1 ? "border-t border-slate-200 lg:border-t-0" : ""
                  }`}
                >
                  <p className="text-xs font-medium text-slate-600 transition-colors duration-300 group-hover:text-emerald-700">
                    {label}
                  </p>

                  <p className="mt-1 text-xl font-bold tabular-nums text-slate-950 transition-colors duration-300 group-hover:text-emerald-800">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-b border-slate-200 p-4 lg:p-5">
              <div className="relative w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Tìm tên hoặc mô tả danh mục"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Tên danh mục</th>
                    <th className="px-4 py-3">Mô tả</th>
                    <th className="px-4 py-3 text-center">Số sản phẩm</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="w-28 px-4 py-3 text-center">Thao tác</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-14 text-center text-slate-600"
                      >
                        Đang tải danh mục...
                      </td>
                    </tr>
                  ) : filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-14 text-center">
                        <CircleAlert className="mx-auto h-6 w-6 text-slate-400" />

                        <p className="mt-2 font-medium">
                          Không có danh mục phù hợp
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Thử thay đổi từ khóa tìm kiếm.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    categoryPage.items.map((category) => {
                      const usageCount = usageCountMap[category.id] || 0;
                      const updating = updatingHiddenId === category.id;

                      return (
                        <tr
                          key={category.id}
                          tabIndex={0}
                          onClick={() => openEditModal(category)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openEditModal(category);
                            }
                          }}
                          className="cursor-pointer bg-white transition-[background-color,box-shadow] hover:bg-emerald-50/50 hover:shadow-[inset_3px_0_0_#047857] focus-visible:bg-emerald-50/50 focus-visible:outline-none focus-visible:shadow-[inset_3px_0_0_#047857]"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-800">
                                <FolderTree className="h-4 w-4" />
                              </span>

                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-900">
                                  {category.name}
                                </p>

                                <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                                  {category.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="max-w-md px-4 py-3 text-slate-600">
                            <p className="line-clamp-2">
                              {category.description || "Chưa có mô tả"}
                            </p>
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex min-w-8 justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
                              {usageCount}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              disabled={updating}
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleToggleCategoryHidden(category);
                              }}
                              className={`group inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold transition-[background-color,color,transform] duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                                category.isHidden
                                  ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                                  : "bg-emerald-800 text-[#ffb800] hover:bg-[#ffb800] hover:text-emerald-900 active:scale-[0.96]"
                              }`}
                            >
                              {category.isHidden ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}

                              {updating
                                ? "Đang cập nhật"
                                : category.isHidden
                                  ? "Đang ẩn"
                                  : "Đang hiển thị"}
                            </button>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEditModal(category);
                                }}
                                aria-label={`Sửa ${category.name}`}
                                title="Sửa"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-600 transition-[background-color,color,transform,box-shadow] duration-200 hover:bg-emerald-800 hover:text-[#ffb800] hover:shadow-sm active:scale-[0.96]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openDeleteDialog(category);
                                }}
                                aria-label={`Xóa ${category.name}`}
                                title="Xóa"
                                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-rose-600 transition-[background-color,color,transform] hover:bg-rose-600 hover:text-white active:scale-[0.96]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && filteredCategories.length > 0 ? (
              <Pagination
                currentPage={categoryPage.pagination.currentPage}
                totalItems={filteredCategories.length}
                onPageChange={setCurrentPage}
              />
            ) : null}
          </section>
        </div>
      </main>

      <CategoryModal
        open={modalOpen}
        editingCategory={editingCategory}
        form={form}
        saving={saving}
        onClose={closeModal}
        onChange={(changes) =>
          setForm((current) => ({
            ...current,
            ...changes,
          }))
        }
        onSubmit={() => void handleSaveCategory()}
      />

      <ConfirmDialog
        open={Boolean(deletingCategory)}
        title="Xóa danh mục?"
        description={
          deletingCategory ? (
            <div className="space-y-2">
              <p>
                Bạn có chắc muốn xóa{" "}
                <strong className="font-semibold text-slate-900">
                  {deletingCategory.name}
                </strong>
                ?
              </p>

              <p className="text-xs font-medium text-rose-700">
                Hành động này không thể hoàn tác.
              </p>
            </div>
          ) : null
        }
        confirmLabel="Xóa danh mục"
        cancelLabel="Hủy"
        variant="destructive"
        icon={Trash2}
        isLoading={deleting}
        onCancel={closeDeleteDialog}
        onConfirm={() => void confirmDeleteCategory()}
      />

      <Toast
        open={toast.open}
        title={toast.title}
        description={toast.description}
        variant={toast.variant}
        duration={3750}
        onDismiss={closeToast}
      />
    </RoleGuard>
  );
}
