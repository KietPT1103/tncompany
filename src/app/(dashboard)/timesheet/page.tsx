"use client";

import ShiftDetailModal, { Shift } from "./ShiftDetailModal";
import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import * as XLSX from "xlsx";
import {
  Save,
  Upload,
  FileText,
  Calculator,
  ArrowLeft,
  Search,
  Trash2,
  X,
  Filter,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";
import { getEmployees, Employee } from "@/services/employees.firebase";
import { saveImportedPayroll } from "@/services/payrolls.firebase";
import { useStore } from "@/context/StoreContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getDefaultRoleForStore,
  getRoleGroupsForStore,
} from "../payroll/_components/payrollShared";

interface TimesheetRow {
  No: string;
  TMNo: string;
  EnNo: string;
  Name: string;
  Mode: string;
  INOUT: string;
  DateTime: string;
}

interface ProcessedShift {
  Name: string;
  Date: string;
  InTime: string;
  OutTime: string;
  WorkHours: number;
  IsWeekend: boolean;
}

interface EmployeeSummary {
  dbId?: string;
  Name: string;
  EnNo: string;
  Role: string; // New field
  Allowance: number; // New field
  Note: string; // New field
  TotalHours: number;
  WeekendHours: number;
  SalaryPerHour: number;
  TotalSalary: number;
  Errors: string[];
  Shifts: Shift[];
}

