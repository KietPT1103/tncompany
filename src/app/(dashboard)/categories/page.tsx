"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import RoleGuard from "@/components/RoleGuard";
import { useStore } from "@/context/StoreContext";
import {
  getAllProducts,
  replaceProductCategoryName,
} from "@/services/products.firebase";
import {
  addCategory,
  Category,
  getCategories,
  removeCategory,
  updateCategory,
} from "@/services/categoryService";

type CategoryFormState = {
  name: string;
  description: string;
};

export default function CategoryManagementPage() {
  const { storeId, storeName } = useStore();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState<CategoryFormState>({ name: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<CategoryFormState>({
    name: "",
    description: "",
  });

  const [usageCountMap, setUsageCountMap] = useState<Record<string, number>>({});
  const [updatingHiddenId, setUpdatingHiddenId] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const [categoryList, productList] = await Promise.all([
        getCategories(storeId),
        getAllProducts(storeId),
      ]);
      setCategories(categoryList);

      const counts: Record<string, number> = {};
      categoryList.forEach((cat) => {
        const count = productList.filter(
          (product) => product.category === cat.id || product.category === cat.name
        ).length;
        counts[cat.id] = count;
      });
      setUsageCountMap(counts);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const totalInUse = useMemo(
    () => Object.values(usageCountMap).reduce((sum, value) => sum + value, 0),
    [usageCountMap]
  );

  async function handleCreateCategory() {
    const normalizedName = form.name.trim();
    if (!normalizedName) {
      alert("Vui lòng nhập tên danh mục.");
      return;
    }

    const exists = categories.some(
      (cat) => cat.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (exists) {
      alert("Tên danh mục đã tồn tại.");
      return;
    }

    await addCategory(normalizedName, form.description, storeId);
    setForm({ name: "", description: "" });
    await loadData();
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditingForm({
      name: category.name || "",
      description: category.description || "",
    });
  }

  async function handleSaveEdit() {
    if (!editingId) return;

    const normalizedName = editingForm.name.trim();
    if (!normalizedName) {
      alert("Vui lòng nhập tên danh mục.");
      return;
    }

    const exists = categories.some(
      (cat) =>
        cat.id !== editingId &&
        cat.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (exists) {
      alert("Tên danh mục đã tồn tại.");
      return;
    }

    const currentCategory = categories.find((category) => category.id === editingId);
    const oldName = (currentCategory?.name || "").trim();

    await updateCategory(editingId, {
      name: normalizedName,
      description: editingForm.description,
    });
    await replaceProductCategoryName(oldName, normalizedName, storeId);

    setEditingId(null);
    setEditingForm({ name: "", description: "" });
    await loadData();
  }

  async function handleDeleteCategory(category: Category) {
    const usageCount = usageCountMap[category.id] || 0;
    if (usageCount > 0) {
      alert("Danh mục đang được sử dụng bởi sản phẩm, không thể xóa.");
      return;
    }

    const shouldDelete = confirm(`Xóa danh mục "${category.name}"?`);
    if (!shouldDelete) return;

    await removeCategory(category.id);
    if (editingId === category.id) {
      setEditingId(null);
      setEditingForm({ name: "", description: "" });
    }
    await loadData();
  }

  async function handleToggleCategoryHidden(category: Category) {
    setUpdatingHiddenId(category.id);
    try {
      await updateCategory(category.id, {
        isHidden: !category.isHidden,
      });
      await loadData();
    } catch (error) {
      console.error(error);
      alert("Không thể cập nhật trạng thái danh mục.");
    } finally {
      setUpdatingHiddenId(null);
    }
  }

  return (
    <RoleGuard allowedRoles={["admin"]}>
      <main className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/product"
            className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
            title="Quay về sản phẩm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Quản lý danh mục</h1>
            <p className="text-sm text-slate-500">
              Gian hàng: <span className="font-medium text-slate-700">{storeName}</span>
            </p>
          </div>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-800">Tạo danh mục mới</h2>
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Tên danh mục"
            />
            <input
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mô tả (tùy chọn)"
            />
            <button
              onClick={handleCreateCategory}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Thêm
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-800">
              Danh mục hiện có ({categories.length})
            </h2>
            <p className="text-sm text-slate-500">Tổng sản phẩm đang gắn danh mục: {totalInUse}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Tên danh mục</th>
                  <th className="px-5 py-3 text-left font-medium">Mô tả</th>
                  <th className="px-5 py-3 text-center font-medium">Số sản phẩm</th>
                  <th className="px-5 py-3 text-center font-medium">Ẩn bán</th>
                  <th className="px-5 py-3 text-right font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((category) => {
                  const isEditing = editingId === category.id;
                  const usageCount = usageCountMap[category.id] || 0;

                  return (
                    <tr key={category.id} className="align-top">
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            value={editingForm.name}
                            onChange={(event) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                name: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="font-medium text-slate-900">{category.name}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {isEditing ? (
                          <input
                            value={editingForm.description}
                            onChange={(event) =>
                              setEditingForm((prev) => ({
                                ...prev,
                                description: event.target.value,
                              }))
                            }
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-slate-600">
                            {category.description || "Không có mô tả"}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {usageCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleCategoryHidden(category)}
                          disabled={updatingHiddenId === category.id}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            category.isHidden ? "bg-slate-300" : "bg-emerald-500"
                          } ${
                            updatingHiddenId === category.id
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                              category.isHidden ? "translate-x-1" : "translate-x-5"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={handleSaveEdit}
                                className="inline-flex cursor-pointer items-center rounded-md border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingForm({ name: "", description: "" });
                                }}
                                className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Hủy
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(category)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Sửa
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(category)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-red-600 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && categories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                      Chưa có danh mục nào cho gian hàng này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </RoleGuard>
  );
}


