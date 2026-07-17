"use client";

import React, { useMemo, useState } from "react";
import ShiftDetailModal, { Shift } from "./ShiftDetailModal";
import DateRangePicker from "./DateRangePicker";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast } from "@/components/ui/Toast";
import { SelectBox, type SelectBoxOption } from "@/components/ui/SelectBox";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn, preventNumberInputScroll } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  FileText,
  Calculator,
  Search,
  Trash2,
  X,
  AlertCircle,
  UploadCloud,
  Users,
  Clock3,
  Download,
  Database,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  CalendarClock,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { getEmployees, Employee } from "@/services/employees.firebase";
import {
  saveImportedPayroll,
  type PayrollEntry,
} from "@/services/payrolls.firebase";
import { useStore } from "@/context/StoreContext";
import { useRouter } from "next/navigation";
import {
  calculatePayrollSalary,
  formatCurrency,
  formatHours,
  getAttendanceBonusProgress,
  getPayrollBreakdown,
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

interface EmployeeSummary {
  dbId?: string;
  Name: string;
  EnNo: string;
  Role: string;
  SalaryType: "hourly" | "monthly";
  Allowance: number;
  Note: string;
  TotalHours: number;
  WeekendHours: number;
  SalaryPerHour: number;
  MonthlySalary: number;
  ExpectedWorkDays: number;
  PaidLeaveDays: number;
  AttendanceBonusEnabled: boolean;
  AttendanceBonusDays: number;
  AttendanceBonusAmount: number;
  StandardHours: number;
  TotalSalary: number;
  Errors: string[];
  Shifts: Shift[];
}

type ImportConflictResolution = "same_employee" | "new_employee";
type TimesheetSort = "name_asc" | "hours_desc" | "salary_desc";

type EmployeeImportConflict = {
  employeeCode: string;
  importedName: string;
  existingEmployee: Employee;
  resolution: ImportConflictResolution | null;
};

const DEFAULT_IMPORTED_HOURLY_RATE = 15000;

const TIMESHEET_SORT_OPTIONS: readonly SelectBoxOption<TimesheetSort>[] = [
  { value: "name_asc", label: "Tên A-Z" },
  { value: "hours_desc", label: "Tổng giờ giảm dần" },
  { value: "salary_desc", label: "Tổng lương giảm dần" },
];

function normalizeImportedEmployeeName(value?: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasEmployeeNameConflict(
  existingEmployee: Employee | undefined,
  importedName: string,
) {
  if (!existingEmployee) return false;

  const normalizedImportedName = normalizeImportedEmployeeName(importedName);
  const normalizedExistingName = normalizeImportedEmployeeName(
    existingEmployee.name,
  );

  if (!normalizedImportedName || !normalizedExistingName) {
    return false;
  }

  return normalizedImportedName !== normalizedExistingName;
}

function buildPayrollEntryFromSummary(employee: EmployeeSummary): PayrollEntry {
  return {
    payrollId: "",
    employeeId: employee.dbId || employee.EnNo,
    employeeCode: employee.EnNo,
    employeeName: employee.Name,
    role: employee.Role,
    hourlyRate: employee.SalaryPerHour,
    totalHours: employee.TotalHours,
    weekendHours: employee.WeekendHours,
    salary: employee.TotalSalary,
    allowances:
      employee.Allowance > 0
        ? [{ name: "Phá»¥ cáº¥p", amount: employee.Allowance }]
        : [],
    note: employee.Note,
    salaryType: employee.SalaryType,
    monthlySalary: employee.MonthlySalary,
    expectedWorkDays: employee.ExpectedWorkDays,
    paidLeaveDays: employee.PaidLeaveDays,
    attendanceBonusEnabled: employee.AttendanceBonusEnabled,
    attendanceBonusDays: employee.AttendanceBonusDays,
    attendanceBonusAmount: employee.AttendanceBonusAmount,
    fixedSalary: employee.MonthlySalary,
    standardHours: employee.StandardHours,
    shifts: employee.Shifts,
  };
}

function calculateEmployeeTotal(employee: EmployeeSummary) {
  if (employee.SalaryType === "monthly") {
    return calculatePayrollSalary({
      payrollId: "",
      employeeId: employee.dbId || employee.EnNo,
      employeeCode: employee.EnNo,
      employeeName: employee.Name,
      role: employee.Role,
      hourlyRate: employee.SalaryPerHour,
      totalHours: employee.TotalHours,
      weekendHours: employee.WeekendHours,
      salary: 0,
      allowances:
        employee.Allowance > 0
          ? [{ name: "Phụ cấp", amount: employee.Allowance }]
          : [],
      note: employee.Note,
      salaryType: "monthly",
      monthlySalary: employee.MonthlySalary,
      expectedWorkDays: employee.ExpectedWorkDays,
      paidLeaveDays: employee.PaidLeaveDays,
      attendanceBonusEnabled: employee.AttendanceBonusEnabled,
      attendanceBonusDays: employee.AttendanceBonusDays,
      attendanceBonusAmount: employee.AttendanceBonusAmount,
      fixedSalary: employee.MonthlySalary,
      standardHours: employee.StandardHours,
      shifts: employee.Shifts,
    });
  }

  const total =
    employee.TotalHours * employee.SalaryPerHour +
    employee.WeekendHours * 1000 +
    (employee.Allowance || 0);
  return Math.round(total / 1000) * 1000;
}

export default function TimesheetPage() {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"month" | "custom">("custom");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedPeriod, setSelectedPeriod] = useState<1 | 2>(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [summaryData, setSummaryData] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("All");
  const [filterError, setFilterError] = useState(false);
  const [showImportSetup, setShowImportSetup] = useState(true);
  const [sortValue, setSortValue] = useState<TimesheetSort>("name_asc");
  const [sortConfig, setSortConfig] = useState<{
    key: keyof EmployeeSummary | "Name" | "Role" | "TotalHours" | "TotalSalary";
    direction: "asc" | "desc" | null;
  }>({ key: "Name", direction: "asc" });

  const [importConflicts, setImportConflicts] = useState<
    EmployeeImportConflict[]
  >([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmpIndex, setSelectedEmpIndex] = useState<number | null>(null);
  const [dbEmployees, setDbEmployees] = useState<Employee[]>([]);
  const [savedPayrollId, setSavedPayrollId] = useState("");
  const [salaryDetailEmployee, setSalaryDetailEmployee] =
    useState<EmployeeSummary | null>(null);
  const [employeePendingRemoval, setEmployeePendingRemoval] =
    useState<EmployeeSummary | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const { storeId } = useStore();
  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);
  const defaultRole = useMemo(() => getDefaultRoleForStore(storeId), [storeId]);
  const roleOptions = useMemo<readonly SelectBoxOption<string>[]>(
    () =>
      Object.entries(roleGroups).flatMap(([group, roles]) =>
        roles.map((role) => ({
          value: role,
          label: role,
          group,
          inset: true,
        })),
      ),
    [roleGroups],
  );
  const roleFilterOptions = useMemo<readonly SelectBoxOption<string>[]>(
    () => [{ value: "All", label: "Tất cả vai trò" }, ...roleOptions],
    [roleOptions],
  );
  const roleEditOptions = useMemo<readonly SelectBoxOption<string>[]>(
    () => [{ value: "", label: "Chưa chọn" }, ...roleOptions],
    [roleOptions],
  );
  const router = useRouter();

  const formatLocalDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate(),
    ).padStart(2, "0")}`;
  };

  const handleSelectPeriod = (monthValue: string, period: 1 | 2) => {
    const [year, month] = monthValue.split("-").map(Number);
    const periodStart =
      period === 1
        ? new Date(year, month - 1, 1)
        : new Date(year, month - 1, 16);
    const periodEnd =
      period === 1 ? new Date(year, month - 1, 15) : new Date(year, month, 0);

    setMode("month");
    setSelectedMonth(monthValue);
    setSelectedPeriod(period);
    setStartDate(formatLocalDate(periodStart));
    setEndDate(formatLocalDate(periodEnd));
  };

  const handleSelectRange = (nextStartDate: string, nextEndDate: string) => {
    setMode("custom");
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
  };

  const handleClearRange = () => {
    setMode("custom");
    setStartDate("");
    setEndDate("");
  };

  const isMonthlyEmployee = (employee?: Employee) => {
    return (
      employee?.salaryType === "monthly" || (employee?.monthlySalary || 0) > 0
    );
  };

  const resolveImportedSalaryType = (employee?: Employee) => {
    if (
      isMonthlyEmployee(employee) &&
      (mode === "custom" || (mode === "month" && selectedPeriod === 2))
    ) {
      return "monthly" as const;
    }

    return "hourly" as const;
  };

  const buildEmployeeRowsMap = (rows: TimesheetRow[]) => {
    const grouped: Record<string, TimesheetRow[]> = {};

    rows.forEach((row) => {
      const employeeCode =
        row.EnNo?.trim() || `unknown_${row.Name || "employee"}`;
      if (!grouped[employeeCode]) grouped[employeeCode] = [];
      grouped[employeeCode].push(row);
    });

    return grouped;
  };

  const summarizeRows = (employeeCode: string, rows: TimesheetRow[]) => {
    const sortedRows = [...rows].sort(
      (left, right) =>
        new Date(left.DateTime).getTime() - new Date(right.DateTime).getTime(),
    );
    const displayName =
      sortedRows.find((row) => row.Name?.trim())?.Name?.trim() ||
      `Unknown_${employeeCode}`;

    let totalHours = 0;
    let weekendHours = 0;
    const errors: string[] = [];
    const shifts: Shift[] = [];
    let pointer = 0;

    while (pointer < sortedRows.length) {
      const inTimeStr = sortedRows[pointer].DateTime;
      let matched = false;

      if (pointer + 1 < sortedRows.length) {
        const outTimeStr = sortedRows[pointer + 1].DateTime;
        const inTime = new Date(inTimeStr);
        const outTime = new Date(outTimeStr);
        const limitDate = new Date(inTime);
        if (limitDate.getHours() >= 5) {
          limitDate.setDate(limitDate.getDate() + 1);
        }
        limitDate.setHours(5, 0, 0, 0);

        if (outTime <= limitDate) {
          const diffMs = outTime.getTime() - inTime.getTime();
          const hours = diffMs / (1000 * 60 * 60);
          if (hours > 0) {
            totalHours += hours;
            const day = inTime.getDay();
            const isWeekend = day === 0 || day === 6;
            if (isWeekend) weekendHours += hours;

            shifts.push({
              id: `${employeeCode}-${pointer}`,
              date: inTimeStr.split(" ")[0],
              inTime: inTimeStr,
              outTime: outTimeStr,
              hours: Number.parseFloat(hours.toFixed(2)),
              isWeekend,
              isValid: true,
            });
            matched = true;
            pointer += 2;
          }
        }
      }

      if (!matched) {
        errors.push(`Lá»—i/thiáº¿u cáº·p: ${sortedRows[pointer].DateTime}`);
        shifts.push({
          id: `${employeeCode}-${pointer}-err`,
          date: sortedRows[pointer].DateTime.split(" ")[0],
          inTime: sortedRows[pointer].DateTime,
          outTime: "",
          hours: 0,
          isWeekend: false,
          isValid: false,
        });
        pointer += 1;
      }
    }

    return {
      displayName,
      totalHours: Number.parseFloat(totalHours.toFixed(2)),
      weekendHours: Number.parseFloat(weekendHours.toFixed(2)),
      errors,
      shifts,
    };
  };

  const getEmployeeBreakdown = (employee: EmployeeSummary) => {
    const entry: PayrollEntry = {
      payrollId: "",
      employeeId: employee.dbId || employee.EnNo,
      employeeCode: employee.EnNo,
      employeeName: employee.Name,
      role: employee.Role,
      hourlyRate: employee.SalaryPerHour,
      totalHours: employee.TotalHours,
      weekendHours: employee.WeekendHours,
      salary: employee.TotalSalary,
      allowances:
        employee.Allowance > 0
          ? [{ name: "Phụ cấp", amount: employee.Allowance }]
          : [],
      note: employee.Note,
      salaryType: employee.SalaryType,
      monthlySalary: employee.MonthlySalary,
      expectedWorkDays: employee.ExpectedWorkDays,
      paidLeaveDays: employee.PaidLeaveDays,
      attendanceBonusEnabled: employee.AttendanceBonusEnabled,
      attendanceBonusDays: employee.AttendanceBonusDays,
      attendanceBonusAmount: employee.AttendanceBonusAmount,
      fixedSalary: employee.MonthlySalary,
      standardHours: employee.StandardHours,
      shifts: employee.Shifts,
    };

    return getPayrollBreakdown(entry);
  };

  React.useEffect(() => {
    if (!storeId) return;
    getEmployees(storeId)
      .then(setDbEmployees)
      .catch((err) => {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Không tải được danh sách nhân viên từ API.",
        );
      });
  }, [storeId]);

  React.useEffect(() => {
    if (mode === "month" && selectedMonth) {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);

      if (selectedPeriod === 1) {
        setStartDate(formatLocalDate(startOfMonth));
        setEndDate(formatLocalDate(new Date(year, month - 1, 15)));
      } else {
        setStartDate(formatLocalDate(new Date(year, month - 1, 16)));
        setEndDate(formatLocalDate(endOfMonth));
      }
    }
  }, [mode, selectedMonth, selectedPeriod]);

  const filteredData = useMemo(() => {
    return [...summaryData]
      .filter((emp) => {
        const keyword = searchTerm.trim().toLowerCase();
        const matchSearch =
          !keyword ||
          emp.Name.toLowerCase().includes(keyword) ||
          emp.EnNo.toLowerCase().includes(keyword);
        const matchRole = filterRole === "All" || emp.Role === filterRole;
        const matchError = !filterError || emp.Errors.length > 0;
        return matchSearch && matchRole && matchError;
      })
      .sort((a, b) => {
        if (!sortConfig.key || !sortConfig.direction) return 0;
        const direction = sortConfig.direction === "asc" ? 1 : -1;
        let valA: string | number = a[
          sortConfig.key as keyof EmployeeSummary
        ] as string | number;
        let valB: string | number = b[
          sortConfig.key as keyof EmployeeSummary
        ] as string | number;

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return -1 * direction;
        if (valA > valB) return 1 * direction;
        return 0;
      });
  }, [summaryData, searchTerm, filterRole, filterError, sortConfig]);

  const unresolvedImportConflicts = useMemo(
    () => importConflicts.filter((conflict) => !conflict.resolution),
    [importConflicts],
  );

  const handleSortChange = (value: TimesheetSort) => {
    setSortValue(value);
    if (value === "hours_desc") {
      setSortConfig({ key: "TotalHours", direction: "desc" });
      return;
    }
    if (value === "salary_desc") {
      setSortConfig({ key: "TotalSalary", direction: "desc" });
      return;
    }
    setSortConfig({ key: "Name", direction: "asc" });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
  };

  const parseFile = async (sourceFile: File): Promise<TimesheetRow[]> => {
    const text = await sourceFile.text();
    const lines = text.split("\n");
    const data: TimesheetRow[] = [];

    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line) continue;
      const values = line.split("\t");
      if (values.length < 7) continue;
      data.push({
        No: values[0],
        TMNo: values[1],
        EnNo: values[2],
        Name: values[3],
        Mode: values[4],
        INOUT: values[5],
        DateTime: values[6],
      });
    }

    return data;
  };

  const handleHoursChange = (
    enNo: string,
    field: "TotalHours" | "WeekendHours",
    value: string,
  ) => {
    setSummaryData((current) =>
      current.map((employee) => {
        if (employee.EnNo !== enNo) return employee;
        const nextValue = Number.parseFloat(value) || 0;
        const nextEmployee = {
          ...employee,
          [field]: nextValue,
        } as EmployeeSummary;
        nextEmployee.TotalSalary = calculateEmployeeTotal(nextEmployee);
        return nextEmployee;
      }),
    );
  };

  const processData = async () => {
    if (!file || !startDate || !endDate) {
      setError("Vui lòng chọn file và khoảng thời gian.");
      return;
    }

    setLoading(true);
    setError("");
    setSummaryData([]);
    setImportConflicts([]);
    setSavedPayrollId("");

    try {
      const rawData = await parseFile(file);
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);
      const monthStart =
        mode === "month" && selectedMonth
          ? new Date(`${selectedMonth}-01T00:00:00`)
          : start;

      const filteredRows = rawData.filter((row) => {
        const date = new Date(row.DateTime);
        return !Number.isNaN(date.getTime()) && date >= start && date <= end;
      });

      const monthlyRows =
        mode === "month" && selectedPeriod === 2
          ? rawData.filter((row) => {
              const date = new Date(row.DateTime);
              return (
                !Number.isNaN(date.getTime()) &&
                date >= monthStart &&
                date <= end
              );
            })
          : filteredRows;

      const selectedRowsByEmployee = buildEmployeeRowsMap(filteredRows);
      const monthlyRowsByEmployee = buildEmployeeRowsMap(monthlyRows);
      const employeeCodes = new Set(Object.keys(selectedRowsByEmployee));

      if (mode === "month" && selectedPeriod === 2) {
        dbEmployees.forEach((employee) => {
          if (isMonthlyEmployee(employee) && employee.employeeCode?.trim()) {
            employeeCodes.add(employee.employeeCode.trim());
          }
        });
      }

      const summaries: EmployeeSummary[] = [];
      const nextConflicts: EmployeeImportConflict[] = [];
      for (const employeeCode of employeeCodes) {
        const matchedDbEmployee = dbEmployees.find(
          (employee) => employee.employeeCode?.trim() === employeeCode,
        );
        const { displayName, totalHours, weekendHours, errors, shifts } =
          summarizeRows(
            employeeCode,
            selectedRowsByEmployee[employeeCode] || [],
          );
        const useMonthlySalary =
          resolveImportedSalaryType(matchedDbEmployee) === "monthly";

        if (
          mode === "month" &&
          selectedPeriod === 1 &&
          isMonthlyEmployee(matchedDbEmployee)
        ) {
          continue;
        }

        const sourceRows = useMonthlySalary
          ? monthlyRowsByEmployee[employeeCode] || []
          : selectedRowsByEmployee[employeeCode] || [];

        if (sourceRows.length === 0 && !useMonthlySalary) {
          continue;
        }

        const summarizedSource =
          useMonthlySalary &&
          sourceRows !== (selectedRowsByEmployee[employeeCode] || [])
            ? summarizeRows(employeeCode, sourceRows)
            : { displayName, totalHours, weekendHours, errors, shifts };
        const resolvedImportedName = summarizedSource.displayName.trim();

        if (hasEmployeeNameConflict(matchedDbEmployee, resolvedImportedName)) {
          nextConflicts.push({
            employeeCode,
            importedName: resolvedImportedName,
            existingEmployee: matchedDbEmployee as Employee,
            resolution: null,
          });
        }

        /*
        while (pointer < rows.length) {
          const inTimeStr = rows[pointer].DateTime;
          let matched = false;

          if (pointer + 1 < rows.length) {
            const outTimeStr = rows[pointer + 1].DateTime;
            const inTime = new Date(inTimeStr);
            const outTime = new Date(outTimeStr);
            const limitDate = new Date(inTime);
            if (limitDate.getHours() >= 5) {
              limitDate.setDate(limitDate.getDate() + 1);
            }
            limitDate.setHours(5, 0, 0, 0);

            if (outTime <= limitDate) {
              const diffMs = outTime.getTime() - inTime.getTime();
              const hours = diffMs / (1000 * 60 * 60);
              if (hours > 0) {
                totalHours += hours;
                const day = inTime.getDay();
                const isWeekend = day === 0 || day === 6;
                if (isWeekend) weekendHours += hours;

                shifts.push({
                  id: `${employeeCode}-${pointer}`,
                  date: inTimeStr.split(" ")[0],
                  inTime: inTimeStr,
                  outTime: outTimeStr,
                  hours: Number.parseFloat(hours.toFixed(2)),
                  isWeekend,
                  isValid: true,
                });
                matched = true;
                pointer += 2;
              }
            }
          }

          if (!matched) {
            errors.push(`Lỗi/thiếu cặp: ${rows[pointer].DateTime}`);
            shifts.push({
              id: `${employeeCode}-${pointer}-err`,
              date: rows[pointer].DateTime.split(" ")[0],
              inTime: rows[pointer].DateTime,
              outTime: "",
              hours: 0,
              isWeekend: false,
              isValid: false,
            });
            pointer += 1;
          }
        }

        const matchedDbEmployee = dbEmployees.find(
          (employee) => employee.employeeCode?.trim() === employeeCode
        );

        // Skip full-time employees in period 1
        if (mode === 'month' && selectedPeriod === 1 && matchedDbEmployee?.monthlySalary > 0) {
          continue;
        }

        */
        const summary: EmployeeSummary = {
          dbId: matchedDbEmployee?.id,
          Name:
            summarizedSource.displayName.trim() ||
            matchedDbEmployee?.name ||
            `Unknown_${employeeCode}`,
          EnNo: employeeCode,
          Role: matchedDbEmployee?.role || "",
          SalaryType: useMonthlySalary ? "monthly" : "hourly",
          Allowance: 0,
          Note: "",
          TotalHours: summarizedSource.totalHours,
          WeekendHours: summarizedSource.weekendHours,
          SalaryPerHour:
            matchedDbEmployee?.hourlyRate || DEFAULT_IMPORTED_HOURLY_RATE,
          MonthlySalary: matchedDbEmployee?.monthlySalary || 0,
          ExpectedWorkDays: matchedDbEmployee?.expectedWorkDays || 30,
          PaidLeaveDays: matchedDbEmployee?.paidLeaveDays || 0,
          AttendanceBonusEnabled:
            matchedDbEmployee?.attendanceBonusEnabled || false,
          AttendanceBonusDays: matchedDbEmployee?.attendanceBonusDays || 0,
          AttendanceBonusAmount: matchedDbEmployee?.attendanceBonusAmount || 0,
          StandardHours: matchedDbEmployee?.standardHours || 0,
          TotalSalary: 0,
          Errors: summarizedSource.errors,
          Shifts: summarizedSource.shifts,
        };

        summary.TotalSalary = calculateEmployeeTotal(summary);

        summaries.push(summary);
      }

      summaries.sort((left, right) =>
        (left.Role || "").localeCompare(right.Role || ""),
      );
      setSummaryData(summaries);
      setImportConflicts(nextConflicts);
      setShowImportSetup(false);
    } catch (err) {
      console.error(err);
      setError("Có lỗi xảy ra khi xử lý file.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmployee = (empNo: string) => {
    const employee = summaryData.find((item) => item.EnNo === empNo);
    if (employee) setEmployeePendingRemoval(employee);
  };

  const confirmRemoveEmployee = () => {
    if (!employeePendingRemoval) return;
    const removedEmployeeName = employeePendingRemoval.Name;
    setSummaryData((current) =>
      current.filter((item) => item.EnNo !== employeePendingRemoval.EnNo),
    );
    setEmployeePendingRemoval(null);
    setSuccessMessage(
      "Đã xóa " + removedEmployeeName + " khỏi báo cáo chấm công.",
    );
  };

  const handleSalaryChange = (enNo: string, value: string) => {
    setSummaryData((current) =>
      current.map((employee) => {
        if (employee.EnNo !== enNo) return employee;
        const nextEmployee = {
          ...employee,
          SalaryPerHour: Number.parseFloat(value) || 0,
        };
        nextEmployee.TotalSalary = calculateEmployeeTotal(nextEmployee);
        return nextEmployee;
      }),
    );
  };

  const handleSaveShifts = (updatedShifts: Shift[]) => {
    if (selectedEmpIndex === null) return;

    setSummaryData((current) =>
      current.map((employee, index) => {
        if (index !== selectedEmpIndex) return employee;

        let totalHours = 0;
        let weekendHours = 0;
        const errors: string[] = [];

        updatedShifts.forEach((shift) => {
          let rawHours = 0;
          if (shift.inTime && shift.outTime) {
            const start = new Date(shift.inTime);
            let end = new Date(shift.outTime);
            if (
              !Number.isNaN(start.getTime()) &&
              !Number.isNaN(end.getTime())
            ) {
              if (end <= start)
                end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
              rawHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            }
          }

          if (shift.isValid && rawHours > 0) {
            totalHours += rawHours;
            if (shift.isWeekend) weekendHours += rawHours;
          } else if (!shift.isValid) {
            errors.push(`Lỗi/thiếu: ${shift.date} ${shift.inTime || "?"}`);
          }
        });

        const nextEmployee = {
          ...employee,
          Shifts: updatedShifts,
          TotalHours: Number.parseFloat(totalHours.toFixed(2)),
          WeekendHours: Number.parseFloat(weekendHours.toFixed(2)),
          Errors: errors,
        };
        nextEmployee.TotalSalary = calculateEmployeeTotal(nextEmployee);
        return nextEmployee;
      }),
    );
  };

  const handleRoleChange = (enNo: string, value: string) => {
    setSummaryData((current) =>
      current.map((employee) =>
        employee.EnNo === enNo ? { ...employee, Role: value } : employee,
      ),
    );
  };

  const handleAllowanceChange = (enNo: string, value: string) => {
    setSummaryData((current) =>
      current.map((employee) => {
        if (employee.EnNo !== enNo) return employee;
        const nextEmployee = {
          ...employee,
          Allowance: Number.parseFloat(value) || 0,
        };
        nextEmployee.TotalSalary = calculateEmployeeTotal(nextEmployee);
        return nextEmployee;
      }),
    );
  };

  const handleNoteChange = (enNo: string, value: string) => {
    setSummaryData((current) =>
      current.map((employee) =>
        employee.EnNo === enNo ? { ...employee, Note: value } : employee,
      ),
    );
  };

  const handleConflictResolutionChange = (
    employeeCode: string,
    resolution: ImportConflictResolution,
  ) => {
    const targetConflict = importConflicts.find(
      (conflict) => conflict.employeeCode === employeeCode,
    );
    if (!targetConflict) return;

    setImportConflicts((current) =>
      current.map((conflict) =>
        conflict.employeeCode === employeeCode
          ? { ...conflict, resolution }
          : conflict,
      ),
    );

    setSummaryData((current) =>
      current.map((employee) => {
        if (employee.EnNo !== employeeCode) return employee;

        if (resolution === "same_employee") {
          const salaryType = resolveImportedSalaryType(
            targetConflict.existingEmployee,
          );
          const nextEmployee: EmployeeSummary = {
            ...employee,
            dbId: targetConflict.existingEmployee.id,
            Name: targetConflict.existingEmployee.name,
            Role: targetConflict.existingEmployee.role || "",
            SalaryType: salaryType,
            SalaryPerHour:
              targetConflict.existingEmployee.hourlyRate ||
              DEFAULT_IMPORTED_HOURLY_RATE,
            MonthlySalary: targetConflict.existingEmployee.monthlySalary || 0,
            ExpectedWorkDays:
              salaryType === "monthly"
                ? targetConflict.existingEmployee.expectedWorkDays || 30
                : targetConflict.existingEmployee.expectedWorkDays || 0,
            PaidLeaveDays: targetConflict.existingEmployee.paidLeaveDays || 0,
            AttendanceBonusEnabled:
              targetConflict.existingEmployee.attendanceBonusEnabled || false,
            AttendanceBonusDays:
              targetConflict.existingEmployee.attendanceBonusDays || 0,
            AttendanceBonusAmount:
              targetConflict.existingEmployee.attendanceBonusAmount || 0,
            StandardHours: targetConflict.existingEmployee.standardHours || 0,
          };
          nextEmployee.TotalSalary = calculateEmployeeTotal(nextEmployee);
          return nextEmployee;
        }

        const nextEmployee: EmployeeSummary = {
          ...employee,
          dbId: targetConflict.existingEmployee.id,
          Name: targetConflict.importedName,
          Role: defaultRole,
          SalaryType: "hourly",
          SalaryPerHour: DEFAULT_IMPORTED_HOURLY_RATE,
          MonthlySalary: 0,
          ExpectedWorkDays: 0,
          PaidLeaveDays: 0,
          AttendanceBonusEnabled: false,
          AttendanceBonusDays: 0,
          AttendanceBonusAmount: 0,
          StandardHours: 0,
        };
        nextEmployee.TotalSalary = calculateEmployeeTotal(nextEmployee);
        return nextEmployee;
      }),
    );
  };

  const handleSaveToDB = async () => {
    if (!storeId) return;
    if (summaryData.length === 0) {
      setError("Chưa có dữ liệu để lưu.");
      return;
    }
    if (unresolvedImportConflicts.length > 0) {
      setError(
        `Có ${unresolvedImportConflicts.length} nhân viên cần kiểm tra do mã trùng nhưng tên khác. Vui lòng xác nhận trước khi lưu DB.`,
      );
      return;
    }

    setError("");
    setLoading(true);
    try {
      const payrollName =
        mode === "month"
          ? `Bảng lương tháng ${new Date(selectedMonth + "-01").toLocaleDateString("vi-VN", { year: "numeric", month: "long" })} - Đợt ${selectedPeriod}`
          : `Bảng lương ${startDate} - ${endDate}`;

      const payrollId = await saveImportedPayroll({
        storeId,
        name: payrollName,
        startDate,
        endDate,
        entries: summaryData.map((employee) => {
          const matchedDbEmployee = dbEmployees.find(
            (emp) => emp.employeeCode?.trim() === employee.EnNo,
          );
          const salaryType =
            employee.SalaryType || resolveImportedSalaryType(matchedDbEmployee);
          const matchedConflict = importConflicts.find(
            (conflict) => conflict.employeeCode === employee.EnNo,
          );

          return {
            employeeId:
              employee.dbId || `manual_${employee.EnNo || Date.now()}`,
            employeeCode: employee.EnNo,
            employeeName: employee.Name,
            role: employee.Role || defaultRole,
            hourlyRate: employee.SalaryPerHour,
            totalHours: employee.TotalHours,
            weekendHours: employee.WeekendHours,
            salary: employee.TotalSalary,
            allowances:
              employee.Allowance > 0
                ? [{ name: "Phụ cấp", amount: employee.Allowance }]
                : [],
            note: employee.Note,
            salaryType,
            monthlySalary:
              salaryType === "monthly" ? employee.MonthlySalary : 0,
            fixedSalary: salaryType === "monthly" ? employee.MonthlySalary : 0,
            expectedWorkDays:
              salaryType === "monthly" ? employee.ExpectedWorkDays : 0,
            paidLeaveDays:
              salaryType === "monthly" ? employee.PaidLeaveDays : 0,
            attendanceBonusEnabled:
              salaryType === "monthly"
                ? employee.AttendanceBonusEnabled
                : false,
            attendanceBonusDays:
              salaryType === "monthly" ? employee.AttendanceBonusDays : 0,
            attendanceBonusAmount:
              salaryType === "monthly" ? employee.AttendanceBonusAmount : 0,
            standardHours:
              salaryType === "monthly" ? employee.StandardHours : 0,
            employeeReuseDecision:
              matchedConflict?.resolution === "new_employee"
                ? "new_employee"
                : matchedConflict?.resolution === "same_employee"
                  ? "same_employee"
                  : null,
            shifts: employee.Shifts,
          };
        }) as Array<Partial<PayrollEntry>>,
      });

      setSavedPayrollId(payrollId);
      setDbEmployees(await getEmployees(storeId));
      setSuccessMessage("Đã lưu bảng lương vào MySQL thành công.");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Lỗi khi lưu vào MySQL");
    } finally {
      setLoading(false);
    }
  };

  const openShiftModal = (index: number) => {
    const employee = filteredData[index];
    const realIndex = summaryData.findIndex(
      (item) => item.EnNo === employee.EnNo,
    );
    if (realIndex !== -1) {
      setSelectedEmpIndex(realIndex);
      setIsModalOpen(true);
    }
  };

  const exportToCSV = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      summaryData.map((employee) => ({
        EmployeeName: employee.Name,
        EmployeeCode: employee.EnNo,
        TotalHours: employee.TotalHours,
        WeekendHours: employee.WeekendHours,
        HourlyRate: employee.SalaryPerHour,
        TotalSalary: employee.TotalSalary,
        Errors: employee.Errors.join("; "),
      })),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BangLuong");
    XLSX.writeFile(workbook, "BangLuong.xlsx");
  };

  const salaryDetailBreakdown = salaryDetailEmployee
    ? getEmployeeBreakdown(salaryDetailEmployee)
    : null;
  const salaryDetailAttendanceProgress = salaryDetailEmployee
    ? getAttendanceBonusProgress(
        buildPayrollEntryFromSummary(salaryDetailEmployee),
      )
    : null;

  const timesheetTotals = useMemo(
    () =>
      summaryData.reduce(
        (totals, employee) => ({
          hours: totals.hours + employee.TotalHours,
          salary: totals.salary + employee.TotalSalary,
          errors: totals.errors + (employee.Errors.length > 0 ? 1 : 0),
        }),
        { hours: 0, salary: 0, errors: 0 },
      ),
    [summaryData],
  );

  return (
    <div className="mx-auto max-w-screen-2xl space-y-4 p-3 sm:p-5 lg:p-6">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-smooch text-4xl font-bold text-emerald-800 sm:text-5xl">
              Chấm công
            </h1>
            <p className="mt-1 max-w-2xl text-sm font-firasans text-[#d6ba5d] font-bold">
              Import dữ liệu máy chấm công.
            </p>
          </div>
        </div>
      </header>

      {showImportSetup || summaryData.length === 0 ? (
        <section
          className="overflow-hidden rounded-[2px] border border-slate-200 bg-white"
          aria-labelledby="timesheet-import-title"
        >
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <h2
              id="timesheet-import-title"
              className="text-base font-semibold text-slate-950"
            >
              Dữ liệu chấm công
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Chọn file từ máy chấm công và khoảng ngày cần xử lý.
            </p>
          </div>

          <div
            className="
              grid grid-cols-1 gap-3 p-4
              sm:p-5
              md:grid-cols-2
              xl:grid-cols-[minmax(240px,0.85fr)_minmax(320px,1.15fr)_auto]
              xl:items-start
            "
          >
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">
                File chấm công
              </span>
              <label className="group flex h-11 cursor-pointer items-center gap-2.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 transition-[border-color,background-color] duration-150 hover:border-primary hover:bg-primary/5 sm:h-10">
                <input
                  type="file"
                  accept=".txt,.csv"
                  onChange={handleFileChange}
                  className="sr-only"
                />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-emerald-800 shadow-sm">
                  {file ? (
                    <FileText className="h-5 w-5" />
                  ) : (
                    <UploadCloud className="h-5 w-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-emerald-800">
                  {file ? file.name : "Chọn file TXT hoặc CSV"}
                </span>
              </label>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-700">
                Khoảng thời gian
              </span>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                mode={mode}
                selectedMonth={selectedMonth}
                selectedPeriod={selectedPeriod}
                onSelectPeriod={handleSelectPeriod}
                onSelectRange={handleSelectRange}
                onClear={handleClearRange}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Chọn Đợt 1, Đợt 2 hoặc một khoảng ngày tùy chỉnh.
              </p>
            </div>

            <Button
              onClick={processData}
              disabled={loading || !file || !startDate || !endDate}
              className="
                h-10 w-full gap-2
                text-xs
                whitespace-nowrap
                bg-emerald-700 px-5
                font-semibold text-white
                shadow-[0_2px_6px_rgba(4,120,87,0.22)]
                transition-[background-color,box-shadow,transform]
                duration-200 ease-out

                hover:bg-emerald-800
                hover:text-white
                hover:shadow-[0_4px_10px_rgba(4,120,87,0.28)]

                active:scale-[0.98]

                disabled:cursor-not-allowed
                disabled:border-slate-200
                disabled:bg-slate-200
                disabled:text-slate-400
                disabled:shadow-none
                disabled:opacity-100

                md:col-span-2
                xl:col-span-1
                xl:mt-[25px]
                xl:w-auto
                xl:min-w-[150px]
              "
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 shrink-0" />
                  <span>
                    {summaryData.length > 0 ? "Tính lại" : "Tính giờ làm"}
                  </span>
                </>
              )}
            </Button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-3 rounded-[2px] border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-white">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {file?.name || "File chấm công"}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <span>
                  {startDate} - {endDate}
                </span>
                <span>
                  {mode === "month"
                    ? "Đợt " + selectedPeriod + " · " + selectedMonth
                    : "Khoảng tùy chọn"}
                </span>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="group h-9 gap-1.5 rounded-[2px] border-emerald-700 bg-emerald-700 px-3 text-xs font-semibold text-white shadow-none transition-[background-color,border-color,color,transform] duration-200 hover:border-emerald-800 hover:bg-emerald-800 hover:text-white active:scale-[0.96]"
            onClick={() => setShowImportSetup(true)}
          >
            <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 ease-in-out group-hover:rotate-180" />
            Đổi file
          </Button>
        </section>
      )}

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {importConflicts.length > 0 ? (
        <section
          className="overflow-hidden rounded-[2px] border border-amber-500 bg-white"
          aria-labelledby="timesheet-conflicts-title"
        >
          <div className="flex items-start justify-between gap-3 border-b border-amber-500 bg-amber-50 px-3 py-3 sm:items-center sm:px-4">
            <div className="min-w-0">
              <h2
                id="timesheet-conflicts-title"
                className="text-base font-semibold text-amber-950"
              >
                Xác nhận nhân viên trùng mã
              </h2>
              <p className="mt-0.5 text-sm text-amber-800">
                Tên trong file khác tên đang lưu. Cần xác nhận trước khi lưu DB.
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                unresolvedImportConflicts.length > 0
                  ? "bg-amber-100 text-amber-900"
                  : "bg-emerald-100 text-emerald-800",
              )}
            >
              {unresolvedImportConflicts.length > 0
                ? `${unresolvedImportConflicts.length} chưa xử lý`
                : "Đã xử lý"}
            </span>
          </div>

          <div className="divide-y divide-slate-200">
            {importConflicts.map((conflict) => (
              <div
                key={conflict.employeeCode}
                className={cn(
                  "grid gap-3 px-3 py-4 sm:px-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center",
                  conflict.resolution && "bg-emerald-50/35",
                )}
              >
                <div className="grid min-w-0 gap-3 sm:grid-cols-[100px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                  <div>
                    <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-800">
                      Mã {conflict.employeeCode}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-500">
                      Hệ thống
                    </div>
                    <div className="mt-0.5 break-words text-sm font-semibold text-slate-900">
                      {conflict.existingEmployee.name}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-500">
                      File import
                    </div>
                    <div className="mt-0.5 break-words text-sm font-semibold text-slate-900">
                      {conflict.importedName}
                    </div>
                  </div>
                </div>

                <div
                  role="group"
                  aria-label={`Xác nhận nhân viên mã ${conflict.employeeCode}`}
                  className="grid grid-cols-2 gap-1 rounded-[3px] bg-slate-100 p-1"
                >
                  <button
                    type="button"
                    aria-pressed={conflict.resolution === "same_employee"}
                    className={cn(
                      "inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[3px] text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1",
                      conflict.resolution === "same_employee"
                        ? "bg-emerald-700 text-white shadow-sm hover:bg-emerald-800"
                        : "text-slate-700 hover:bg-white hover:text-slate-950",
                    )}
                    onClick={() =>
                      handleConflictResolutionChange(
                        conflict.employeeCode,
                        "same_employee",
                      )
                    }
                    aria-label="Xác nhận đây là cùng một nhân viên"
                  >
                    <UserCheck className="h-4 w-4 shrink-0" />
                    Cùng người
                  </button>
                  <button
                    type="button"
                    aria-pressed={conflict.resolution === "new_employee"}
                    className={cn(
                      "inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-[3px] border border-emerald-700 bg-emerald-700 px-3 text-xs font-semibold text-[#F6C85F] transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:border-[#F6C85F] hover:bg-[#F6C85F] hover:text-emerald-900 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-1",
                      conflict.resolution === "new_employee" &&
                        "ring-2 ring-[#F6C85F]/40",
                    )}
                    onClick={() =>
                      handleConflictResolutionChange(
                        conflict.employeeCode,
                        "new_employee",
                      )
                    }
                    aria-label="Tạo nhân viên mới và dùng lại mã này"
                  >
                    <UserPlus className="h-4 w-4 shrink-0" />
                    Người mới
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {summaryData.length > 0 ? (
        <section
          className="overflow-hidden rounded-[2px] border border-slate-200 bg-white"
          aria-labelledby="timesheet-results-title"
        >
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2
                id="timesheet-results-title"
                className="text-base font-semibold text-slate-950"
              >
                Kết quả tính lương
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                {filteredData.length}/{summaryData.length} nhân viên theo bộ lọc
                hiện tại.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="h-10 gap-2 rounded-[2px] border-slate-300 bg-white text-slate-700 shadow-none"
              >
                <Download className="h-4 w-4" />
                Xuất Excel
              </Button>
              <Button
                onClick={handleSaveToDB}
                disabled={loading || unresolvedImportConflicts.length > 0}
                className="
                  h-10 gap-2 rounded-[2px]
                  bg-emerald-700 px-4
                  font-semibold text-white
                  shadow-[0_2px_6px_rgba(4,120,87,0.22)]
                  transition-[background-color,box-shadow,transform]
                  duration-200 ease-out

                  hover:bg-emerald-800
                  hover:text-white
                  hover:shadow-[0_4px_10px_rgba(4,120,87,0.28)]

                  active:scale-[0.96]

                  disabled:cursor-not-allowed
                  disabled:bg-slate-200
                  disabled:text-slate-400
                  disabled:shadow-none
                  disabled:opacity-100
                "
              >
                <Database className="h-4 w-4" />
                Lưu DB
              </Button>
              {savedPayrollId ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(
                      "/payroll?openPayroll=" +
                        encodeURIComponent(savedPayrollId),
                    )
                  }
                  className="h-10 gap-2 border-sky-200 bg-sky-50 text-sky-700 shadow-none hover:bg-sky-100"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mở bảng lương vừa lưu
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 sm:grid-cols-4 sm:divide-y-0">
            <div className="px-4 py-3">
              <div className="text-xs font-medium text-slate-500">
                Nhân viên
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                {summaryData.length}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs font-medium text-slate-500">Tổng giờ</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
                {timesheetTotals.hours.toLocaleString("vi-VN", {
                  maximumFractionDigits: 2,
                })}
                h
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs font-medium text-slate-500">
                Cần kiểm tra
              </div>
              <div
                className={cn(
                  "mt-1 text-xl font-semibold tabular-nums",
                  timesheetTotals.errors > 0
                    ? "text-rose-700"
                    : "text-emerald-700",
                )}
              >
                {timesheetTotals.errors}
              </div>
            </div>
            <div className="px-4 py-3">
              <div className="text-xs font-medium text-slate-500">
                Tổng lương
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">
                {timesheetTotals.salary.toLocaleString("vi-VN")} đ
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_220px_220px_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white pl-10 pr-10 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="Tìm theo tên hoặc mã nhân viên"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Xóa từ khóa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <SelectBox<string>
                value={filterRole}
                options={roleFilterOptions}
                onValueChange={setFilterRole}
                ariaLabel="Lọc theo vai trò"
                className="w-full"
                triggerClassName="border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-white"
              />

              <SelectBox<TimesheetSort>
                value={sortValue}
                options={TIMESHEET_SORT_OPTIONS}
                onValueChange={handleSortChange}
                ariaLabel="Sắp xếp kết quả"
                className="w-full"
                triggerClassName="border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-white"
              />

              <Button
                variant={filterError ? "default" : "outline"}
                className={cn(
                  "h-10 gap-2 shadow-none",
                  filterError
                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    : "border-slate-300 bg-white text-slate-600",
                )}
                onClick={() => setFilterError((current) => !current)}
              >
                <AlertCircle className="h-4 w-4" />
                Có lỗi
                <span className="tabular-nums">({timesheetTotals.errors})</span>
              </Button>
            </div>
          </div>
          <div className="hidden max-h-[620px] overflow-auto md:block">
            <table className="w-full min-w-[1030px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-20 bg-slate-50 text-xs font-semibold text-slate-600">
                <tr className="border-b border-slate-200">
                  <th className="sticky left-0 z-30 w-[220px] min-w-[220px] bg-slate-50 px-4 py-3 shadow-[1px_0_0_0_rgba(226,232,240,1)]">
                    Nhân viên
                  </th>
                  <th className="w-[150px] px-3 py-3">Vai trò</th>
                  <th className="px-3 py-3 text-right">Tổng giờ</th>
                  <th className="px-3 py-3 text-right">Giờ cuối tuần</th>
                  <th className="px-3 py-3 text-right">Lương/giờ</th>
                  <th className="px-4 py-3 text-right text-emerald-700">
                    Tổng lương
                  </th>
                  <th className="w-[112px] px-3 py-3 text-center">Tác vụ</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((employee, index) => {
                  const hasError = employee.Errors.length > 0;
                  return (
                    <tr
                      key={employee.EnNo}
                      className={cn(
                        "group border-b border-slate-200 transition-colors",
                        hasError
                          ? "bg-rose-50/55 hover:bg-rose-50"
                          : "bg-white hover:bg-slate-50",
                      )}
                    >
                      <td
                        className={cn(
                          "sticky left-0 z-10 px-4 py-3 shadow-[1px_0_0_0_rgba(226,232,240,1)]",
                          hasError
                            ? "bg-rose-50/95"
                            : "bg-white group-hover:bg-slate-50",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => openShiftModal(index)}
                          className="block max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <span className="block truncate font-semibold text-slate-900 hover:text-primary">
                            {employee.Name}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-slate-500">
                            {employee.EnNo}
                          </span>
                        </button>
                        {hasError ? (
                          <span
                            className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700"
                            title={employee.Errors.join("\n")}
                          >
                            {employee.Errors.length} lỗi chấm công
                          </span>
                        ) : null}
                      </td>

                      <td className="px-3 py-3">
                        <SelectBox<string>
                          value={employee.Role || ""}
                          options={roleEditOptions}
                          onValueChange={(value) =>
                            handleRoleChange(employee.EnNo, value)
                          }
                          ariaLabel={"Vai trò của " + employee.Name}
                          className="w-[132px]"
                          triggerClassName="h-10 border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-white"
                        />
                      </td>

                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          onWheel={preventNumberInputScroll}
                          className="h-10 w-24 rounded-md border border-slate-300 bg-white px-3 text-right font-mono text-sm tabular-nums outline-none [appearance:textfield] focus:border-primary focus:ring-2 focus:ring-primary/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={employee.TotalHours}
                          onChange={(event) =>
                            handleHoursChange(
                              employee.EnNo,
                              "TotalHours",
                              event.target.value,
                            )
                          }
                          aria-label={"Tổng giờ của " + employee.Name}
                        />
                      </td>

                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          onWheel={preventNumberInputScroll}
                          className="h-10 w-24 rounded-md border border-slate-300 bg-white px-3 text-right font-mono text-sm tabular-nums text-sky-700 outline-none [appearance:textfield] focus:border-sky-500 focus:ring-2 focus:ring-sky-100 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={employee.WeekendHours}
                          onChange={(event) =>
                            handleHoursChange(
                              employee.EnNo,
                              "WeekendHours",
                              event.target.value,
                            )
                          }
                          aria-label={"Giờ cuối tuần của " + employee.Name}
                        />
                      </td>

                      <td className="px-3 py-3 text-right">
                        <input
                          type="number"
                          onWheel={preventNumberInputScroll}
                          className="h-10 w-28 rounded-md border border-slate-300 bg-white px-3 text-right text-sm tabular-nums outline-none [appearance:textfield] focus:border-primary focus:ring-2 focus:ring-primary/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={employee.SalaryPerHour || ""}
                          onChange={(event) =>
                            handleSalaryChange(
                              employee.EnNo,
                              event.target.value,
                            )
                          }
                          aria-label={"Lương mỗi giờ của " + employee.Name}
                        />
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSalaryDetailEmployee(employee)}
                          className="font-semibold tabular-nums text-emerald-700 hover:text-emerald-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                          title="Xem chi tiết cách tính lương"
                        >
                          {employee.TotalSalary.toLocaleString("vi-VN")} đ
                        </button>
                      </td>

                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Tooltip content={`Sửa ca ${employee.Name}`}>
                            <button
                              type="button"
                              onClick={() => openShiftModal(index)}
                              className={cn(
                                "inline-flex h-10 w-10 items-center justify-center rounded-md border transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                                hasError
                                  ? "border-rose-300 bg-rose-100 text-rose-700 hover:border-rose-400 hover:bg-rose-200 focus-visible:ring-rose-500"
                                  : "border-slate-300 bg-white text-slate-700 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-emerald-500",
                              )}
                              aria-label={`Sửa ca ${employee.Name}`}
                            >
                              <CalendarClock className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <button
                            type="button"
                            onClick={() => handleRemoveEmployee(employee.EnNo)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            title="Xóa nhân viên này"
                            aria-label={"Xóa " + employee.Name}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-20 border-t border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <tr>
                  <td
                    colSpan={2}
                    className="sticky left-0 bg-slate-50 px-4 py-3 shadow-[1px_0_0_0_rgba(226,232,240,1)]"
                  >
                    Tổng cộng
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {filteredData
                      .reduce((sum, employee) => sum + employee.TotalHours, 0)
                      .toLocaleString("vi-VN", {
                        maximumFractionDigits: 2,
                      })}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-sky-700">
                    {filteredData
                      .reduce((sum, employee) => sum + employee.WeekendHours, 0)
                      .toLocaleString("vi-VN", {
                        maximumFractionDigits: 2,
                      })}
                  </td>
                  <td />
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                    {filteredData
                      .reduce((sum, employee) => sum + employee.TotalSalary, 0)
                      .toLocaleString("vi-VN")}{" "}
                    đ
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="divide-y divide-slate-200 md:hidden">
            {filteredData.map((employee, index) => {
              const hasError = employee.Errors.length > 0;
              return (
                <details
                  key={employee.EnNo}
                  className={cn(
                    "group",
                    hasError ? "bg-rose-50/45" : "bg-white",
                  )}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary">
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        hasError
                          ? "bg-rose-100 text-rose-700"
                          : "bg-primary/10 text-primary",
                      )}
                    >
                      {employee.Name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {employee.Name}
                      </span>
                      <span className="mt-0.5 block font-mono text-xs text-slate-500">
                        {employee.EnNo} · {employee.TotalHours}h
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-semibold tabular-nums text-emerald-700">
                        {employee.TotalSalary.toLocaleString("vi-VN")} đ
                      </span>
                      {hasError ? (
                        <span className="mt-0.5 block text-xs font-medium text-rose-700">
                          {employee.Errors.length} lỗi
                        </span>
                      ) : null}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
                  </summary>

                  <div className="border-t border-slate-200 px-4 py-4">
                    <button
                      type="button"
                      onClick={() => openShiftModal(index)}
                      className={cn(
                        "mb-4 flex h-11 w-full items-center justify-between rounded-md border px-3 text-left text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
                        hasError
                          ? "border-rose-300 bg-rose-100 text-rose-700 hover:bg-rose-200 focus-visible:ring-rose-500"
                          : "border-slate-300 bg-white text-slate-800 hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:ring-emerald-500",
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Sửa ca
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium opacity-75">
                        {employee.Shifts.length} ca
                        <ChevronRight className="h-4 w-4" />
                      </span>
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="col-span-2 space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">
                          Vai trò
                        </span>
                        <SelectBox<string>
                          value={employee.Role || ""}
                          options={roleEditOptions}
                          onValueChange={(value) =>
                            handleRoleChange(employee.EnNo, value)
                          }
                          ariaLabel={"Vai trò của " + employee.Name}
                          className="w-full"
                          triggerClassName="border-slate-300 bg-white"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">
                          Tổng giờ
                        </span>
                        <input
                          type="number"
                          onWheel={preventNumberInputScroll}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-right font-mono text-sm outline-none [appearance:textfield] focus:border-primary focus:ring-2 focus:ring-primary/15"
                          value={employee.TotalHours}
                          onChange={(event) =>
                            handleHoursChange(
                              employee.EnNo,
                              "TotalHours",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">
                          Giờ cuối tuần
                        </span>
                        <input
                          type="number"
                          onWheel={preventNumberInputScroll}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-right font-mono text-sm text-sky-700 outline-none [appearance:textfield] focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          value={employee.WeekendHours}
                          onChange={(event) =>
                            handleHoursChange(
                              employee.EnNo,
                              "WeekendHours",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label className="col-span-2 space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">
                          Lương/giờ
                        </span>
                        <input
                          type="number"
                          onWheel={preventNumberInputScroll}
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-right text-sm outline-none [appearance:textfield] focus:border-primary focus:ring-2 focus:ring-primary/15"
                          value={employee.SalaryPerHour || ""}
                          onChange={(event) =>
                            handleSalaryChange(
                              employee.EnNo,
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>

                    {hasError ? (
                      <div className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-800">
                        {employee.Errors.map((item, errorIndex) => (
                          <div key={employee.EnNo + "-" + errorIndex}>
                            {item}
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => setSalaryDetailEmployee(employee)}
                        className="text-sm font-semibold tabular-nums text-emerald-700 hover:underline"
                      >
                        {employee.TotalSalary.toLocaleString("vi-VN")} đ
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmployee(employee.EnNo)}
                        className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Xóa
                      </button>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>

          {filteredData.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Không có nhân viên phù hợp
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Thử đổi từ khóa hoặc bộ lọc vai trò.
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="border-y border-slate-200 py-14 text-center">
          <Clock3 className="mx-auto h-9 w-9 text-slate-300" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            Chưa có dữ liệu chấm công
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
            Chọn file và khoảng ngày phía trên để bắt đầu tính giờ làm.
          </p>
        </section>
      )}
      {salaryDetailEmployee && salaryDetailBreakdown ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setSalaryDetailEmployee(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Chi tiết lương: {salaryDetailEmployee.Name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {salaryDetailEmployee.EnNo} •{" "}
                  {salaryDetailEmployee.Role || "Nhân viên"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSalaryDetailEmployee(null)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {salaryDetailBreakdown.baseSalary > 0 ? (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">
                    {salaryDetailBreakdown.salaryType === "monthly"
                      ? "Tiền lương cứng"
                      : "Tiền lương giờ"}
                  </span>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(salaryDetailBreakdown.baseSalary)}
                    </div>
                    {salaryDetailBreakdown.salaryType === "hourly" ? (
                      <div className="mt-1 text-xs text-slate-500">
                        ({formatHours(salaryDetailEmployee.TotalHours || 0)}h)
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {salaryDetailBreakdown.salaryType === "monthly" ? (
                salaryDetailBreakdown.overtimePay > 0 ? (
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <span className="text-slate-600">
                      Tiền OT
                      {salaryDetailBreakdown.overtimeHours > 0
                        ? ` (${salaryDetailBreakdown.overtimeHours.toLocaleString(
                            "vi-VN",
                            {
                              maximumFractionDigits: 2,
                            },
                          )}h x ${formatCurrency(salaryDetailBreakdown.overtimeRate)})`
                        : ""}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(salaryDetailBreakdown.overtimePay)}
                    </span>
                  </div>
                ) : null
              ) : salaryDetailBreakdown.weekendBonus > 0 ? (
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">Tiền cuối tuần</span>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(salaryDetailBreakdown.weekendBonus)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      ({formatHours(salaryDetailEmployee.WeekendHours || 0)}h)
                    </div>
                  </div>
                </div>
              ) : null}

              {salaryDetailBreakdown.allowanceTotal > 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Tiền trợ cấp</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(salaryDetailBreakdown.allowanceTotal)}
                    </span>
                  </div>
                  {salaryDetailEmployee.Allowance > 0 ? (
                    <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-sm text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>+ Trợ cấp</span>
                        <span>
                          {formatCurrency(salaryDetailEmployee.Allowance)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {salaryDetailBreakdown.attendanceBonus > 0 ? (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                  <span className="text-emerald-700">Thưởng chuyên cần</span>
                  <div className="text-right">
                    <div className="font-semibold text-emerald-800">
                      {formatCurrency(salaryDetailBreakdown.attendanceBonus)}
                    </div>
                    {salaryDetailAttendanceProgress ? (
                      <div className="mt-1 text-xs text-emerald-600/80">
                        {salaryDetailAttendanceProgress.qualifiedDays}/
                        {salaryDetailAttendanceProgress.targetDays} ngày
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {salaryDetailBreakdown.deduction > 0 ? (
                <div className="flex items-center justify-between rounded-xl bg-rose-50 px-4 py-3">
                  <span className="text-rose-700">Khấu trừ nghỉ vượt phép</span>
                  <div className="text-right">
                    <div className="font-semibold text-rose-800">
                      - {formatCurrency(salaryDetailBreakdown.deduction)}
                    </div>
                    <div className="mt-1 text-xs text-rose-700/80">
                      {salaryDetailBreakdown.unpaidLeaveDays} ngày
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-4">
              <span className="text-base font-semibold text-slate-700">
                Tổng
              </span>
              <span className="text-xl font-bold text-sky-700">
                {formatCurrency(salaryDetailEmployee.TotalSalary)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {selectedEmpIndex !== null && summaryData[selectedEmpIndex] ? (
        <ShiftDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveShifts}
          employeeName={summaryData[selectedEmpIndex].Name}
          employeeId={summaryData[selectedEmpIndex].EnNo}
          initialShifts={summaryData[selectedEmpIndex].Shifts || []}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(employeePendingRemoval)}
        title="Xóa khỏi danh sách?"
        description={
          <>
            <span className="font-medium text-slate-900">
              {employeePendingRemoval?.Name}
            </span>{" "}
            sẽ bị xóa khỏi báo cáo chấm công hiện tại. Dữ liệu nhân viên trong
            hệ thống không bị ảnh hưởng.
          </>
        }
        confirmLabel="Xóa nhân viên"
        variant="destructive"
        icon={null}
        onCancel={() => setEmployeePendingRemoval(null)}
        onConfirm={confirmRemoveEmployee}
      />

      <Toast
        open={Boolean(successMessage)}
        variant="success"
        title="Thành công"
        description={successMessage}
        onDismiss={() => setSuccessMessage("")}
      />
    </div>
  );
}
