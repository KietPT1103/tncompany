
"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Save,
  GripVertical,
  ArrowRightLeft,
  AlertCircle,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { RoleStartTimeSetting } from "@/services/roleStartTimes";
import { calculateShiftLateMinutes } from "../payroll/_components/payrollShared";

// Helper constants for 24h time picker can be removed or kept if we switch back,
// using simple validation now.

// We can move this to a types file later
export interface Shift {
  id: string; // unique ID for React keys
  date: string; // YYYY/MM/DD for display/grouping
  inTime: string; // ISO string or formatted string
  outTime: string; // ISO string or formatted string
  hours: number;
  isWeekend: boolean;
  isValid: boolean; // if false, it means missing pair
}

interface ShiftDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shifts: Shift[]) => void;
  employeeName: string;
  employeeId: string;
  initialShifts: Shift[];
  scheduledStartTimes?: Partial<RoleStartTimeSetting>;
}

const TimeSelect = ({
  value,
  onChange,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  ariaLabel: string;
}) => {
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");

  useEffect(() => {
    const [nextHour, nextMinute] = value ? value.split(":") : ["", ""];
    setHour(nextHour || "");
    setMinute(nextMinute || "");
  }, [value]);

  const commitValue = (nextHour: string, nextMinute: string) => {
    if (!nextHour && !nextMinute) {
      onChange("");
      return;
    }

    if (nextHour.length === 2 && nextMinute.length === 2) {
      onChange(`${nextHour}:${nextMinute}`);
    }
  };

  const handleChange = (part: "h" | "m", rawValue: string) => {
    if (!/^\d*$/.test(rawValue)) return;

    const nextValue = rawValue.slice(0, 2);
    const nextHour = part === "h" ? nextValue : hour;
    const nextMinute = part === "m" ? nextValue : minute;

    if (part === "h") setHour(nextValue);
    if (part === "m") setMinute(nextValue);

    commitValue(nextHour, nextMinute);
  };

  const handleBlur = (part: "h" | "m") => {
    const rawHour = hour;
    const rawMinute = minute;

    if (!rawHour && !rawMinute) {
      setHour("");
      setMinute("");
      onChange("");
      return;
    }

    const normalizedHour =
      rawHour === ""
        ? ""
        : String(Math.min(23, Math.max(0, Number(rawHour) || 0))).padStart(2, "0");
    const normalizedMinute =
      rawMinute === ""
        ? ""
        : String(Math.min(59, Math.max(0, Number(rawMinute) || 0))).padStart(2, "0");

    setHour(normalizedHour);
    setMinute(normalizedMinute);

    if (normalizedHour && normalizedMinute) {
      onChange(`${normalizedHour}:${normalizedMinute}`);
      return;
    }

    onChange("");
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1 rounded-md",
        className,
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        value={hour}
        placeholder="HH"
        maxLength={2}
        onChange={(event) => handleChange("h", event.target.value)}
        onBlur={() => handleBlur("h")}
        aria-label={ariaLabel + " - giờ"}
        className="h-10 w-11 rounded-md border border-slate-300 bg-white text-center font-mono text-sm tabular-nums outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <span className="font-semibold text-slate-400">:</span>
      <input
        type="text"
        inputMode="numeric"
        value={minute}
        placeholder="MM"
        maxLength={2}
        onChange={(event) => handleChange("m", event.target.value)}
        onBlur={() => handleBlur("m")}
        aria-label={ariaLabel + " - phút"}
        className="h-10 w-11 rounded-md border border-slate-300 bg-white text-center font-mono text-sm tabular-nums outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </div>
  );
};

