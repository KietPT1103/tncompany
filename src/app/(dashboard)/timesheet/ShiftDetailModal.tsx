"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Save, GripVertical, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
}

export default function ShiftDetailModal({
  isOpen,
  onClose,
  onSave,
  employeeName,
  employeeId,
  initialShifts,
}: ShiftDetailModalProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Deep copy to avoid mutating props directly
      setShifts(JSON.parse(JSON.stringify(initialShifts)));
    }
  }, [isOpen, initialShifts]);

  if (!isOpen) return null;

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

  const TimeSelect = ({
    value,
    onChange,
    className,
  }: {
    value: string;
    onChange: (val: string) => void;
    className?: string;
  }) => {
    // value expected "HH:mm"
    const [hh, mm] = value ? value.split(":") : ["", ""];

    // Handler for inputs
    const handleChange = (part: "h" | "m", val: string) => {
      // Allow only numbers
      if (!/^\d*$/.test(val)) return;

      let newH = part === "h" ? val : hh;
      let newM = part === "m" ? val : mm;

      // Basic clamping could be done here or on blur
      // Let's just update local state logic proxy:
      // We call onChange immediately so parent state updates?
      // Yes, but we might want to validate max values immediately

      if (part === "h" && parseInt(val) > 23) newH = "23";
      if (part === "m" && parseInt(val) > 59) newM = "59";

      onChange(`${newH}:${newM}`);
    };

    const handleBlur = (part: "h" | "m", val: string) => {
      // Pad with 0
      let num = parseInt(val);
      if (isNaN(num)) num = 0;

      let display = num.toString().padStart(2, "0");

      let newH = part === "h" ? display : hh || "00";
      let newM = part === "m" ? display : mm || "00";

      onChange(`${newH}:${newM}`);
    };

    return (
      <div className={`flex items-center justify-center gap-1 ${className}`}>
        <input
          type="text"
          value={hh}
          placeholder="HH"
          maxLength={2}
          onChange={(e) => handleChange("h", e.target.value)}
          onBlur={(e) => handleBlur("h", e.target.value)}
          className="p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 font-mono bg-white text-center w-[50px]"
        />
        <span className="text-gray-400 font-bold">:</span>
        <input
          type="text"
          value={mm}
          placeholder="MM"
          maxLength={2}
          onChange={(e) => handleChange("m", e.target.value)}
          onBlur={(e) => handleBlur("m", e.target.value)}
          className="p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 font-mono bg-white text-center w-[50px]"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h3 className="text-lg font-bold text-gray-800">
              Chi tiết công:{" "}
              <span className="text-blue-600">{employeeName}</span>
            </h3>
            <p className="text-sm text-gray-500">Mã NV: {employeeId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50 text-gray-700 sticky -top-4 z-10">
              <tr>
                <th className="p-3 border-b w-10"></th>
                <th className="p-3 border-b">Ngày</th>
                <th className="px-6 py-3 border-b text-center">Giờ Vào (In)</th>
                <th className="px-6 py-3 border-b text-center">Giờ Ra (Out)</th>
                <th className="p-3 border-b text-right">Số Giờ</th>
                <th className="p-3 border-b text-center">Cuối Tuần</th>
                <th className="p-3 border-b w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shifts.map((shift, index) => (
                <React.Fragment key={shift.id}>
                <tr
                  key={shift.id}
                  className={`shift-row group peer transition-colors ${
                    !shift.inTime || !shift.outTime || shift.hours === 0
                      ? "bg-red-50 border-l-4 border-red-400"
                      : "hover:bg-gray-50 border-l-4 border-transparent"
                  } ${draggedIndex === index ? "opacity-40" : ""}`}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={() => setDraggedIndex(null)} // Fix ghost effect
                >
                  <td className="p-2 align-middle text-center cursor-move text-gray-400 hover:text-gray-600">
                    <GripVertical size={16} />
                  </td>
                  <td className="p-2 align-middle">
                    <input
                      type="date"
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                      value={shift.date.replace(/\//g, "-")}
                      onChange={(e) =>
                        handleDateChange(shift.id, e.target.value)
                      }
                    />
                  </td>
                  <td className="px-6 py-2 align-middle">
                    <TimeSelect
                      value={toInputFormat(shift.inTime)}
                      onChange={(val) =>
                        handleTimeChange(shift.id, "inTime", val)
                      }
                      className={
                        !shift.inTime || !shift.outTime
                          ? "border-red-300 rounded bg-red-50 p-1"
                          : ""
                      }
                    />
                  </td>
                  <td className="px-6 py-2 align-middle relative group/time">
                    <TimeSelect
                      value={toInputFormat(shift.outTime)}
                      onChange={(val) =>
                        handleTimeChange(shift.id, "outTime", val)
                      }
                      className={
                        !shift.inTime || !shift.outTime
                          ? "border-red-300 rounded bg-red-50 p-1"
                          : ""
                      }
                    />
                    {/* Swap Button - centered on the timeline border */}
                    <button
                      onClick={() => handleSwapTimes(shift.id)}
                      className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-600 transition-all z-50 transform hover:scale-110"
                      title="Đổi giờ Vào/Ra"
                    >
                      <ArrowRightLeft size={14} />
                    </button>
                  </td>
                  <td className="p-3 text-right font-mono align-middle">
                    {calculateHours(shift.inTime, shift.outTime)}
                  </td>
                  <td className="p-3 text-center align-middle">
                    {/* We can re-check weekend based on InTime dynamically */}
                    {new Date(shift.inTime).getDay() === 0 ||
                    new Date(shift.inTime).getDay() === 6 ? (
                      <span className="text-indigo-600 font-bold">✓</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="p-2 text-center align-middle">
                    <button
                      onClick={() => handleDeleteShift(shift.id)}
                      className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                      title="Xóa dòng"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
                {/* Insert Button Overlay Area - Visible on hover of the row or itself */}
                <tr className="h-0 relative border-none hover:[&_div]:opacity-100 [.shift-row:hover_+_&_div]:opacity-100">
                  <td colSpan={7} className="p-0 border-none relative h-0">
                    <div className="absolute top-[-12px] left-0 w-full flex items-center justify-center h-6 opacity-0 transition-opacity z-50 pointer-events-none hover:pointer-events-auto">
                      {/* Visual line indicator */}
                      <div className="absolute w-full border-b-2 border-dashed border-blue-300 top-1/2 -translate-y-1/2 left-0 right-0"></div>
                      <button
                        onClick={() => handleAddShiftAt(index)}
                        className="relative bg-green-500 hover:bg-green-600 text-white rounded-full p-1.5 shadow-md transform scale-90 hover:scale-110 transition-transform z-30 pointer-events-auto"
                        title="Chèn dòng mới"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              </React.Fragment>
              ))}
              {shifts.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-gray-500 bg-gray-50 border-dashed border-2 rounded-lg m-4"
                  >
                    Chưa có dữ liệu chấm công. Bấm "Thêm dòng" để tạo mới.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-between items-center rounded-b-lg">
          <Button
            variant="outline"
            onClick={handleAddShift}
            className="border-dashed border-gray-400 text-gray-600 hover:bg-white hover:text-blue-600 hover:border-blue-500"
          >
            <Plus size={16} className="mr-2" /> Thêm dòng
          </Button>

          <div className="flex gap-3">
            <div className="text-sm text-gray-600 mr-4 flex flex-col items-end justify-center">
              <span>
                Tổng giờ:{" "}
                <b>
                  {shifts
                    .reduce(
                      (acc, s) => acc + calculateRawHours(s.inTime, s.outTime),
                      0
                    )
                    .toFixed(2)}
                </b>
              </span>
            </div>
            <Button variant="outline" onClick={onClose} className="mr-2">
              Hủy
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
            >
              <Save size={16} className="mr-2" /> Lưu Thay Đổi
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
