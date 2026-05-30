"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getRoleGroupsForStore } from "./payrollShared";
import {
  getRoleStartTimes,
  RoleStartTimeSetting,
  saveRoleStartTimes,
} from "@/services/roleStartTimes";

export default function RoleStartTimeManager({
  storeId,
}: {
  storeId: string;
}) {
  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRoleStartTimes() {
      try {
        setLoading(true);
        setError("");
        setMessage("");
        const items = await getRoleStartTimes(storeId);
        if (!active) return;
        setValues(
          items.reduce<Record<string, string>>((result, item) => {
            result[item.role] = item.startTime;
            return result;
          }, {}),
        );
      } catch (loadError) {
        console.error(loadError);
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Không tải được cấu hình giờ vào.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadRoleStartTimes();
    return () => {
      active = false;
    };
  }, [storeId]);

  async function handleSave() {
    try {
      setSaving(true);
      setError("");
      setMessage("");
      const items: RoleStartTimeSetting[] = Object.entries(values)
        .map(([role, startTime]) => ({
          role,
          startTime: startTime.trim(),
        }))
        .filter((item) => item.startTime !== "");

      const savedItems = await saveRoleStartTimes(storeId, items);
      setValues(
        savedItems.reduce<Record<string, string>>((result, item) => {
          result[item.role] = item.startTime;
          return result;
        }, {}),
      );
      setMessage("Đã lưu giờ bắt đầu làm theo vai trò.");
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không lưu được cấu hình giờ vào.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-600">
              <Clock3 className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                Giờ vào theo vai trò
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold text-slate-900">
              Cấu hình giờ bắt đầu làm
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              Mỗi vai trò có thể có giờ bắt đầu khác nhau. Khi đã cấu hình, trang
              bảng lương sẽ tự đánh dấu những ca vào muộn hơn giờ này.
            </p>
          </div>
          <Button
            className="h-11 gap-2 rounded-2xl px-5"
            onClick={() => void handleSave()}
            isLoading={saving}
            disabled={loading}
          >
            <Save className="h-4 w-4" />
            Lưu cấu hình
          </Button>
        </div>
      </section>

      {error ? (
        <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-4">
        {Object.entries(roleGroups).map(([group, roles]) => (
          <section
            key={group}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-slate-900">{group}</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => (
                <div
                  key={role}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {role}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Để trống nếu vai trò này không cần kiểm tra đi trễ.
                  </p>
                  <input
                    type="time"
                    step={60}
                    value={values[role] || ""}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        [role]: event.target.value,
                      }))
                    }
                    className="mt-4 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