export default function ShiftDetailModal({
  isOpen,
  onClose,
  onSave,
  employeeName,
  employeeId,
  initialShifts,
  scheduledStartTimes,
}: ShiftDetailModalProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShifts(JSON.parse(JSON.stringify(initialShifts)));
    }
  }, [isOpen, initialShifts]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getLateMinutes = (inTime: string) => {
    if (!inTime) return 0;
    return calculateShiftLateMinutes(inTime, scheduledStartTimes);
  };

  const handleTimeChange = (
    id: string,
    field: "inTime" | "outTime",
    timeValue: string
  ) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;

        // timeValue is "HH:mm"
        // We need to reconstruct the full date string based on s.date
        // s.date is "YYYY/MM/DD" usually.
        if (!timeValue) return { ...s, [field]: "" };

        // Normalize s.date separators if needed, but assuming YYYY/MM/DD or YYYY-MM-DD
        const datePart = s.date.replace(/\//g, "-");

        // Construct basic full string "YYYY-MM-DD HH:mm:00"
        // But better to use standard ISO-like format for consistency: "YYYY-MM-DD HH:mm:ss"
        // Just append ":00" for seconds
        const fullStr = `${datePart} ${timeValue}:00`;

        return { ...s, [field]: fullStr };
      })
    );
  };
  const handleDateChange = (id: string, newDate: string) => {
    // newDate is "YYYY-MM-DD"
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;

        // Update s.date (store as YYYY/MM/DD to match existing format if needed, but input returns YYYY-MM-DD)
        // Let's standardize to YYYY/MM/DD for display consistency elsewhere, or keep YYYY-MM-DD?
        // existing s.date seems to be "YYYY/MM/DD" based on previous code.
        const standardDate = newDate.replace(/-/g, "/");

        // We also need to move inTime and outTime to this new date
        // preserving the time of day.

        let newInTime = s.inTime;
        let newOutTime = s.outTime;

        if (s.inTime) {
          const timePart = s.inTime.split(" ")[1]; // HH:mm:ss
          if (timePart) {
            newInTime = `${standardDate.replace(/\//g, "-")} ${timePart}`;
          }
        }

        if (s.outTime) {
          // Check if outTime was next day
          // We can calculate day difference between old inTime date and outTime date?
          // Or just check calculateHours logic.
          // Simplified: If we move the "base" date, outTime moves with it.
          // If outTime was +1 day relative to inTime, it stays +1 day relative to NEW inTime.

          // Let's assume outTime follows the same shift.
          // Retrieve time part
          const timePart = s.outTime.split(" ")[1];
          if (timePart) {
            // Check if it was overnight?
            // Simple logic: reconstruct outTime based on new date + timePart
            // But wait, if it was overnight, we need to know.
            // Let's look at logic in handleTimeChange: if Out < In => next day.
            // So we can just set it to same day first, and let the renderer/calc handle the overnight logic?
            // No, we store full strings.

            // Smart approach:
            // 1. Get old start date object
            // 2. Get old end date object
            // 3. Calculate diff in MS
            // 4. Create NEW start date object from newDate + inTime's time
            // 5. New end date = New start + diff

            // Converting strings to Date first
            const dIn = new Date(s.inTime);
            const dOut = new Date(s.outTime);

            if (!isNaN(dIn.getTime()) && !isNaN(dOut.getTime())) {
              const diff = dOut.getTime() - dIn.getTime();

              // Construct new base start
              // newDate is YYYY-MM-DD
              // inTime time is dIn.toTimeString()...
              const timeString = dIn.toTimeString().split(" ")[0]; // HH:mm:ss
              const newBaseStart = new Date(`${newDate}T${timeString}`);

              // Update inTime
              // formatting back to "YYYY-MM-DD HH:mm:ss" - or standard ISO
              // To match existing format "YYYY-MM-DD HH:mm:ss"
              const format = (d: Date) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const dd = String(d.getDate()).padStart(2, "0");
                const hh = String(d.getHours()).padStart(2, "0");
                const min = String(d.getMinutes()).padStart(2, "0");
                const sec = String(d.getSeconds()).padStart(2, "0");
                return `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
              };

              newInTime = format(newBaseStart);
              newOutTime = format(new Date(newBaseStart.getTime() + diff));
            }
          }
        }

        return {
          ...s,
          date: standardDate,
          inTime: newInTime,
          outTime: newOutTime,
        };
      })
    );
  };

  const calculateHours = (inTime: string, outTime: string) => {
    // Logic:
    // If In and Out are on same "conceptual" date (shift.date)
    // We assume In is always on shift.date.
    // If Out < In (in time value), we assume it's next day (+24h).

    // Parse times
    // We can just look at the HH:mm parts if the strings are cleaner,
    // BUT we are storing full "YYYY-MM-DD HH:mm:ss".
    // Let's parse them as Dates.
    const start = new Date(inTime);
    // For end, we might have stored "YYYY-MM-DD HH:mm:ss" where YYYY-MM-DD is same as start.
    // We need to check if we should add a day.
    let end = new Date(outTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    // If user selected a time that results in end < start, it typically means overnight in this context
    // UNLESS the dates are already different in the string?
    // With new logic, we are setting dates to be same as `s.date` in handleTimeChange.
    // So `end` will naturally have same YMD as `start`.
    // So if end < start, it means overnight.

    if (end <= start) {
      // Add 1 day to end
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }

    const diff = end.getTime() - start.getTime();
    return parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
  };

  const calculateRawHours = (inTime: string, outTime: string) => {
    const start = new Date(inTime);
    let end = new Date(outTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    const diff = end.getTime() - start.getTime();
    return diff / (1000 * 60 * 60);
  };

  const handleAddShift = () => {
    const newShift: Shift = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString("ja-JP"), // simple init
      inTime: "",
      outTime: "",
      hours: 0,
      isWeekend: false,
      isValid: true,
    };
    setShifts([...shifts, newShift]);
  };

  const handleAddShiftAt = (index: number) => {
    const newShift: Shift = {
      id: Date.now().toString(),
      date: shifts[index]?.date || new Date().toLocaleDateString("ja-JP"),
      inTime: "",
      outTime: "",
      hours: 0,
      isWeekend: false,
      isValid: true,
    };
    const newShifts = [...shifts];
    newShifts.splice(index + 1, 0, newShift);
    setShifts(newShifts);
  };

  const handleSwapTimes = (id: string) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          inTime: s.outTime,
          outTime: s.inTime,
        };
      })
    );
  };

  const handleDeleteShift = (id: string) => {
    setShifts(shifts.filter((s) => s.id !== id));
  };

  // Drag and Drop Handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault(); // Necessary for onDrop to fire
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;

    const newShifts = [...shifts];
    const [draggedItem] = newShifts.splice(draggedIndex, 1);
    newShifts.splice(index, 0, draggedItem);

    setShifts(newShifts);
    setDraggedIndex(null);
  };

  const handleSave = () => {
    // Recalculate everything before saving
    const processedShifts = shifts.map((s) => {
      // Format datetime-local to standard format if needed, but keeping standard is fine
      // Try to fix date based on InTime
      let dateStr = s.date;
      if (s.inTime) {
        const d = new Date(s.inTime);
        if (!isNaN(d.getTime())) {
          // Format YYYY/MM/DD
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          dateStr = `${yyyy}/${mm}/${dd}`;
        }
      }

      const hrs = calculateHours(s.inTime, s.outTime);
      const day = s.inTime ? new Date(s.inTime).getDay() : -1;
      const isWeekend = day === 0 || day === 6;

      return {
        ...s,
        date: dateStr,
        hours: hrs,
        isWeekend: isWeekend,
        isValid: hrs > 0, // simple validity
      };
    });

    onSave(processedShifts);
    onClose();
  };

  // Helper to extract "HH:mm" from "YYYY/MM/DD HH:mm:ss" or Date string
  const toInputFormat = (fullStr: string) => {
    if (!fullStr) return "";
    // If it is formatted like "YYYY/MM/DD HH:mm:ss"
    // Just split space and take second part, then slice to HH:mm
    if (fullStr.includes(" ")) {
      const timePart = fullStr.split(" ")[1];
      return timePart ? timePart.slice(0, 5) : "";
    }
    // Fallback if it is a Date object string or other format
    const d = new Date(fullStr);
    if (isNaN(d.getTime())) return "";

    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const computedTotalHours = shifts.reduce(
    (total, shift) =>
      total + calculateRawHours(shift.inTime, shift.outTime),
    0,
  );
  const invalidShiftCount = shifts.filter(
    (shift) =>
      !shift.inTime ||
      !shift.outTime ||
      calculateHours(shift.inTime, shift.outTime) === 0,
  ).length;
  const lateShiftCount = shifts.filter(
    (shift) => getLateMinutes(shift.inTime) > 0,
  ).length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shift-detail-title"
        className="flex h-[96vh] w-full flex-col overflow-hidden rounded-t-lg bg-white shadow-[0_4px_8px_rgba(15,23,42,0.18)] sm:h-auto sm:max-h-[92vh] sm:max-w-5xl sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="shift-detail-title"
                className="truncate text-base font-semibold text-slate-950 sm:text-lg"
              >
                Chi tiết chấm công
              </h2>
              <p className="mt-0.5 truncate text-sm text-slate-600">
                <span className="font-medium text-slate-900">
                  {employeeName}
                </span>
                <span className="mx-2 text-slate-300">·</span>
                <span className="font-mono text-xs">{employeeId}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {scheduledStartTimes &&
          (scheduledStartTimes.shift1Start ||
            scheduledStartTimes.shift2Start ||
            scheduledStartTimes.shift3Start ||
            scheduledStartTimes.weekendShift1Start ||
            scheduledStartTimes.weekendShift2Start ||
            scheduledStartTimes.weekendShift3Start) ? (
            <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Giờ vào chuẩn:
                {scheduledStartTimes.shift1Start
                  ? " Ca 1 " + scheduledStartTimes.shift1Start
                  : ""}
                {scheduledStartTimes.shift2Start
                  ? " · Ca 2 " + scheduledStartTimes.shift2Start
                  : ""}
                {scheduledStartTimes.shift3Start
                  ? " · Ca 3 " + scheduledStartTimes.shift3Start
                  : ""}
                {scheduledStartTimes.weekendEnabled &&
                scheduledStartTimes.weekendShift1Start
                  ? " · T7, CN ca 1 " +
                    scheduledStartTimes.weekendShift1Start
                  : ""}
                {scheduledStartTimes.weekendEnabled &&
                scheduledStartTimes.weekendShift2Start
                  ? " · T7, CN ca 2 " +
                    scheduledStartTimes.weekendShift2Start
                  : ""}
                {scheduledStartTimes.weekendEnabled &&
                scheduledStartTimes.weekendShift3Start
                  ? " · T7, CN ca 3 " +
                    scheduledStartTimes.weekendShift3Start
                  : ""}
              </span>
            </div>
          ) : null}
        </header>

        <div className="grid shrink-0 grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
          <div className="px-4 py-2.5">
            <div className="text-xs text-slate-500">Số ca</div>
            <div className="mt-0.5 font-semibold tabular-nums text-slate-900">
              {shifts.length}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <div className="text-xs text-slate-500">Cần sửa</div>
            <div
              className={cn(
                "mt-0.5 font-semibold tabular-nums",
                invalidShiftCount > 0 ? "text-rose-700" : "text-emerald-700",
              )}
            >
              {invalidShiftCount}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <div className="text-xs text-slate-500">Đi trễ</div>
            <div
              className={cn(
                "mt-0.5 font-semibold tabular-nums",
                lateShiftCount > 0 ? "text-amber-700" : "text-slate-900",
              )}
            >
              {lateShiftCount}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="hidden lg:block">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr className="border-b border-slate-200">
                  <th className="w-10 px-2 py-3" />
                  <th className="w-12 px-2 py-3 text-center">TT</th>
                  <th className="px-3 py-3">Ngày</th>
                  <th className="px-3 py-3 text-center">Giờ vào</th>
                  <th className="px-3 py-3 text-center">Giờ ra</th>
                  <th className="px-3 py-3 text-right">Số giờ</th>
                  <th className="w-32 px-3 py-3 text-center">Tác vụ</th>
                </tr>
              </thead>
              <tbody>                {shifts.map((shift, index) => {
                  const hours = calculateHours(
                    shift.inTime,
                    shift.outTime,
                  );
                  const lateMinutes = getLateMinutes(shift.inTime);
                  const invalid =
                    !shift.inTime || !shift.outTime || hours === 0;
                  const weekend =
                    shift.inTime &&
                    [0, 6].includes(new Date(shift.inTime).getDay());

                  return (
                    <tr
                      key={shift.id}
                      className={cn(
                        "border-b border-slate-200 transition-colors",
                        invalid
                          ? "bg-rose-50/60"
                          : lateMinutes > 0
                            ? "bg-amber-50/55"
                            : "bg-white hover:bg-slate-50",
                        draggedIndex === index && "opacity-40",
                      )}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={() => setDraggedIndex(null)}
                    >
                      <td className="cursor-move px-2 py-3 text-center text-slate-400">
                        <GripVertical className="h-4 w-4" />
                      </td>
                      <td className="px-2 py-3 text-center">
                        {invalid ? (
                          <AlertCircle className="mx-auto h-4 w-4 text-rose-600" />
                        ) : lateMinutes > 0 ? (
                          <Clock3 className="mx-auto h-4 w-4 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="date"
                          className="h-10 w-36 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                          value={shift.date.replace(/\//g, "-")}
                          onChange={(event) =>
                            handleDateChange(
                              shift.id,
                              event.target.value,
                            )
                          }
                          aria-label={"Ngày của ca " + (index + 1)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <TimeSelect
                          value={toInputFormat(shift.inTime)}
                          onChange={(value) =>
                            handleTimeChange(
                              shift.id,
                              "inTime",
                              value,
                            )
                          }
                          ariaLabel={"Giờ vào ca " + (index + 1)}
                          className={invalid ? "bg-rose-50" : ""}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <TimeSelect
                          value={toInputFormat(shift.outTime)}
                          onChange={(value) =>
                            handleTimeChange(
                              shift.id,
                              "outTime",
                              value,
                            )
                          }
                          ariaLabel={"Giờ ra ca " + (index + 1)}
                          className={invalid ? "bg-rose-50" : ""}
                        />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="font-semibold tabular-nums text-slate-900">
                          {hours.toLocaleString("vi-VN", {
                            maximumFractionDigits: 2,
                          })}
                          h
                        </div>
                        {lateMinutes > 0 ? (
                          <div className="mt-1 text-xs font-medium text-amber-700">
                            Trễ {lateMinutes} phút
                          </div>
                        ) : weekend ? (
                          <div className="mt-1 text-xs font-medium text-sky-700">
                            Cuối tuần
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSwapTimes(shift.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-sky-700 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                            title="Đổi giờ vào và giờ ra"
                            aria-label={"Đổi giờ ca " + (index + 1)}
                          >
                            <ArrowRightLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddShiftAt(index)}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            title="Chèn ca phía sau"
                            aria-label={"Chèn ca sau ca " + (index + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShift(shift.id)}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            title="Xóa ca"
                            aria-label={"Xóa ca " + (index + 1)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-200 lg:hidden">
            {shifts.map((shift, index) => {
              const hours = calculateHours(shift.inTime, shift.outTime);
              const lateMinutes = getLateMinutes(shift.inTime);
              const invalid =
                !shift.inTime || !shift.outTime || hours === 0;
              const weekend =
                shift.inTime &&
                [0, 6].includes(new Date(shift.inTime).getDay());

              return (
                <section
                  key={shift.id}
                  className={cn(
                    "px-4 py-4",
                    invalid
                      ? "bg-rose-50/55"
                      : lateMinutes > 0
                        ? "bg-amber-50/50"
                        : "bg-white",
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {invalid ? (
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                      ) : lateMinutes > 0 ? (
                        <Clock3 className="h-4 w-4 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                      <span className="text-sm font-semibold text-slate-900">
                        Ca {index + 1}
                      </span>
                    </div>
                    <input
                      type="date"
                      className="h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                      value={shift.date.replace(/\//g, "-")}
                      onChange={(event) =>
                        handleDateChange(shift.id, event.target.value)
                      }
                      aria-label={"Ngày của ca " + (index + 1)}
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                    <label className="min-w-0 space-y-1.5">
                      <span className="block text-xs font-medium text-slate-600">
                        Giờ vào
                      </span>
                      <TimeSelect
                        value={toInputFormat(shift.inTime)}
                        onChange={(value) =>
                          handleTimeChange(
                            shift.id,
                            "inTime",
                            value,
                          )
                        }
                        ariaLabel={"Giờ vào ca " + (index + 1)}
                        className={invalid ? "bg-rose-50" : ""}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handleSwapTimes(shift.id)}
                      className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-md text-sky-700 hover:bg-sky-50"
                      aria-label={"Đổi giờ ca " + (index + 1)}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </button>

                    <label className="min-w-0 space-y-1.5">
                      <span className="block text-xs font-medium text-slate-600">
                        Giờ ra
                      </span>
                      <TimeSelect
                        value={toInputFormat(shift.outTime)}
                        onChange={(value) =>
                          handleTimeChange(
                            shift.id,
                            "outTime",
                            value,
                          )
                        }
                        ariaLabel={"Giờ ra ca " + (index + 1)}
                        className={invalid ? "bg-rose-50" : ""}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                    <div className="text-sm">
                      <span className="font-semibold tabular-nums text-slate-900">
                        {hours.toLocaleString("vi-VN", {
                          maximumFractionDigits: 2,
                        })}
                        h
                      </span>
                      {lateMinutes > 0 ? (
                        <span className="ml-2 text-xs font-medium text-amber-700">
                          Trễ {lateMinutes} phút
                        </span>
                      ) : weekend ? (
                        <span className="ml-2 text-xs font-medium text-sky-700">
                          Cuối tuần
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleAddShiftAt(index)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50"
                        aria-label={"Chèn ca sau ca " + (index + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteShift(shift.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50"
                        aria-label={"Xóa ca " + (index + 1)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          {shifts.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <Clock3 className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Chưa có dữ liệu chấm công
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Thêm một ca để bắt đầu nhập ngày và giờ làm.
              </p>
            </div>
          ) : null}
        </div>
        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Button
            variant="outline"
            onClick={handleAddShift}
            className="h-10 gap-2 border-dashed border-slate-300 bg-white text-slate-700 shadow-none hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            Thêm ca
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="text-sm text-slate-600 sm:mr-2 sm:text-right">
              Tổng giờ
              <span className="ml-2 font-semibold tabular-nums text-slate-900">
                {computedTotalHours.toLocaleString("vi-VN", {
                  maximumFractionDigits: 2,
                })}
                h
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                className="h-10 border-slate-300 bg-white shadow-none"
              >
                Hủy
              </Button>
              <Button
                onClick={handleSave}
                className="h-10 gap-2 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Save className="h-4 w-4" />
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}