export default function TimesheetPage() {
  const [file, setFile] = useState<File | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summaryData, setSummaryData] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterError, setFilterError] = useState(false);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof EmployeeSummary | "Name" | "Role" | "TotalHours" | "TotalSalary";
    direction: "asc" | "desc" | null;
  }>({ key: "Name", direction: "asc" }); // Default sort by Name

  const [hoveredError, setHoveredError] = useState<{
    x: number;
    y: number;
    errors: string[];
  } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmpIndex, setSelectedEmpIndex] = useState<number | null>(null);

  // New State for DB integration
  const [dbEmployees, setDbEmployees] = useState<Employee[]>([]);
  const { storeId } = useStore();
  const roleGroups = getRoleGroupsForStore(storeId);
  const defaultRole = getDefaultRoleForStore(storeId);
  const router = useRouter();

  // Fetch employees on mount
  React.useEffect(() => {
    if (storeId) {
      getEmployees(storeId).then(setDbEmployees);
    }
  }, [storeId]);

  const filteredData = summaryData
    .filter((emp) => {
      const matchSearch =
        emp.Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.EnNo.includes(searchTerm);
      const matchRole = filterRole === "All" || emp.Role === filterRole;
      const matchError = !filterError || emp.Errors.length > 0;

      return matchSearch && matchRole && matchError;
    })
    .sort((a, b) => {
      if (!sortConfig.key || !sortConfig.direction) return 0;
      const key = sortConfig.key;
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      let valA: any = a[key as keyof EmployeeSummary];
      let valB: any = b[key as keyof EmployeeSummary];

      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      if (valA < valB) return -1 * direction;
      if (valA > valB) return 1 * direction;
      return 0;
    });

  const handleSort = (key: any) => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseFile = async (file: File): Promise<TimesheetRow[]> => {
    const text = await file.text();
    const lines = text.split("\n");
    const headers = lines[0].split("\t").map((h) => h.trim());
    const data: TimesheetRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split("\t");
      // Simple mapping based on known columns
      // No, TMNo, EnNo, Name, Mode, INOUT, DateTime
      // Handle potential misalignment if name is empty strictly?
      // Python code: data = pd.read_csv(..., sep="\t")
      // We will try to map by index assuming the user provided format is consistent
      // Looking at user code: No, TMNo, EnNo, Name, Mode, INOUT, DateTime

      // Safety check for columns length
      if (values.length < 7) continue;

      const row: any = {};
      // Map known headers or by index
      // Headers from file might be: No, TMNo, EnNo, Name, Mode, INOUT, DateTime
      row["No"] = values[0];
      row["TMNo"] = values[1];
      row["EnNo"] = values[2];
      row["Name"] = values[3];
      row["Mode"] = values[4];
      row["INOUT"] = values[5];
      row["DateTime"] = values[6]; // Format 2025/11/05 09:33:16 or similar
      data.push(row as TimesheetRow);
    }
    return data;
  };

  const handleHoursChange = (
    enNo: string,
    field: "TotalHours" | "WeekendHours",
    value: string
  ) => {
    const newSummary = [...summaryData];
    const index = newSummary.findIndex((s) => s.EnNo === enNo);
    if (index === -1) return;

    const val = parseFloat(value) || 0;
    newSummary[index][field] = val;

    // Recalculate salary automatically
    const salaryRate = newSummary[index].SalaryPerHour;
    const weekendHours = newSummary[index].WeekendHours;
    // Base salary + 1000 extra per weekend hour + allowance
    const allowance = newSummary[index].Allowance || 0;
    const total =
      newSummary[index].TotalHours * salaryRate +
      weekendHours * 1000 +
      allowance;
    newSummary[index].TotalSalary = Math.round(total / 1000) * 1000;

    setSummaryData(newSummary);
  };

  const processData = async () => {
    if (!file || !startDate || !endDate) {
      setError("Vui lòng chọn file và khoảng thời gian.");
      return;
    }
    setLoading(true);
    setError("");
    setSummaryData([]);

    try {
      const rawData = await parseFile(file);

      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);

      // Filter and convert dates
      const filtered = rawData.filter((row) => {
        const dt = new Date(row.DateTime);
        return !isNaN(dt.getTime()) && dt >= start && dt <= end;
      });

      // Group by employee code so payroll is tied to EnNo instead of display name
      const grouped: { [key: string]: TimesheetRow[] } = {};
      filtered.forEach((row) => {
        const employeeCode =
          row.EnNo?.trim() || `unknown_${row.Name || "employee"}`;
        if (!grouped[employeeCode]) grouped[employeeCode] = [];
        grouped[employeeCode].push(row);
      });

      const summaries: EmployeeSummary[] = [];

      Object.keys(grouped).forEach((employeeCode) => {
        // Sort by Time
        const rows = grouped[employeeCode].sort(
          (a, b) =>
            new Date(a.DateTime).getTime() - new Date(b.DateTime).getTime()
        );
        const displayName =
          rows.find((row) => row.Name?.trim())?.Name?.trim() ||
          `Unknown_${employeeCode}`;

        let totalHours = 0;
        let weekendHours = 0;
        let errors: string[] = [];
        let shifts: Shift[] = [];
        let i = 0;

        while (i < rows.length) {
          const inTimeStr = rows[i].DateTime;
          let matched = false;

          if (i + 1 < rows.length) {
            const outTimeStr = rows[i + 1].DateTime;
            const inTime = new Date(inTimeStr);
            const outTime = new Date(outTimeStr);

            // LOGIC: Shift must end before 5:00 AM of the NEXT day relative to inTime.
            // Calculate 5AM Limit
            const limitDate = new Date(inTime);
            if (limitDate.getHours() >= 5) {
              // Normal case: Start after 5am. Limit is 5am tomorrow.
              limitDate.setDate(limitDate.getDate() + 1);
            } else {
              // Edge case: Start before 5am (e.g. 4am). Limit is 5am TODAY?
              // Or does it belong to yesterday?
              // User says "after 5am start of next day".
              // So if InTime is 04:00, it might technically be "late shift from yesterday" but here we treat timestamps as just points.
              // If InTime is 04:00, let's allow it to go until 05:00 OR 05:00 next day?
              // Let's assume InTime > 5am generally. If InTime < 5am, limit is 5am Same Day (short shift) or Next Day?
              // Safest: limit is always Next 5AM boundary.
              // If 4am, next 5am is 5am today.
              // If 6am, next 5am is 5am tomorrow.
            }
            limitDate.setHours(5, 0, 0, 0);

            // Check if outTime is within limit
            if (outTime <= limitDate) {
              const diffMs = outTime.getTime() - inTime.getTime();
              const hours = diffMs / (1000 * 60 * 60);

              if (hours > 0) {
                totalHours += hours;
                const day = inTime.getDay();
                const isWeekend = day === 0 || day === 6;
                if (isWeekend) weekendHours += hours;

                shifts.push({
                  id: `${employeeCode}-${i}`,
                  date: inTimeStr.split(" ")[0],
                  inTime: inTimeStr,
                  outTime: outTimeStr,
                  hours: parseFloat(hours.toFixed(2)),
                  isWeekend: isWeekend,
                  isValid: true,
                });
                matched = true;
                i += 2;
              } else {
                matched = false;
              }
            } else {
              // OutTime is past the 5AM limit -> It belongs to Next Day
              // So Current IN is missing OUT.
              matched = false;
            }
          }

          if (!matched) {
            // Determine if it looks like a missing OUT or just an error
            // Just log the time so user knows
            errors.push(`Lẻ/Thiếu cặp: ${rows[i].DateTime}`);

            // Add Invalid Shift
            shifts.push({
              id: `${employeeCode}-${i}-err`,
              date: rows[i].DateTime.split(" ")[0],
              inTime: rows[i].DateTime,
              outTime: "", // Missing
              hours: 0,
              isWeekend: false,
              isValid: false,
            });
            i += 1;
          }
        }

        const matchedDbEmp = dbEmployees.find(
          (dbE) => dbE.employeeCode?.trim() === employeeCode
        );

        summaries.push({
          dbId: matchedDbEmp?.id,
          Name: displayName,
          EnNo: employeeCode,
          Role: matchedDbEmp?.role || "",
          Allowance: 0,
          Note: "",
          TotalHours: parseFloat(totalHours.toFixed(2)),
          WeekendHours: parseFloat(weekendHours.toFixed(2)),
          SalaryPerHour: matchedDbEmp ? matchedDbEmp.hourlyRate : 15000,
          TotalSalary: 0, // Will be recalc-ed immediately or next loop?
          // We should calc it here or let useEffect/handler handle?
          // Let's calc initial
          Errors: errors,
          Shifts: shifts,
        });
      });

      // Initial salary calc after population
      const FinalSummaries = summaries.map((s) => {
        const total =
          s.TotalHours * s.SalaryPerHour + s.WeekendHours * 1000 + s.Allowance;
        return {
          ...s,
          TotalSalary: Math.round(total / 1000) * 1000,
        };
      });

      // Sort by Role
      FinalSummaries.sort((a, b) => (a.Role || "").localeCompare(b.Role || ""));

      setSummaryData(FinalSummaries);
    } catch (err) {
      console.error(err);
      setError("Có lỗi xảy ra khi xử lý file.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmployee = (empNo: string) => {
    if (!confirm("Bạn có chắc muốn xóa nhân viên này khỏi báo cáo?")) return;
    setSummaryData((prev) => prev.filter((item) => item.EnNo !== empNo));
  };

  const handleSalaryChange = (enNo: string, value: string) => {
    const newSummary = [...summaryData];
    const index = newSummary.findIndex((s) => s.EnNo === enNo);
    if (index === -1) return;

    const salary = parseFloat(value) || 0;
    newSummary[index].SalaryPerHour = salary;
    // Calculate total salary
    // Formula: (TotalHours) * Salary? Or (Normal + Weekend * Multiplier)?
    // User request: "tổng số giờ làm, tổng số giờ làm cuối tuần, tôi chỉ cần sửa lương của mỗi người là được"
    // Usually Weekend is x1.5 or x2, but user didn't specify. I will calculate simply: Total * Salary for now.
    // Or maybe they want to pay different rate for weekend?
    // I will assume single rate for now, but maybe highlight weekend.
    // Let's stick to simple: Total Salary = Total Hours * Rate.
    // If they want separate weekend pay, they can ask.
    // Total Salary = (Total Hours * Rate) + (Weekend Hours * 1000)
    const weekendHours = newSummary[index].WeekendHours;
    const allowance = newSummary[index].Allowance || 0;
    const total =
      newSummary[index].TotalHours * salary + weekendHours * 1000 + allowance;
    newSummary[index].TotalSalary = Math.round(total / 1000) * 1000;
    setSummaryData(newSummary);
  };

  const handleSaveShifts = (updatedShifts: Shift[]) => {
    if (selectedEmpIndex === null) return;

    const newSummary = [...summaryData];
    const emp = newSummary[selectedEmpIndex];

    emp.Shifts = updatedShifts;

    let newTotal = 0;
    let newWeekend = 0;
    let newErrors: string[] = [];

    updatedShifts.forEach((s) => {
      // Calculate raw hours from inTime/outTime for precision
      let rawHours = 0;
      if (s.inTime && s.outTime) {
        const start = new Date(s.inTime);
        let end = new Date(s.outTime);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
          const diff = end.getTime() - start.getTime();
          rawHours = diff / (1000 * 60 * 60);
        }
      }

      if (s.isValid && rawHours > 0) {
        newTotal += rawHours;
        if (s.isWeekend) newWeekend += rawHours;
      } else {
        if (!s.isValid) {
          newErrors.push(`Lỗi/Thiếu: ${s.date} ${s.inTime || "?"}`);
        }
      }
    });

    emp.TotalHours = parseFloat(newTotal.toFixed(2));
    emp.WeekendHours = parseFloat(newWeekend.toFixed(2));
    emp.Errors = newErrors;

    const total =
      emp.TotalHours * emp.SalaryPerHour +
      emp.WeekendHours * 1000 +
      (emp.Allowance || 0);
    emp.TotalSalary = Math.round(total / 1000) * 1000;

    setSummaryData(newSummary);
  };

  const handleRoleChange = (enNo: string, value: string) => {
    const newSummary = [...summaryData];
    const index = newSummary.findIndex((s) => s.EnNo === enNo);
    if (index === -1) return;
    newSummary[index].Role = value;
    setSummaryData(newSummary);
  };

  const handleAllowanceChange = (enNo: string, value: string) => {
    const newSummary = [...summaryData];
    const index = newSummary.findIndex((s) => s.EnNo === enNo);
    if (index === -1) return;

    const val = parseFloat(value) || 0;
    newSummary[index].Allowance = val;

    // Recalc total
    const total =
      newSummary[index].TotalHours * newSummary[index].SalaryPerHour +
      newSummary[index].WeekendHours * 1000 +
      val;
    newSummary[index].TotalSalary = Math.round(total / 1000) * 1000;

    setSummaryData(newSummary);
  };

  const handleNoteChange = (enNo: string, value: string) => {
    const newSummary = [...summaryData];
    const index = newSummary.findIndex((s) => s.EnNo === enNo);
    if (index === -1) return;
    newSummary[index].Note = value;
    setSummaryData(newSummary);
  };

  const handleSaveToDB = async () => {
    if (!storeId) return;
    if (summaryData.length === 0) {
      setError("ChÆ°a cÃ³ dá»¯ liá»‡u Ä‘á»ƒ lÆ°u.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const payrollName = `Báº£ng lÆ°Æ¡ng ${startDate} - ${endDate}`;
      await saveImportedPayroll({
        storeId,
        name: payrollName,
        startDate,
        endDate,
        entries: summaryData.map((emp) => ({
          employeeId: emp.dbId || `manual_${emp.EnNo || Date.now()}`,
          employeeCode: emp.EnNo,
          employeeName: emp.Name,
          role: emp.Role || defaultRole,
          hourlyRate: emp.SalaryPerHour,
          totalHours: emp.TotalHours,
          weekendHours: emp.WeekendHours,
          salary: emp.TotalSalary,
          allowances:
            emp.Allowance > 0
              ? [{ name: "Phá»¥ cáº¥p", amount: emp.Allowance }]
              : [],
          note: emp.Note,
          salaryType: "hourly",
          fixedSalary: 0,
          standardHours: 0,
          shifts: emp.Shifts,
        })),
      });
      setDbEmployees(await getEmployees(storeId));
      alert("ÄÃ£ lÆ°u báº£ng lÆ°Æ¡ng vÃ o MySQL thÃ nh cÃ´ng!");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Lá»—i khi lÆ°u vÃ o MySQL");
    } finally {
      setLoading(false);
    }
    return;
    /*
      setError("Chưa cấu hình Firebase/Firestore để lưu CSDL.");
      return;
    }

    setLoading(true);
    try {
      const payrollName = `Bảng lương ${startDate} - ${endDate}`;
      const batch = writeBatch(db);

      const payrollRef = doc(collection(db, "payrolls"));
      batch.set(payrollRef, {
        storeId,
        name: payrollName,
        status: "draft",
        createdAt: serverTimestamp(),
      });

      for (const emp of summaryData) {
        let employeeId = emp.dbId;

        if (employeeId) {
          // Update existing employee info (Salary/Role)
          const empRef = doc(db, "employees", employeeId);
          batch.update(empRef, {
            employeeCode: emp.EnNo,
            name: emp.Name,
            hourlyRate: emp.SalaryPerHour,
            role: emp.Role,
          });
        } else {
          // Create new employee
          const newEmpRef = doc(collection(db, "employees"));
          batch.set(newEmpRef, {
            storeId,
            employeeCode: emp.EnNo,
            name: emp.Name,
            role: emp.Role || defaultRole,
            hourlyRate: emp.SalaryPerHour,
            createdAt: serverTimestamp(),
          });
          employeeId = newEmpRef.id;
        }

        const entryRef = doc(collection(db, "payroll_entries"));
        const entryData: PayrollEntry = {
          payrollId: payrollRef.id,
          employeeId: employeeId || "unknown",
          employeeCode: emp.EnNo,
          employeeName: emp.Name,
          role: emp.Role || defaultRole,
          hourlyRate: emp.SalaryPerHour,
          totalHours: emp.TotalHours,
          weekendHours: emp.WeekendHours,
          salary: emp.TotalSalary,
          allowances:
            emp.Allowance > 0
              ? [{ name: "Phụ cấp", amount: emp.Allowance }]
              : [],
          note: emp.Note,
          salaryType: "hourly",
          fixedSalary: 0,
          standardHours: 0,
          shifts: emp.Shifts, // Save detailed shifts
        };
        batch.set(entryRef, entryData);
      }

      await batch.commit();
      alert("Đã lưu bảng lương thành công!");
      // router.push("/payroll"); // Don't redirect
    } catch (e) {
      console.error(e);
      setError("Lỗi khi lưu vào CSDL");
    } finally {
      setLoading(false);
    }
    */
  };

  const handleBack = () => {
    router.push("/payroll");
  };

  const openShiftModal = (index: number) => {
    const emp = filteredData[index];
    const realIndex = summaryData.findIndex((e) => e.EnNo === emp.EnNo);
    if (realIndex !== -1) {
      setSelectedEmpIndex(realIndex);
      setIsModalOpen(true);
    }
  };

  const exportToCSV = () => {
    // Export functionality
    const ws = XLSX.utils.json_to_sheet(
      summaryData.map((s) => ({
        "Tên Nhân Viên": s.Name,
        "Mã NV": s.EnNo,
        "Tổng Giờ": s.TotalHours,
        "Giờ Cuối Tuần": s.WeekendHours,
        "Lương/Giờ": s.SalaryPerHour,
        "Tổng Lương": s.TotalSalary,
        Lỗi: s.Errors.join("; "),
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BangLuong");
    XLSX.writeFile(wb, "BangLuong.xlsx");
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Button>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Tính Lương & Giờ Làm (Import)
          </h1>
        </div>
      </div>

      <Card className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white/50 backdrop-blur-sm shadow-xl border-t border-white/20">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            File Chấm Công (TXT)
          </label>
          <div className="relative">
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div
              className={`p-2 border border-gray-300 rounded-md flex items-center gap-2 ${
                file ? "bg-blue-50 text-blue-700" : "bg-white text-gray-500"
              }`}
            >
              <FileText size={18} />
              <span className="truncate">
                {file ? file.name : "Chọn file..."}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Từ Ngày (00:00)
          </label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Đến Ngày (23:59)
          </label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <Button
          onClick={processData}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-105"
        >
          {loading ? (
            "Đang tính..."
          ) : (
            <>
              <Calculator className="mr-2 h-4 w-4" /> Tính Giờ Làm
            </>
          )}
        </Button>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-100">
          {error}
        </div>
      )}

      {summaryData.length > 0 && (
        <Card className="p-6 shadow-xl border-t border-white/20 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Kết Quả Tính Lương
            </h2>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">🔍</span>
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Tìm tên hoặc mã NV..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              <select
                className="h-9 px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
              >
                <option value="All">Tất cả vai trò</option>
                {Object.keys(roleGroups).map((group) => (
                  <optgroup key={group} label={group}>
                    {roleGroups[group].map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <Button
                variant={filterError ? "default" : "outline"}
                size="sm"
                className={`gap-2 h-9 ${
                  filterError
                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                    : "text-gray-600"
                }`}
                onClick={() => setFilterError(!filterError)}
                title="Chỉ hiện nhân viên có lỗi hoặc thiếu giờ"
              >
                <AlertCircle size={16} />
                <span className="hidden sm:inline">Lỗi</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2 h-9 text-gray-600"
                onClick={() => handleSort("Name")}
                title="Sắp xếp theo tên"
              >
                <ArrowUpDown size={16} />
              </Button>

              <Button
                variant="outline"
                onClick={exportToCSV}
                className="border-green-600 text-green-700 hover:bg-green-50 shrink-0 h-9"
              >
                <Save className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button
                onClick={handleSaveToDB}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 shrink-0 h-9"
              >
                <Save className="mr-2 h-4 w-4" /> Lưu DB
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="max-h-[600px] overflow-y-auto relative">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 bg-gray-50">Mã NV</th>
                    <th className="px-6 py-3 bg-gray-50">Tên Nhân Viên</th>
                    <th className="px-6 py-3 bg-gray-50">Vai Trò</th>
                    <th className="px-6 py-3 text-right bg-gray-50">
                      Tổng Giờ Làm
                    </th>
                    <th className="px-6 py-3 text-right text-indigo-600 bg-gray-50">
                      Giờ Cuối Tuần
                    </th>
                    <th className="px-6 py-3 text-right w-32 bg-gray-50">
                      Lương/Giờ
                    </th>
                    <th className="px-6 py-3 text-right font-bold text-green-700 bg-gray-50">
                      Tổng Lương
                    </th>
                    <th className="px-6 py-3 bg-gray-50 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((emp, index) => (
                    <tr
                      key={index}
                      className="bg-white border-b hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium flex items-center">
                        <span
                          className="cursor-pointer hover:text-blue-600 hover:underline"
                          onClick={() => openShiftModal(index)}
                        >
                          {emp.EnNo}
                        </span>
                        {emp.Errors.length > 0 && (
                          <span
                            className="cursor-pointer text-red-500 font-bold px-2 py-0.5 rounded-full bg-red-100 text-xs ml-2 animate-pulse"
                            onClick={(e) => {
                              e.stopPropagation();
                              openShiftModal(index);
                            }}
                            onMouseEnter={(e) => {
                              const rect =
                                e.currentTarget.getBoundingClientRect();
                              setHoveredError({
                                x: rect.left + window.scrollX + 20,
                                y: rect.top + window.scrollY,
                                errors: emp.Errors,
                              });
                            }}
                            onMouseLeave={() => setHoveredError(null)}
                          >
                            !
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <span
                          className="cursor-pointer hover:text-blue-600"
                          onClick={() => openShiftModal(index)}
                        >
                          {emp.Name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="w-full border p-1 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={emp.Role || ""}
                          onChange={(e) =>
                            handleRoleChange(emp.EnNo, e.target.value)
                          }
                        >
                          <option value="">-- Chọn --</option>
                          {Object.entries(roleGroups).map(([group, roles]) => (
                            <optgroup key={group} label={group}>
                              {roles.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          className="w-20 text-right border p-1 rounded font-mono focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={emp.TotalHours}
                          onChange={(e) =>
                            handleHoursChange(
                              emp.EnNo,
                              "TotalHours",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          className="w-20 text-right border p-1 rounded font-mono text-indigo-600 focus:ring-2 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          value={emp.WeekendHours}
                          onChange={(e) =>
                            handleHoursChange(
                              emp.EnNo,
                              "WeekendHours",
                              e.target.value
                            )
                          }
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          className="w-full p-1 text-right border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="0"
                          value={emp.SalaryPerHour || ""}
                          onChange={(e) =>
                            handleSalaryChange(emp.EnNo, e.target.value)
                          }
                        />
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-green-700 font-mono">
                        {emp.TotalSalary.toLocaleString("vi-VN")} đ
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleRemoveEmployee(emp.EnNo)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          title="Xóa nhân viên này"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-indigo-50 font-bold text-gray-900 sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] border-t-2 border-indigo-100">
                  <tr className="text-base">
                    <td
                      colSpan={3}
                      className="px-6 py-4 text-center text-indigo-800 uppercase tracking-wider"
                    >
                      Tổng Cộng
                    </td>
                    <td className="px-6 py-4 text-right">
                      {filteredData
                        .reduce((acc, curr) => acc + curr.TotalHours, 0)
                        .toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-700">
                      {filteredData
                        .reduce((acc, curr) => acc + curr.WeekendHours, 0)
                        .toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="bg-transparent"></td>
                    <td className="px-6 py-4 text-right text-lg text-green-700">
                      {filteredData
                        .reduce((acc, curr) => acc + curr.TotalSalary, 0)
                        .toLocaleString("vi-VN")}{" "}
                      đ
                    </td>
                    <td className="bg-transparent"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Fixed Tooltip Portal */}
      {hoveredError && (
        <div
          className="fixed z-9999 bg-gray-800 text-white text-xs rounded shadow-lg p-3 max-w-xs pointer-events-none"
          style={{
            left: hoveredError.x,
            top: hoveredError.y,
            transform: "translateY(-50%)",
          }}
        >
          <p className="font-bold border-b border-gray-600 pb-1 mb-1 text-red-200">
            Cảnh báo thiếu cặp:
          </p>
          <div className="max-h-32 overflow-y-auto custom-scrollbar">
            {hoveredError.errors.map((e, idx) => (
              <div key={idx} className="mb-0.5">
                {e}
              </div>
            ))}
          </div>
          {/* Left Arrow */}
          <div className="absolute top-1/2 -translate-y-1/2 right-full w-0 h-0 border-y-4 border-r-4 border-y-transparent border-r-gray-800"></div>
        </div>
      )}
      {/* Modal */}
      {selectedEmpIndex !== null && summaryData[selectedEmpIndex] && (
        <ShiftDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveShifts}
          employeeName={summaryData[selectedEmpIndex].Name}
          employeeId={summaryData[selectedEmpIndex].EnNo}
          initialShifts={summaryData[selectedEmpIndex].Shifts || []}
        />
      )}
    </div>
  );
}
