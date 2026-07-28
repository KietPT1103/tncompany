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
    weekendEnabled: boolean;
    weekendShift1Start: string;
    weekendShift2Start: string;
    weekendShift3Start: string;
  }
>;

const SHIFT_FIELDS = [
  { key: "shift1Start", label: "Ca 1" },
  { key: "shift2Start", label: "Ca 2" },
  { key: "shift3Start", label: "Ca 3" },
] as const;

const WEEKEND_SHIFT_FIELDS = [
  { key: "weekendShift1Start", label: "Cuối tuần ca 1" },
  { key: "weekendShift2Start", label: "Cuối tuần ca 2" },
  { key: "weekendShift3Start", label: "Cuối tuần ca 3" },
] as const;

export default function RoleStartTimeManager({ storeId }: { storeId: string }) {
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
              weekendEnabled: item.weekendEnabled || false,
              weekendShift1Start: item.weekendShift1Start || "",
              weekendShift2Start: item.weekendShift2Start || "",
              weekendShift3Start: item.weekendShift3Start || "",
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
          weekendEnabled: shiftValues.weekendEnabled,
          weekendShift1Start: shiftValues.weekendShift1Start.trim(),
          weekendShift2Start: shiftValues.weekendShift2Start.trim(),
          weekendShift3Start: shiftValues.weekendShift3Start.trim(),
        }))
        .filter(
          (item) =>
            item.shift1Start !== "" ||
            item.shift2Start !== "" ||
            item.shift3Start !== "" ||
            item.weekendShift1Start !== "" ||
            item.weekendShift2Start !== "" ||
            item.weekendShift3Start !== "",
        );

      const savedItems = await saveRoleStartTimes(storeId, items);
      setValues(
        savedItems.reduce<RoleShiftStartValues>((result, item) => {
          result[item.role] = {
            shift1Start: item.shift1Start || "",
            shift2Start: item.shift2Start || "",
            shift3Start: item.shift3Start || "",
            weekendEnabled: item.weekendEnabled || false,
            weekendShift1Start: item.weekendShift1Start || "",
            weekendShift2Start: item.weekendShift2Start || "",
            weekendShift3Start: item.weekendShift3Start || "",
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
    <div className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              <Clock3 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Cấu hình giờ bắt đầu làm
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">
                Khai báo tối đa 3 mốc giờ theo vai trò. Hệ thống dùng mốc gần
                nhất để ghép ca và xác định đi trễ.
              </p>
            </div>
          </div>
          <Button
            className="h-9 shrink-0 gap-1.5 rounded-[3px] bg-emerald-800 px-3 text-sm font-semibold text-white transition-[background-color,transform] duration-200 hover:bg-emerald-900 active:scale-[0.97]"
            onClick={() => void handleSave()}
            isLoading={saving}
            disabled={loading}
          >
            <Save className="h-3.5 w-3.5" />
            Lưu cấu hình
          </Button>
        </div>
      </section>

      {error ? (
        <div
          className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {message ? (
        <div
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {message}
        </div>
      ) : null}

      <div className="space-y-3">
        {Object.entries(roleGroups).map(([group, roles]) => (
          <section
            key={group}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-950">{group}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {roles.length} vai trò
              </p>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => {
                const roleValues = values[role] || {
                  shift1Start: "",
                  shift2Start: "",
                  shift3Start: "",
                  weekendEnabled: false,
                  weekendShift1Start: "",
                  weekendShift2Start: "",
                  weekendShift3Start: "",
                };

                return (
                  <div
                    key={role}
                    className="border-b border-slate-200 p-4 md:border-r xl:[&:nth-child(3n)]:border-r-0"
                  >
                    <div className="text-sm font-semibold text-slate-950">
                      {role}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Để trống mốc không áp dụng cho vai trò này.
                    </p>

                    <div className="mt-3 space-y-2">
                      {SHIFT_FIELDS.map((shift) => (
                        <label
                          key={shift.key}
                          className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3"
                        >
                          <span className="text-xs font-medium text-slate-600">
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
                            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                      ))}

                      <label className="mt-3 flex cursor-pointer items-start gap-3 border-t border-slate-200 pt-3">
                        <input
                          type="checkbox"
                          checked={roleValues.weekendEnabled}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [role]: {
                                ...roleValues,
                                weekendEnabled: event.target.checked,
                              },
                            }))
                          }
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            Giờ riêng cuối tuần
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Dùng mốc khác cho thứ 7 và chủ nhật.
                          </p>
                        </div>
                      </label>

                      {roleValues.weekendEnabled ? (
                        <div className="mt-3 space-y-2 border-l-2 border-amber-300 bg-amber-50/60 px-3 py-2">
                          {WEEKEND_SHIFT_FIELDS.map((shift) => (
                            <label
                              key={shift.key}
                              className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-3"
                            >
                              <span className="text-xs font-medium text-amber-800">
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
                                className="h-10 w-full rounded-md border border-amber-300 bg-white px-3 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
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
