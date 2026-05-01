"use client";

import React, { useMemo, useState } from "react";
import ShiftDetailModal, { Shift } from "./ShiftDetailModal";
import { Button } from "@/components/ui/Button";
import { preventNumberInputScroll } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import * as XLSX from "xlsx";
import {
  Save,
  FileText,
  Calculator,
  ArrowLeft,
  Search,
  Trash2,
  X,
  ArrowUpDown,
  AlertCircle,
} from "lucide-react";
import { getEmployees, Employee } from "@/services/employees.firebase";
import { saveImportedPayroll, type PayrollEntry } from "@/services/payrolls.firebase";
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
      employee.Allowance > 0 ? [{ name: "Phá»¥ cáº¥p", amount: employee.Allowance }] : [],
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
        employee.Allowance > 0 ? [{ name: "Phụ cấp", amount: employee.Allowance }] : [],
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
  const [mode, setMode] = useState<'month' | 'custom'>('custom');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
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
  const [sortConfig, setSortConfig] = useState<{
    key: keyof EmployeeSummary | "Name" | "Role" | "TotalHours" | "TotalSalary";
    direction: "asc" | "desc" | null;
  }>({ key: "Name", direction: "asc" });
  const [hoveredError, setHoveredError] = useState<{
    x: number;
    y: number;
    errors: string[];
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmpIndex, setSelectedEmpIndex] = useState<number | null>(null);
  const [dbEmployees, setDbEmployees] = useState<Employee[]>([]);
  const [savedPayrollId, setSavedPayrollId] = useState("");
  const [salaryDetailEmployee, setSalaryDetailEmployee] = useState<EmployeeSummary | null>(null);

  const { storeId } = useStore();
  const roleGroups = getRoleGroupsForStore(storeId);
  const defaultRole = getDefaultRoleForStore(storeId);
  const router = useRouter();

  const formatLocalDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`;
  };

  const formatLocalMonth = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const isMonthlyEmployee = (employee?: Employee) => {
    return employee?.salaryType === "monthly" || (employee?.monthlySalary || 0) > 0;
  };

  const buildEmployeeRowsMap = (rows: TimesheetRow[]) => {
    const grouped: Record<string, TimesheetRow[]> = {};

    rows.forEach((row) => {
      const employeeCode = row.EnNo?.trim() || `unknown_${row.Name || "employee"}`;
      if (!grouped[employeeCode]) grouped[employeeCode] = [];
      grouped[employeeCode].push(row);
    });

    return grouped;
  };

  const summarizeRows = (employeeCode: string, rows: TimesheetRow[]) => {
    const sortedRows = [...rows].sort(
      (left, right) => new Date(left.DateTime).getTime() - new Date(right.DateTime).getTime()
    );
    const displayName =
      sortedRows.find((row) => row.Name?.trim())?.Name?.trim() || `Unknown_${employeeCode}`;

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
        employee.Allowance > 0 ? [{ name: "Phụ cấp", amount: employee.Allowance }] : [],
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
            : "Không tải được danh sách nhân viên từ API."
        );
      });
  }, [storeId]);

  React.useEffect(() => {
    if (mode === 'month' && selectedMonth) {
      const [year, month] = selectedMonth.split('-').map(Number);
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
        let valA: string | number = a[sortConfig.key as keyof EmployeeSummary] as string | number;
        let valB: string | number = b[sortConfig.key as keyof EmployeeSummary] as string | number;

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA < valB) return -1 * direction;
        if (valA > valB) return 1 * direction;
        return 0;
      });
  }, [summaryData, searchTerm, filterRole, filterError, sortConfig]);

  const handleSort = (key: "Name" | "TotalHours" | "TotalSalary") => {
    let direction: "asc" | "desc" | null = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
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
    value: string
  ) => {
    setSummaryData((current) =>
      current.map((employee) => {
        if (employee.EnNo !== enNo) return employee;
        const nextValue = Number.parseFloat(value) || 0;
        const nextEmployee = { ...employee, [field]: nextValue } as EmployeeSummary;
        nextEmployee.TotalSalary = calculateEmployeeTotal(nextEmployee);
        return nextEmployee;
      })
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
              return !Number.isNaN(date.getTime()) && date >= monthStart && date <= end;
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
      for (const employeeCode of employeeCodes) {
        const matchedDbEmployee = dbEmployees.find(
          (employee) => employee.employeeCode?.trim() === employeeCode
        );
        const useMonthlySalary =
          mode === "month" && selectedPeriod === 2 && isMonthlyEmployee(matchedDbEmployee);

        if (mode === "month" && selectedPeriod === 1 && isMonthlyEmployee(matchedDbEmployee)) {
          continue;
        }

        const sourceRows = useMonthlySalary
          ? monthlyRowsByEmployee[employeeCode] || []
          : selectedRowsByEmployee[employeeCode] || [];

        if (sourceRows.length === 0 && !useMonthlySalary) {
          continue;
        }

        const { displayName, totalHours, weekendHours, errors, shifts } = summarizeRows(
          employeeCode,
          sourceRows
        );

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
          Name: matchedDbEmployee?.name || displayName,
          EnNo: employeeCode,
          Role: matchedDbEmployee?.role || "",
          SalaryType: useMonthlySalary ? "monthly" : "hourly",
          Allowance: 0,
          Note: "",
          TotalHours: totalHours,
          WeekendHours: weekendHours,
          SalaryPerHour: matchedDbEmployee?.hourlyRate || 15000,
          MonthlySalary: matchedDbEmployee?.monthlySalary || 0,
          ExpectedWorkDays: matchedDbEmployee?.expectedWorkDays || 30,
          PaidLeaveDays: matchedDbEmployee?.paidLeaveDays || 0,
          AttendanceBonusEnabled: matchedDbEmployee?.attendanceBonusEnabled || false,
          AttendanceBonusDays: matchedDbEmployee?.attendanceBonusDays || 0,
          AttendanceBonusAmount: matchedDbEmployee?.attendanceBonusAmount || 0,
          StandardHours: matchedDbEmployee?.standardHours || 0,
          TotalSalary: 0,
          Errors: errors,
          Shifts: shifts,
        };

        summary.TotalSalary = calculateEmployeeTotal(summary);

        summaries.push(summary);
      }

      summaries.sort((left, right) => (left.Role || "").localeCompare(right.Role || ""));
      setSummaryData(summaries);
    } catch (err) {
      console.error(err);
      setError("Có lỗi xảy ra khi xử lý file.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveEmployee = (empNo: string) => {
    if (!confirm("Bạn có chắc muốn xóa nhân viên này khỏi báo cáo?")) return;
    setSummaryData((current) => current.filter((item) => item.EnNo !== empNo));
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
      })
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
            if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
              if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
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
      })
    );
  };

  const handleRoleChange = (enNo: string, value: string) => {
    setSummaryData((current) =>
      current.map((employee) =>
        employee.EnNo === enNo ? { ...employee, Role: value } : employee
      )
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
      })
    );
  };

  const handleNoteChange = (enNo: string, value: string) => {
    setSummaryData((current) =>
      current.map((employee) =>
        employee.EnNo === enNo ? { ...employee, Note: value } : employee
      )
    );
  };

  const handleSaveToDB = async () => {
    if (!storeId) return;
    if (summaryData.length === 0) {
      setError("Chưa có dữ liệu để lưu.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const payrollName = mode === 'month' 
        ? `Bảng lương tháng ${new Date(selectedMonth + '-01').toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' })} - Đợt ${selectedPeriod}`
        : `Bảng lương ${startDate} - ${endDate}`;
      
      const payrollId = await saveImportedPayroll({
        storeId,
        name: payrollName,
        startDate,
        endDate,
        entries: summaryData.map((employee) => {
          const matchedDbEmployee = dbEmployees.find(
            (emp) => emp.employeeCode?.trim() === employee.EnNo
          );
          const isFullTime = isMonthlyEmployee(matchedDbEmployee);
          const salaryType = (mode === 'month' && selectedPeriod === 2 && isFullTime) ? 'monthly' : 'hourly';
          
          return {
            employeeId: employee.dbId || `manual_${employee.EnNo || Date.now()}`,
            employeeCode: employee.EnNo,
            employeeName: employee.Name,
            role: employee.Role || defaultRole,
            hourlyRate: employee.SalaryPerHour,
            totalHours: employee.TotalHours,
            weekendHours: employee.WeekendHours,
            salary: employee.TotalSalary,
            allowances: employee.Allowance > 0 ? [{ name: "Phụ cấp", amount: employee.Allowance }] : [],
            note: employee.Note,
            salaryType,
            monthlySalary: salaryType === "monthly" ? employee.MonthlySalary : 0,
            fixedSalary: salaryType === 'monthly' ? employee.MonthlySalary : 0,
            expectedWorkDays: salaryType === "monthly" ? employee.ExpectedWorkDays : 0,
            paidLeaveDays: salaryType === "monthly" ? employee.PaidLeaveDays : 0,
            attendanceBonusEnabled: salaryType === "monthly" ? employee.AttendanceBonusEnabled : false,
            attendanceBonusDays: salaryType === "monthly" ? employee.AttendanceBonusDays : 0,
            attendanceBonusAmount: salaryType === "monthly" ? employee.AttendanceBonusAmount : 0,
            standardHours: salaryType === "monthly" ? employee.StandardHours : 0,
            shifts: employee.Shifts,
          };
        }) as Array<Partial<PayrollEntry>>,
      });

      setSavedPayrollId(payrollId);
      setDbEmployees(await getEmployees(storeId));
      alert("Đã lưu bảng lương vào MySQL thành công!");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Lỗi khi lưu vào MySQL");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push("/payroll");
  };

  const openShiftModal = (index: number) => {
    const employee = filteredData[index];
    const realIndex = summaryData.findIndex((item) => item.EnNo === employee.EnNo);
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
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "BangLuong");
    XLSX.writeFile(workbook, "BangLuong.xlsx");
  };

  const salaryDetailBreakdown = salaryDetailEmployee
    ? getEmployeeBreakdown(salaryDetailEmployee)
    : null;
  const salaryDetailAttendanceProgress = salaryDetailEmployee
    ? getAttendanceBonusProgress(buildPayrollEntryFromSummary(salaryDetailEmployee))
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5 text-slate-500" />
          </Button>
          <h1 className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold text-transparent">
            Tính Lương & Giờ Làm (Import)
          </h1>
        </div>
      </div>

      <Card className="grid grid-cols-1 items-end gap-4 border-t border-white/20 bg-white/50 p-6 shadow-xl backdrop-blur-sm md:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">File Chấm Công (TXT)</label>
          <div className="relative">
            <input
              type="file"
              accept=".txt,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className={`flex items-center gap-2 rounded-md border border-gray-300 p-2 ${
                file ? "bg-blue-50 text-blue-700" : "bg-white text-gray-500"
              }`}
            >
              <FileText size={18} />
              <span className="truncate">{file ? file.name : "Chọn file..."}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Chọn thời gian</label>
          <div className="space-y-2">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="month"
                  checked={mode === 'month'}
                  onChange={(e) => setMode(e.target.value as 'month')}
                />
                Tháng
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="mode"
                  value="custom"
                  checked={mode === 'custom'}
                  onChange={(e) => setMode(e.target.value as 'custom')}
                />
                Tuỳ chọn
              </label>
            </div>
            {mode === 'month' ? (
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Chọn tháng</option>
                  {Array.from({ length: 12 }, (_, i) => {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    const value = formatLocalMonth(date);
                    const label = date.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long' });
                    return <option key={value} value={value}>{label}</option>;
                  })}
                </select>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(Number(e.target.value) as 1 | 2)}
                  className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value={1}>Đợt 1</option>
                  <option value={2}>Đợt 2</option>
                </select>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  placeholder="Từ ngày"
                  className="flex-1"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  placeholder="Đến ngày"
                  className="flex-1"
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Thời gian đã chọn</label>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-sm text-gray-600">
            {startDate && endDate ? `${startDate} đến ${endDate}` : 'Chưa chọn'}
          </div>
        </div>

        <Button
          onClick={processData}
          disabled={loading || !file || !startDate || !endDate}
          className="bg-indigo-600 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-105 hover:bg-indigo-700"
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

      {error ? (
        <div className="rounded-md border border-red-100 bg-red-50 p-4 text-red-600">{error}</div>
      ) : null}

      {summaryData.length > 0 ? (
        <Card className="animate-in slide-in-from-bottom-4 border-t border-white/20 p-6 shadow-xl fade-in">
          <div className="mb-4 flex flex-col items-center justify-between gap-4 md:flex-row">
            <h2 className="text-xl font-semibold text-gray-800">Kết Quả Tính Lương</h2>
            <div className="flex w-full items-center gap-2 md:w-auto">
              <div className="relative w-full md:w-64">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search size={16} className="text-gray-500" />
                </div>
                <input
                  type="text"
                  className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm leading-5 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Tìm tên hoặc mã NV..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                {searchTerm ? (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>

              <select
                className="h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={filterRole}
                onChange={(event) => setFilterRole(event.target.value)}
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
                className={`h-9 gap-2 ${
                  filterError
                    ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    : "text-gray-600"
                }`}
                onClick={() => setFilterError((current) => !current)}
                title="Chỉ hiện nhân viên có lỗi hoặc thiếu giờ"
              >
                <AlertCircle size={16} />
                <span className="hidden sm:inline">Lỗi</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 text-gray-600"
                onClick={() => handleSort("Name")}
                title="Sắp xếp theo tên"
              >
                <ArrowUpDown size={16} />
              </Button>

              <Button
                variant="outline"
                onClick={exportToCSV}
                className="h-9 shrink-0 border-green-600 text-green-700 hover:bg-green-50"
              >
                <Save className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button
                onClick={handleSaveToDB}
                className="h-9 shrink-0 bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700"
              >
                <Save className="mr-2 h-4 w-4" /> Lưu DB
              </Button>
              {savedPayrollId ? (
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(`/payroll?openPayroll=${encodeURIComponent(
                      savedPayrollId
                    )}`)
                  }
                  className="h-9 shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                >
                  <Calculator className="mr-2 h-4 w-4" /> Mở bảng lương vừa lưu
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="relative max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b bg-gray-50 text-xs uppercase text-gray-700 shadow-sm">
                  <tr>
                    <th className="bg-gray-50 px-6 py-3">Mã NV</th>
                    <th className="bg-gray-50 px-6 py-3">Tên Nhân Viên</th>
                    <th className="bg-gray-50 px-6 py-3">Vai Trò</th>
                    <th className="bg-gray-50 px-6 py-3 text-right">Tổng Giờ Làm</th>
                    <th className="bg-gray-50 px-6 py-3 text-right text-indigo-600">Giờ Cuối Tuần</th>
                    <th className="bg-gray-50 px-6 py-3 text-right">Lương/Giờ</th>
                    <th className="bg-gray-50 px-6 py-3 text-right font-bold text-green-700">Tổng Lương</th>
                    <th className="bg-gray-50 px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((employee, index) => (
                    <tr key={employee.EnNo} className="border-b bg-white transition-colors hover:bg-gray-50">
                      <td className="flex items-center px-6 py-4 font-medium">
                        <span
                          className="cursor-pointer hover:text-blue-600 hover:underline"
                          onClick={() => openShiftModal(index)}
                        >
                          {employee.EnNo}
                        </span>
                        {employee.Errors.length > 0 ? (
                          <span
                            className="ml-2 cursor-pointer rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-500 animate-pulse"
                            onClick={(event) => {
                              event.stopPropagation();
                              openShiftModal(index);
                            }}
                            onMouseEnter={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setHoveredError({
                                x: rect.left + window.scrollX + 20,
                                y: rect.top + window.scrollY,
                                errors: employee.Errors,
                              });
                            }}
                            onMouseLeave={() => setHoveredError(null)}
                          >
                            !
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <span className="cursor-pointer hover:text-blue-600" onClick={() => openShiftModal(index)}>
                          {employee.Name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="w-full rounded border bg-white p-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={employee.Role || ""}
                          onChange={(event) => handleRoleChange(employee.EnNo, event.target.value)}
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
                          onWheel={preventNumberInputScroll}
                          className="w-20 rounded border p-1 text-right font-mono [appearance:textfield] focus:ring-2 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={employee.TotalHours}
                          onChange={(event) => handleHoursChange(employee.EnNo, "TotalHours", event.target.value)}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          onWheel={preventNumberInputScroll}
                          className="w-20 rounded border p-1 text-right font-mono text-indigo-600 [appearance:textfield] focus:ring-2 focus:ring-indigo-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={employee.WeekendHours}
                          onChange={(event) => handleHoursChange(employee.EnNo, "WeekendHours", event.target.value)}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <input
                          type="number"
                          onWheel={preventNumberInputScroll}
                          className="w-full rounded border p-1 text-right [appearance:textfield] focus:outline-none focus:ring-2 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          placeholder="0"
                          value={employee.SalaryPerHour || ""}
                          onChange={(event) => handleSalaryChange(employee.EnNo, event.target.value)}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSalaryDetailEmployee(employee)}
                          className="font-mono font-bold text-green-700 transition hover:text-green-800 hover:underline"
                          title="Xem chi tiết cách tính lương"
                        >
                          {employee.TotalSalary.toLocaleString("vi-VN")} đ
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleRemoveEmployee(employee.EnNo)}
                          className="p-1 text-gray-400 transition-colors hover:text-red-600"
                          title="Xóa nhân viên này"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 z-10 border-t-2 border-indigo-100 bg-indigo-50 font-bold text-gray-900 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                  <tr className="text-base">
                    <td colSpan={3} className="px-6 py-4 text-center uppercase tracking-wider text-indigo-800">
                      Tổng Cộng
                    </td>
                    <td className="px-6 py-4 text-right">
                      {filteredData
                        .reduce((sum, employee) => sum + employee.TotalHours, 0)
                        .toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-right text-indigo-700">
                      {filteredData
                        .reduce((sum, employee) => sum + employee.WeekendHours, 0)
                        .toLocaleString("vi-VN", { maximumFractionDigits: 2 })}
                    </td>
                    <td className="bg-transparent" />
                    <td className="px-6 py-4 text-right text-lg text-green-700">
                      {filteredData
                        .reduce((sum, employee) => sum + employee.TotalSalary, 0)
                        .toLocaleString("vi-VN")} ?
                    </td>
                    <td className="bg-transparent" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </Card>
      ) : null}

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
                  {salaryDetailEmployee.EnNo} • {salaryDetailEmployee.Role || "Nhân viên"}
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
                      ? ` (${salaryDetailBreakdown.overtimeHours.toLocaleString("vi-VN", {
                          maximumFractionDigits: 2,
                        })}h x ${formatCurrency(salaryDetailBreakdown.overtimeRate)})`
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
                      <span>{formatCurrency(salaryDetailEmployee.Allowance)}</span>
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
              <span className="text-base font-semibold text-slate-700">Tổng</span>
              <span className="text-xl font-bold text-sky-700">
                {formatCurrency(salaryDetailEmployee.TotalSalary)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {hoveredError ? (
        <div
          className="fixed z-[9999] max-w-xs rounded bg-gray-800 p-3 text-xs text-white shadow-lg pointer-events-none"
          style={{
            left: hoveredError.x,
            top: hoveredError.y,
            transform: "translateY(-50%)",
          }}
        >
          <p className="mb-1 border-b border-gray-600 pb-1 font-bold text-red-200">Cảnh báo thiếu cặp:</p>
          <div className="max-h-32 overflow-y-auto custom-scrollbar">
            {hoveredError.errors.map((item, index) => (
              <div key={`${item}-${index}`} className="mb-0.5">
                {item}
              </div>
            ))}
          </div>
          <div className="absolute right-full top-1/2 h-0 w-0 -translate-y-1/2 border-y-4 border-r-4 border-y-transparent border-r-gray-800" />
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
    </div>
  );
}
