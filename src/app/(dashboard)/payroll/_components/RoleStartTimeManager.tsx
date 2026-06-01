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

type RoleShiftStartValues = Record<
  string,
  {
    shift1Start: string;
    shift2Start: string;
    shift3Start: string;
  }
>;

const SHIFT_FIELDS = [
  { key: "shift1Start", label: "Ca 1" },
  { key: "shift2Start", label: "Ca 2" },
  { key: "shift3Start", label: "Ca 3" },
] as const;

export default function RoleStartTimeManager({
  storeId,
}: {
  storeId: string;
}) {
  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);
  const [values, setValues] = useState<RoleShiftStartValues>({});
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
          items.reduce<RoleShiftStartValues>((result, item) => {
            result[item.role] = {
              shift1Start: item.shift1Start || "",
              shift2Start: item.shift2Start || "",
              shift3Start: item.shift3Start || "",
            };
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
        .map(([role, shiftValues]) => ({
          role,
          shift1Start: shiftValues.shift1Start.trim(),
          shift2Start: shiftValues.shift2Start.trim(),
          shift3Start: shiftValues.shift3Start.trim(),
        }))
        .filter(
          (item) =>
            item.shift1Start !== "" ||
            item.shift2Start !== "" ||
            item.shift3Start !== "",
        );

      const savedItems = await saveRoleStartTimes(storeId, items);
      setValues(
        savedItems.reduce<RoleShiftStartValues>((result, item) => {
          result[item.role] = {
            shift1Start: item.shift1Start || "",
            shift2Start: item.shift2Start || "",
            shift3Start: item.shift3Start || "",
          };
          return result;
        }, {}),
      );
      setMessage("Đã lưu giờ bắt đầu làm cho 3 ca theo vai trò.");
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
              Mỗi vai trò có thể có 3 giờ bắt đầu tương ứng Ca 1, Ca 2 và Ca 3.
              Khi đã cấu hình, hệ thống sẽ tự ghép ca chấm công vào mốc gần nhất
              để đánh dấu đi trễ đúng theo từng ca.
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
              {roles.map((role) => {
                const roleValues = values[role] || {
                  shift1Start: "",
                  shift2Start: "",
                  shift3Start: "",
                };

                return (
                  <div
                    key={role}
                    className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="text-sm font-semibold text-slate-900">
                      {role}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Để trống ca nào nếu vai trò này không làm ca đó hoặc không
                      cần kiểm tra.
                    </p>
                    <div className="mt-4 space-y-3">
                      {SHIFT_FIELDS.map((shift) => (
                        <label
                          key={shift.key}
                          className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3"
                        >
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {shift.label}
                          </span>
                          <input
                            type="time"
                            step={60}
                            value={roleValues[shift.key]}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                [role]: {
                                  ...roleValues,
                                  [shift.key]: event.target.value,
                                },
                              }))
                            }
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
