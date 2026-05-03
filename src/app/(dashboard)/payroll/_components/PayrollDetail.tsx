"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { debounce } from "lodash";

import {
  addPayrollEntry,
  deletePayrollEntry,
  getPayrollEntries,
  PayrollEntry,
  updatePayrollEntry,
} from "@/services/payrolls.firebase";

import {
  addEmployee,
  Employee,
  getEmployees,
  updateEmployee,
} from "@/services/employees.firebase";

import { useStore } from "@/context/StoreContext";

import ShiftDetailModal, {
  Shift,
} from "@/app/(dashboard)/timesheet/ShiftDetailModal";

import InputMoney from "@/components/InputMoney";

import { Button } from "@/components/ui/Button";

import { Card, CardContent } from "@/components/ui/Card";

import { Input } from "@/components/ui/Input";

import { cn, preventNumberInputScroll } from "@/lib/utils";

import {
  AlertCircle,
  CalendarClock,
  Columns3,
  Loader2,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import {
  calculatePayrollSalary,
  formatCurrency,
  formatHours,
  getAllowanceTotal,
  getAttendanceBonusProgress,
  getAttendanceBonusValue,
  getDefaultRoleForStore,
  getPayrollBreakdown,
  getRoleGroupsForStore,
  normalizePayrollSalaryType,
  resolvePayrollSalaryType,
} from "./payrollShared";

import AddPayrollEntryDialog from "./AddPayrollEntryDialog";

import AllowanceDialog from "./AllowanceDialog";

import PayrollSettingsDialog from "./PayrollSettingsDialog";

type VisibleColumns = {
  name: boolean;

  role: boolean;

  hours: boolean;

  workDays: boolean;

  rate: boolean;

  weekend: boolean;

  allowance: boolean;

  total: boolean;

  note: boolean;

  action: boolean;
};

const DEFAULT_COLUMNS: VisibleColumns = {
  name: true,

  role: true,

  hours: true,

  workDays: true,

  rate: true,

  weekend: true,

  allowance: true,

  total: true,

  note: true,

  action: true,
};

const COLUMN_OPTIONS: { key: keyof VisibleColumns; label: string }[] = [
  { key: "name", label: "Nhân viên" },
  { key: "role", label: "Vai trò" },
  { key: "hours", label: "Giờ làm" },
  { key: "workDays", label: "Ngày công" },
  { key: "rate", label: "Đơn giá" },
  { key: "weekend", label: "Cuối tuần" },
  { key: "allowance", label: "Phụ cấp" },
  { key: "total", label: "Tổng lương" },
  { key: "note", label: "Ghi chú" },
  { key: "action", label: "Tác vụ" },
];

function RoleSelect({
  roleGroups,

  value,

  onChange,
}: {
  roleGroups: Record<string, string[]>;

  value: string;

  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
    >
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
  );
}
const hasInvalidShift = (entry: PayrollEntry) =>
  (entry.shifts || []).some(
    (shift) => !shift.isValid || !shift.inTime || !shift.outTime,
  );

const hasEntryError = (entry: PayrollEntry) => hasInvalidShift(entry);

const isEmployeeAlreadyInPayroll = (
  entry: PayrollEntry,
  employee: Employee,
) => {
  if (entry.employeeId && employee.id && entry.employeeId === employee.id)
    return true;

  const entryCode = (entry.employeeCode || "").trim().toLowerCase();
  const employeeCode = (employee.employeeCode || "").trim().toLowerCase();
  const entryLegacyCode = (entry.employeeId || "").trim().toLowerCase();

  if (entryCode && employeeCode && entryCode === employeeCode) return true;
  if (
    !entryCode &&
    entryLegacyCode &&
    employeeCode &&
    entryLegacyCode === employeeCode
  )
    return true;

  if (!entryCode && !employeeCode) {
    return (
      entry.employeeName.trim().toLowerCase() ===
      employee.name.trim().toLowerCase()
    );
  }
  return false;
};

const findLinkedEmployee = (entry: PayrollEntry, employees: Employee[]) => {
  if (entry.employeeId && !entry.employeeId.startsWith("manual_")) {
    const matchedById = employees.find(
      (employee) => employee.id === entry.employeeId,
    );
    if (matchedById) return matchedById;

    const legacyEmployeeCode = entry.employeeId.trim().toLowerCase();
    const matchedByLegacyCode = employees.find(
      (employee) =>
        (employee.employeeCode || "").trim().toLowerCase() ===
        legacyEmployeeCode,
    );
    if (matchedByLegacyCode) return matchedByLegacyCode;
  }

  const entryCode = (entry.employeeCode || "").trim().toLowerCase();
  if (entryCode) {
    const matchedByCode = employees.find(
      (employee) =>
        (employee.employeeCode || "").trim().toLowerCase() === entryCode,
    );
    if (matchedByCode) return matchedByCode;
  }

  const entryName = entry.employeeName.trim().toLowerCase();
  if (!entryName) return undefined;
  return employees.find(
    (employee) => employee.name.trim().toLowerCase() === entryName,
  );
};

const buildPayrollEntryPayload = (
  entry: PayrollEntry,
): Partial<PayrollEntry> => {
  const salaryType = resolvePayrollSalaryType(entry);
  const monthlySalary =
    salaryType === "monthly"
      ? entry.monthlySalary || entry.fixedSalary || 0
      : 0;

  return {
    employeeId: entry.employeeId,
    employeeCode: entry.employeeCode || "",
    employeeName: entry.employeeName,
    role: entry.role,
    hourlyRate: entry.hourlyRate || 0,
    hourlyMultiplier: entry.hourlyMultiplier ?? 1,
    totalHours: entry.totalHours || 0,
    weekendHours: entry.weekendHours || 0,
    salary: entry.salary || 0,
    allowances: entry.allowances || [],
    note: entry.note || "",
    salaryType,
    monthlySalary,
    fixedSalary: salaryType === "monthly" ? monthlySalary : 0,
    expectedWorkDays:
      salaryType === "monthly" ? entry.expectedWorkDays || 30 : 0,
    paidLeaveDays: salaryType === "monthly" ? entry.paidLeaveDays || 0 : 0,
    attendanceBonusEnabled: entry.attendanceBonusEnabled || false,
    attendanceBonusDays: entry.attendanceBonusDays || 0,
    attendanceBonusAmount: entry.attendanceBonusAmount || 0,
    standardHours: salaryType === "monthly" ? entry.standardHours || 0 : 0,
  };
};

const hasProfileAllowances = (employee?: Employee) =>
  Array.isArray(employee?.allowances) &&
  (employee?.allowances || []).some(
    (allowance) => (allowance?.amount || 0) > 0 || (allowance?.name || "").trim() !== "",
  );

const mergeEntryWithEmployeeProfile = (
  entry: PayrollEntry,
  employees: Employee[],
) => {
  const linkedEmployee = findLinkedEmployee(entry, employees);
  if (!linkedEmployee) return entry;

  const entrySalaryType = resolvePayrollSalaryType(entry);
  const employeeSalaryType = resolvePayrollSalaryType(
    linkedEmployee as Partial<PayrollEntry>,
  );
  const needsMonthlyProfileHydration =
    employeeSalaryType === "monthly" &&
    (entry.monthlySalary || entry.fixedSalary || 0) === 0 &&
    (entry.expectedWorkDays || 0) === 0 &&
    (entry.paidLeaveDays || 0) === 0 &&
    (entry.standardHours || 0) === 0 &&
    !entry.attendanceBonusEnabled &&
    (entry.attendanceBonusDays || 0) === 0 &&
    (entry.attendanceBonusAmount || 0) === 0;
  const needsAllowanceHydration =
    hasProfileAllowances(linkedEmployee) &&
    (!Array.isArray(entry.allowances) || entry.allowances.length === 0);
  const shouldUseEmployeeProfile =
    needsAllowanceHydration ||
    needsMonthlyProfileHydration ||
    (employeeSalaryType === "monthly" && entrySalaryType !== "monthly");

  if (!shouldUseEmployeeProfile) return entry;

  const nextEntry: PayrollEntry = {
    ...entry,
    employeeId: linkedEmployee.id || entry.employeeId,
    employeeCode: linkedEmployee.employeeCode || entry.employeeCode,
    salaryType: employeeSalaryType,
    monthlySalary: linkedEmployee.monthlySalary || 0,
    fixedSalary: linkedEmployee.monthlySalary || 0,
    expectedWorkDays:
      employeeSalaryType === "monthly"
        ? linkedEmployee.expectedWorkDays || 30
        : linkedEmployee.expectedWorkDays || 0,
    paidLeaveDays: linkedEmployee.paidLeaveDays || 0,
    attendanceBonusEnabled: linkedEmployee.attendanceBonusEnabled || false,
    attendanceBonusDays: linkedEmployee.attendanceBonusDays || 0,
    attendanceBonusAmount: linkedEmployee.attendanceBonusAmount || 0,
    standardHours: linkedEmployee.standardHours || 0,
    allowances:
      needsAllowanceHydration && linkedEmployee.allowances
        ? linkedEmployee.allowances.map((allowance) => ({
            name: allowance.name,
            amount: allowance.amount,
            period: allowance.period,
          }))
        : entry.allowances || [],
  };
  nextEntry.salary = calculatePayrollSalary(nextEntry);
  return nextEntry;
};

export default function PayrollDetail({
  payrollId,
  onBack,
  onEmployeesChanged,
}: {
  payrollId: string;
  onBack: () => void;
  onEmployeesChanged?: () => void;
}) {
  const { storeId } = useStore();

  const roleGroups = useMemo(() => getRoleGroupsForStore(storeId), [storeId]);

  const defaultRole = useMemo(() => getDefaultRoleForStore(storeId), [storeId]);

  const [entries, setEntries] = useState<PayrollEntry[]>([]);

  const [savedEmployees, setSavedEmployees] = useState<Employee[]>([]);

  const [loading, setLoading] = useState(true);

  const [savingId, setSavingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  const [filterRole, setFilterRole] = useState("All");

  const [sortBy, setSortBy] = useState("hours_desc");

  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_COLUMNS);

  const [showColumns, setShowColumns] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);

  const [currentShiftEntry, setCurrentShiftEntry] =
    useState<PayrollEntry | null>(null);

  const [shiftModalOpen, setShiftModalOpen] = useState(false);

  const [settingsEntryId, setSettingsEntryId] = useState<string | null>(null);

  const [settingsData, setSettingsData] = useState({
    salaryType: "hourly" as "hourly" | "monthly",
    monthlySalary: 0,
    expectedWorkDays: 30,
    paidLeaveDays: 0,
    standardHours: 0,
    overtimeRate: 0,
    hourlyMultiplier: 1,
  });
  const [batchHourlyMultiplier, setBatchHourlyMultiplier] = useState(1);
  const [isApplyingBatchMultiplier, setIsApplyingBatchMultiplier] =
    useState(false);

  const [allowanceEntryId, setAllowanceEntryId] = useState<string | null>(null);

  const [editAllowances, setEditAllowances] = useState<
    { name: string; amount: number }[]
  >([]);

  const [attendanceBonusEnabled, setAttendanceBonusEnabled] = useState(false);

  const [attendanceBonusDays, setAttendanceBonusDays] = useState(0);

  const [attendanceBonusAmount, setAttendanceBonusAmount] = useState(0);

  const [salaryDetailEntryId, setSalaryDetailEntryId] = useState<string | null>(
    null,
  );

  const entrySaveQueuesRef = useRef<Record<string, Promise<void>>>({});

  const [hasLoadedColumnPrefs, setHasLoadedColumnPrefs] = useState(false);

  const [filterError, setFilterError] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [payrollId]);

  useEffect(() => {
    if (storeId) loadSavedEmployees();
  }, [storeId]);
  useEffect(() => {
    if (savedEmployees.length === 0) return;
    setEntries((current) =>
      current.map((entry) => {
        const mergedEntry = mergeEntryWithEmployeeProfile(
          entry,
          savedEmployees,
        );
        return mergedEntry === entry ? entry : mergedEntry;
      }),
    );
  }, [savedEmployees]);

  useEffect(() => {
    const saved = localStorage.getItem("payroll_visible_columns_v2");

    if (saved) {
      try {
        setVisibleColumns({
          ...DEFAULT_COLUMNS,
          ...JSON.parse(saved),
        });
      } catch (error) {
        console.error(error);
      }
    }

    setHasLoadedColumnPrefs(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedColumnPrefs) return;

    localStorage.setItem(
      "payroll_visible_columns_v2",
      JSON.stringify(visibleColumns),
    );
  }, [visibleColumns, hasLoadedColumnPrefs]);

  function queueEntryPersist(
    nextEntry: PayrollEntry,
    changes: Partial<PayrollEntry>,
    employeeChanges?: Partial<Employee>,
  ) {
    if (!nextEntry.id) {
      return Promise.resolve();
    }

    const entryId = nextEntry.id;
    const previousTask =
      entrySaveQueuesRef.current[entryId] || Promise.resolve();
    const queuedTask = previousTask
      .catch(() => undefined)
      .then(() => persistEntryPatch(nextEntry, changes, employeeChanges));
    const trackedTask = queuedTask.finally(() => {
      if (entrySaveQueuesRef.current[entryId] === trackedTask) {
        delete entrySaveQueuesRef.current[entryId];
      }
    });

    entrySaveQueuesRef.current[entryId] = trackedTask;
    return trackedTask;
  }

  const debouncedUpdate = useCallback(
    debounce(
      async (nextEntry: PayrollEntry, employeeData?: Partial<Employee>) => {
        await queueEntryPersist(
          nextEntry,
          buildPayrollEntryPayload(nextEntry),
          employeeData,
        );
      },
      350,
    ),

    [savedEmployees, storeId],
  );

  useEffect(() => {
    const flushPendingUpdates = () => debouncedUpdate.flush();

    window.addEventListener("pagehide", flushPendingUpdates);

    window.addEventListener("beforeunload", flushPendingUpdates);

    return () => {
      window.removeEventListener("pagehide", flushPendingUpdates);

      window.removeEventListener("beforeunload", flushPendingUpdates);

      debouncedUpdate.flush();
    };
  }, [debouncedUpdate]);

  async function loadEntries() {
    setLoading(true);
    try {
      const loadedEntries = await getPayrollEntries(payrollId);
      const normalizedEntries = loadedEntries.map((entry) => {
        const normalizedEntry: PayrollEntry = {
          ...entry,
          salaryType: resolvePayrollSalaryType(entry),
          hourlyMultiplier: entry.hourlyMultiplier ?? 1,
          monthlySalary: entry.monthlySalary || entry.fixedSalary || 0,
          fixedSalary: entry.fixedSalary || entry.monthlySalary || 0,
        };
        normalizedEntry.salary = calculatePayrollSalary(normalizedEntry);
        return normalizedEntry;
      });
      setEntries(
        savedEmployees.length > 0
          ? normalizedEntries.map((entry) =>
              mergeEntryWithEmployeeProfile(entry, savedEmployees),
            )
          : normalizedEntries,
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedEmployees() {
    if (!storeId) return;
    setSavedEmployees(await getEmployees(storeId));
  }

  const availableEmployees = useMemo(
    () =>
      savedEmployees.filter(
        (employee) =>
          !entries.some((entry) => isEmployeeAlreadyInPayroll(entry, employee)),
      ),
    [entries, savedEmployees],
  );

  async function persistEntryPatch(
    nextEntry: PayrollEntry,
    changes: Partial<PayrollEntry>,
    employeeChanges?: Partial<Employee>,
  ) {
    if (!nextEntry.id) return;
    setSavingId(nextEntry.id);
    try {
      let latestEmployees = savedEmployees;
      let linkedEmployee = findLinkedEmployee(nextEntry, latestEmployees);

      if ((!linkedEmployee || latestEmployees.length === 0) && storeId) {
        latestEmployees = await getEmployees(storeId);
        setSavedEmployees(latestEmployees);
        linkedEmployee = findLinkedEmployee(nextEntry, latestEmployees);
      }

      const profileEmployeeId =
        linkedEmployee?.id ||
        (nextEntry.employeeId && !nextEntry.employeeId.startsWith("manual_")
          ? nextEntry.employeeId
          : "");
      const resolvedEmployeeId = profileEmployeeId || nextEntry.employeeId;
      const resolvedEmployeeCode =
        linkedEmployee?.employeeCode ||
        latestEmployees.find((employee) => employee.id === profileEmployeeId)
          ?.employeeCode ||
        nextEntry.employeeCode ||
        "";
      const resolvedSalaryType = resolvePayrollSalaryType(nextEntry);
      const persistedEntry: PayrollEntry = {
        ...nextEntry,
        employeeId: resolvedEmployeeId,
        employeeCode: resolvedEmployeeCode,
        salaryType: resolvedSalaryType,
        monthlySalary:
          resolvedSalaryType === "monthly"
            ? nextEntry.monthlySalary || nextEntry.fixedSalary || 0
            : 0,
        fixedSalary:
          resolvedSalaryType === "monthly"
            ? nextEntry.fixedSalary || nextEntry.monthlySalary || 0
            : 0,
        expectedWorkDays:
          resolvedSalaryType === "monthly"
            ? nextEntry.expectedWorkDays || 30
            : 0,
        paidLeaveDays:
          resolvedSalaryType === "monthly" ? nextEntry.paidLeaveDays || 0 : 0,
        standardHours:
          resolvedSalaryType === "monthly" ? nextEntry.standardHours || 0 : 0,
        hourlyMultiplier:
          resolvedSalaryType === "hourly" ? nextEntry.hourlyMultiplier ?? 1 : 1,
      };
      persistedEntry.salary = calculatePayrollSalary(persistedEntry);

      await updatePayrollEntry(
        nextEntry.id,
        buildPayrollEntryPayload(persistedEntry),
      );

      if (employeeChanges && profileEmployeeId) {
        const updatedEmployee = await updateEmployee(profileEmployeeId, {
          ...employeeChanges,
          storeId,
          employeeCode:
            resolvedEmployeeCode ||
            employeeChanges.employeeCode ||
            nextEntry.employeeCode ||
            "",
        });
        onEmployeesChanged?.();
        if (updatedEmployee?.id) {
          setSavedEmployees((current) =>
            current.map((employee) =>
              employee.id === profileEmployeeId ? updatedEmployee : employee,
            ),
          );
        } else {
          await loadSavedEmployees();
        }
      }

      if (
        resolvedEmployeeId !== nextEntry.employeeId ||
        resolvedEmployeeCode !== (nextEntry.employeeCode || "")
      ) {
        setEntries((current) =>
          current.map((entry) =>
            entry.id === nextEntry.id
              ? {
                  ...entry,
                  employeeId: resolvedEmployeeId,
                  employeeCode: resolvedEmployeeCode,
                }
              : entry,
          ),
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSavingId((current) => (current === nextEntry.id ? null : current));
    }
  }

  async function savePayrollSettings() {
    if (!settingsEntryId) return;
    const currentEntry = entries.find((entry) => entry.id === settingsEntryId);
    if (!currentEntry) return;

    const resolvedSalaryType = settingsData.salaryType;
    const resolvedExpectedWorkDays =
      resolvedSalaryType === "monthly"
        ? settingsData.expectedWorkDays || 30
        : 0;

    const nextEntry: PayrollEntry = {
      ...currentEntry,
      salaryType: resolvedSalaryType,
      monthlySalary:
        resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
      fixedSalary:
        resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
      paidLeaveDays:
        resolvedSalaryType === "monthly" ? settingsData.paidLeaveDays : 0,
      expectedWorkDays: resolvedExpectedWorkDays,
      standardHours:
        resolvedSalaryType === "monthly" ? settingsData.standardHours : 0,
      hourlyMultiplier:
        resolvedSalaryType === "hourly" ? settingsData.hourlyMultiplier : 1,
      hourlyRate:
        resolvedSalaryType === "monthly"
          ? settingsData.overtimeRate
          : currentEntry.hourlyRate,
    };
    nextEntry.salary = calculatePayrollSalary(nextEntry);

    setEntries((current) =>
      current.map((entry) =>
        entry.id === settingsEntryId ? nextEntry : entry,
      ),
    );
    debouncedUpdate.cancel();

    await queueEntryPersist(nextEntry, buildPayrollEntryPayload(nextEntry), {
      salaryType: resolvedSalaryType,
      monthlySalary:
        resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
      paidLeaveDays:
        resolvedSalaryType === "monthly" ? settingsData.paidLeaveDays : 0,
      expectedWorkDays: resolvedExpectedWorkDays,
      standardHours:
        resolvedSalaryType === "monthly" ? settingsData.standardHours : 0,
      hourlyRate:
        resolvedSalaryType === "monthly"
          ? settingsData.overtimeRate
          : currentEntry.hourlyRate,
    });

    setSettingsEntryId(null);
  }

  function applyEntryPatch(
    entryId: string,

    changes: Partial<PayrollEntry>,

    employeeChanges?: Partial<Employee>,

    options?: { immediate?: boolean },
  ) {
    const currentEntry = entries.find((entry) => entry.id === entryId);

    if (!currentEntry?.id) return;

    const nextEntry: PayrollEntry = {
      ...currentEntry,

      ...changes,

      salaryType: resolvePayrollSalaryType({ ...currentEntry, ...changes }),
    };

    nextEntry.salary = calculatePayrollSalary(nextEntry);

    setEntries((current) =>
      current.map((entry) => (entry.id === entryId ? nextEntry : entry)),
    );

    if (options?.immediate) {
      debouncedUpdate.cancel();

      void queueEntryPersist(nextEntry, changes, employeeChanges);

      return;
    }

    debouncedUpdate(
      nextEntry,

      employeeChanges,
    );
  }

  async function handleAddExistingEmployee(employee: Employee) {
    if (!employee.id) throw new Error("Không tìm thấy nhân viên đã lưu.");
    await addPayrollEntry(payrollId, {
      employeeId: employee.id,

      employeeCode: employee.employeeCode || "",

      employeeName: employee.name,

      role: employee.role || defaultRole,

      hourlyRate: employee.hourlyRate || 0,

      hourlyMultiplier: 1,

      totalHours: 0,

      weekendHours: 0,

      salary: 0,

      allowances: employee.allowances || [],

      note: "",

      salaryType: employee.salaryType || "hourly",

      monthlySalary: employee.monthlySalary || 0,

      expectedWorkDays:
        employee.salaryType === "monthly"
          ? employee.expectedWorkDays || 30
          : employee.expectedWorkDays || 0,

      paidLeaveDays: employee.paidLeaveDays || 0,

      attendanceBonusEnabled: employee.attendanceBonusEnabled || false,

      attendanceBonusDays: employee.attendanceBonusDays || 0,

      attendanceBonusAmount: employee.attendanceBonusAmount || 0,

      standardHours: employee.standardHours || 0,

      shifts: [],
    });

    await loadEntries();

    setShowAddDialog(false);
  }

  async function handleCreateEmployee(payload: {
    employeeCode: string;
    hourlyRate: number;
    name: string;
    role: string;
    salaryType: "hourly" | "monthly";
    monthlySalary: number;
    expectedWorkDays: number;
    paidLeaveDays: number;
    standardHours: number;
  }) {
    if (!storeId) throw new Error("Chưa chọn cửa hàng.");

    const normalizedCode = payload.employeeCode.trim().toLowerCase();

    if (
      savedEmployees.some(
        (employee) =>
          (employee.employeeCode || "").trim().toLowerCase() === normalizedCode,
      )
    ) {
      throw new Error("Mã nhân viên đã tồn tại.");
    }

    const isMonthly = payload.salaryType === "monthly";

    const employeeId = await addEmployee({
      storeId,
      employeeCode: payload.employeeCode.trim(),
      name: payload.name.trim(),
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      salaryType: payload.salaryType,
      monthlySalary: isMonthly ? payload.monthlySalary : 0,
      expectedWorkDays: isMonthly ? payload.expectedWorkDays || 30 : 0,
      paidLeaveDays: isMonthly ? payload.paidLeaveDays : 0,
      attendanceBonusEnabled: false,
      attendanceBonusDays: 0,
      attendanceBonusAmount: 0,
      standardHours: isMonthly ? payload.standardHours : 0,
    });

    await addPayrollEntry(payrollId, {
      employeeId,
      employeeCode: payload.employeeCode.trim(),
      employeeName: payload.name.trim(),
      role: payload.role,
      hourlyRate: payload.hourlyRate,
      hourlyMultiplier: 1,
      totalHours: 0,
      weekendHours: 0,
      salary: 0,
      allowances: [],
      note: "",
      salaryType: payload.salaryType,
      monthlySalary: isMonthly ? payload.monthlySalary : 0,
      expectedWorkDays: isMonthly ? payload.expectedWorkDays || 30 : 0,
      paidLeaveDays: isMonthly ? payload.paidLeaveDays : 0,
      attendanceBonusEnabled: false,
      attendanceBonusDays: 0,
      attendanceBonusAmount: 0,
      standardHours: isMonthly ? payload.standardHours : 0,
      shifts: [],
    });

    await Promise.all([loadEntries(), loadSavedEmployees()]);
    onEmployeesChanged?.();

    setShowAddDialog(false);
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm("Bạn có chắc muốn xóa nhân viên này khỏi bảng lương?")) return;

    try {
      await deletePayrollEntry(entryId);

      setEntries((current) => current.filter((entry) => entry.id !== entryId));
    } catch (error) {
      console.error(error);

      alert("Không thể xóa dòng lương.");
    }
  }

  async function handleSaveShifts(newShifts: Shift[]) {
    if (!currentShiftEntry?.id) return;

    let totalHours = 0;

    let weekendHours = 0;

    newShifts.forEach((shift) => {
      if (!shift.isValid || !shift.inTime || !shift.outTime) return;

      const start = new Date(shift.inTime);

      let end = new Date(shift.outTime);

      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000);

      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      totalHours += hours;

      if (shift.isWeekend) weekendHours += hours;
    });

    let updatedEntry: PayrollEntry | null = null;

    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== currentShiftEntry.id) return entry;

        const nextEntry = {
          ...entry,
          shifts: newShifts,
          totalHours: Number(totalHours.toFixed(2)),
          weekendHours: Number(weekendHours.toFixed(2)),
        };

        nextEntry.salary = calculatePayrollSalary(nextEntry);

        updatedEntry = nextEntry;

        return nextEntry;
      }),
    );

    setShiftModalOpen(false);

    if (!updatedEntry) return;

    await updatePayrollEntry(currentShiftEntry.id, {
      shifts: newShifts as any[],
      totalHours: updatedEntry.totalHours,
      weekendHours: updatedEntry.weekendHours,
      salary: updatedEntry.salary,
    });
  }

  const filteredEntries = entries
    .filter((entry) => {
      const keyword = searchTerm.trim().toLowerCase();
      const code = (entry.employeeCode || "").toLowerCase();

      const matchesSearch =
        !keyword ||
        entry.employeeName.toLowerCase().includes(keyword) ||
        code.includes(keyword) ||
        entry.role.toLowerCase().includes(keyword);

      const matchesRole = filterRole === "All" || entry.role === filterRole;

      const matchesError = !filterError || hasEntryError(entry);

      return matchesSearch && matchesRole && matchesError;
    })
    .sort((left, right) => {
      if (sortBy === "name_asc")
        return left.employeeName.localeCompare(right.employeeName, "vi");

      if (sortBy === "role_asc")
        return left.role.localeCompare(right.role, "vi");

      if (sortBy === "salary_desc")
        return (right.salary || 0) - (left.salary || 0);

      if (sortBy === "days_desc")
        return (
          getPayrollBreakdown(right).workingDays -
          getPayrollBreakdown(left).workingDays
        );

      return (right.totalHours || 0) - (left.totalHours || 0);
    });

  const visibleCount = COLUMN_OPTIONS.filter(
    (option) => visibleColumns[option.key],
  ).length;

  const filteredTotal = filteredEntries.reduce(
    (sum, entry) => sum + (entry.salary || 0),
    0,
  );

  const filteredHours = filteredEntries.reduce(
    (sum, entry) => sum + (entry.totalHours || 0),
    0,
  );

  const filteredWorkDays = filteredEntries.reduce(
    (sum, entry) => sum + getPayrollBreakdown(entry).workingDays,
    0,
  );

  const warnings = entries.filter((entry) => hasInvalidShift(entry)).length;

  const monthlyEntries = entries.filter(
    (entry) => resolvePayrollSalaryType(entry) === "monthly",
  ).length;
  const hourlyEntries = entries.filter(
    (entry) => resolvePayrollSalaryType(entry) === "hourly",
  );
  const uniformHourlyMultiplier =
    hourlyEntries.length === 0
      ? 1
      : hourlyEntries.every(
            (entry) =>
              (entry.hourlyMultiplier ?? 1) ===
              (hourlyEntries[0]?.hourlyMultiplier ?? 1),
          )
        ? hourlyEntries[0]?.hourlyMultiplier ?? 1
        : null;

  const allowanceEntry = entries.find((entry) => entry.id === allowanceEntryId);

  const allowanceBreakdown = allowanceEntry
    ? getPayrollBreakdown(allowanceEntry)
    : null;

  const salaryDetailEntry = entries.find(
    (entry) => entry.id === salaryDetailEntryId,
  );

  const salaryDetailBreakdown = salaryDetailEntry
    ? getPayrollBreakdown(salaryDetailEntry)
    : null;
  const salaryDetailAttendanceProgress = salaryDetailEntry
    ? getAttendanceBonusProgress(salaryDetailEntry)
    : null;

  async function handleApplyBatchHourlyMultiplier() {
    if (hourlyEntries.length === 0) {
      alert("Bảng lương này không có nhân viên theo giờ để áp dụng hệ số.");
      return;
    }

    const nextMultiplier = Number(batchHourlyMultiplier);
    if (!Number.isFinite(nextMultiplier) || nextMultiplier < 0) {
      alert("Hệ số không hợp lệ.");
      return;
    }

    setIsApplyingBatchMultiplier(true);
    try {
      await Promise.resolve(debouncedUpdate.flush());

      const updatedHourlyEntries = hourlyEntries
        .filter((entry): entry is PayrollEntry & { id: string } => Boolean(entry.id))
        .map((entry) => {
          const nextEntry: PayrollEntry = {
            ...entry,
            hourlyMultiplier: nextMultiplier,
          };
          nextEntry.salary = calculatePayrollSalary(nextEntry);
          return nextEntry as PayrollEntry & { id: string };
        });
      const updatedMap = new Map(
        updatedHourlyEntries.map((entry) => [entry.id, entry]),
      );

      setEntries((current) =>
        current.map((entry) =>
          entry.id ? updatedMap.get(entry.id) || entry : entry,
        ),
      );

      await Promise.all(
        updatedHourlyEntries.map((entry) =>
          queueEntryPersist(entry, { hourlyMultiplier: nextMultiplier }),
        ),
      );
    } catch (error) {
      console.error(error);
      alert("Không thể áp dụng hệ số cho toàn bộ đợt lương.");
    } finally {
      setIsApplyingBatchMultiplier(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-[28px] border border-slate-200 bg-white/80 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
              PAYROLL DETAIL
            </p>

            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Chi tiết bảng lương
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Nhân sự lương tháng được làm nổi bật, tự tính ngày công, nghỉ phép
              và chuyên cần ngay trên từng dòng.
            </p>
          </div>

          <Button variant="outline" className="rounded-2xl" onClick={onBack}>
            Danh sách bảng lương
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-[24px] bg-slate-900 p-5 text-white">
            <p className="text-sm text-slate-300">Nhân viên</p>
            <p className="mt-4 text-3xl font-semibold">{entries.length}</p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Lương tháng</p>
            <p className="mt-4 text-2xl font-semibold text-sky-700">
              {monthlyEntries}
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tổng giờ</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">
              {formatHours(filteredHours)}h
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tong ngay cong</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">
              {filteredWorkDays}
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Tổng lương</p>
            <p className="mt-4 text-2xl font-semibold text-slate-900">
              {formatCurrency(filteredTotal)}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50/80 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Hệ số lương cho toàn đợt
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Áp dụng một lần cho toàn bộ nhân viên theo giờ của bảng lương
                này. Không ảnh hưởng hồ sơ nhân viên hay các đợt lương cũ.
              </p>
              <p className="mt-2 text-sm text-amber-800">
                {hourlyEntries.length === 0
                  ? "Hiện không có nhân viên theo giờ trong đợt này."
                  : uniformHourlyMultiplier === null
                    ? `Đợt này đang có nhiều hệ số khác nhau trên ${hourlyEntries.length} nhân viên theo giờ.`
                    : `Đợt này hiện đang dùng hệ số ${formatHours(
                        uniformHourlyMultiplier,
                      )} cho ${hourlyEntries.length} nhân viên theo giờ.`}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Input
                type="number"
                min="0"
                step="0.1"
                label="Hệ số áp dụng"
                value={batchHourlyMultiplier}
                onChange={(event) =>
                  setBatchHourlyMultiplier(Number(event.target.value) || 0)
                }
                className="h-11 min-w-[180px] rounded-2xl bg-white text-right"
              />
              <Button
                className="h-11 rounded-2xl px-5"
                onClick={() => {
                  void handleApplyBatchHourlyMultiplier();
                }}
                isLoading={isApplyingBatchMultiplier}
                disabled={hourlyEntries.length === 0}
              >
                Áp dụng cho cả đợt
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-visible rounded-[28px] border border-slate-200 bg-white/90 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Bảng lương đang hiển thị
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredEntries.length}/{entries.length} nhân viên theo bộ
                  lọc hiện tại.
                </p>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">
                <div className="grid gap-3 md:grid-cols-4 xl:w-[760px]">
                  <div className="relative md:col-span-3 xl:col-span-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Tìm theo mã, tên hoặc vai trò"
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>

                  <select
                    value={filterRole}
                    onChange={(event) => setFilterRole(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="All">Tất cả vai trò</option>

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
                  <Button
                    variant={filterError ? "default" : "outline"}
                    className={cn(
                      "h-11 gap-2 rounded-2xl",
                      filterError
                        ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                        : "text-slate-600",
                    )}
                    onClick={() => setFilterError((current) => !current)}
                    title="Chỉ hiện nhân viên có lỗi hoặc thiếu dữ liệu"
                  >
                    <AlertCircle className="h-4 w-4" />
                    <span>Lỗi</span>
                  </Button>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  >
                    <option value="hours_desc">Giờ làm giảm dần</option>

                    <option value="salary_desc">Tổng lương giáº£m dáº§n</option>
                    <option value="days_desc">Ngày công giảm dần</option>

                    <option value="name_asc">Tên A-Z</option>

                    <option value="role_asc">Vai trò A-Z</option>
                  </select>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative">
                    <Button
                      variant="outline"
                      className="gap-2 rounded-2xl"
                      onClick={() => setShowColumns((current) => !current)}
                    >
                      <Columns3 className="h-4 w-4" />
                    </Button>
                    {showColumns ? (
                      <div className="absolute right-0 top-14 z-20 w-60 rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl">
                        <div className="space-y-3">
                          {COLUMN_OPTIONS.map((option) => (
                            <label
                              key={option.key}
                              className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <span>{option.label}</span>
                              <input
                                type="checkbox"
                                checked={visibleColumns[option.key]}
                                onChange={(event) =>
                                  setVisibleColumns((current) => ({
                                    ...current,
                                    [option.key]: event.target.checked,
                                  }))
                                }
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <Button
                    className="gap-2 rounded-2xl"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Thêm nhân viên
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto px-6 py-5">
            <table className="w-full min-w-[980px] text-sm border-separate border-spacing-0">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  {visibleColumns.name ? (
                    <th className="px-4 py-3 text-left">Tên nhân viên</th>
                  ) : null}
                  {visibleColumns.role ? (
                    <th className="px-4 py-3 text-left">Vai trò</th>
                  ) : null}
                  {visibleColumns.hours ? (
                    <th className="px-4 py-3 text-center">Số giờ</th>
                  ) : null}

                  {visibleColumns.workDays ? (
                    <th className="pb-3 pr-4 text-center">Ngày công</th>
                  ) : null}

                  {visibleColumns.rate ? (
                    <th className="px-4 py-3 text-center">Lương/h</th>
                  ) : null}
                  {visibleColumns.weekend ? (
                    <th className="px-4 py-3 text-center">Bonus</th>
                  ) : null}
                  {visibleColumns.allowance ? (
                    <th className="pb-3 pr-4 text-center">Phụ cấp</th>
                  ) : null}

                  {visibleColumns.total ? (
                    <th className="px-4 py-3 text-right text-emerald-700">
                      Tổng tiền
                    </th>
                  ) : null}
                  {visibleColumns.note ? (
                    <th className="px-4 py-3 text-left">Ghi chú</th>
                  ) : null}

                  {visibleColumns.action ? (
                    <th className="px-4 py-3 text-center w-[96px]">Tác vụ</th>
                  ) : null}
                </tr>
              </thead>

              <tbody>
                {filteredEntries.map((entry) => {
                  const breakdown = getPayrollBreakdown(entry);

                  const isMonthly = breakdown.salaryType === "monthly";

                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        "align-top transition-colors",
                        isMonthly
                          ? "bg-gradient-to-r from-sky-100 via-cyan-50 to-white"
                          : "bg-white",
                        hasEntryError(entry) && "bg-red-50/60",
                      )}
                    >
                      {visibleColumns.name ? (
                        <td
                          className={cn(
                            "px-4 py-4 border-b border-slate-500 align-middle",
                            isMonthly && "bg-sky-100/80",
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {hasInvalidShift(entry) ? (
                              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                            ) : null}

                            <input
                              value={entry.employeeName}
                              onChange={(event) =>
                                applyEntryPatch(
                                  entry.id!,
                                  { employeeName: event.target.value },
                                  { name: event.target.value },
                                )
                              }
                              onBlur={() => debouncedUpdate.flush()}
                              className="min-w-0 w-full bg-transparent font-semibold text-slate-900 outline-none"
                            />
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.role ? (
                        <td className="px-4 py-4 border-b border-slate-500">
                          <RoleSelect
                            roleGroups={roleGroups}
                            value={entry.role || defaultRole}
                            onChange={(value) =>
                              applyEntryPatch(
                                entry.id!,
                                { role: value },
                                { role: value },
                                { immediate: true },
                              )
                            }
                          />
                        </td>
                      ) : null}

                      {visibleColumns.hours ? (
                        <td className="px-4 py-4 border-b border-slate-500 text-center">
                          <div className="inline-flex items-center gap-2">
                            <input
                              type="number"
                              onWheel={preventNumberInputScroll}
                              value={entry.totalHours || ""}
                              onChange={(event) =>
                                applyEntryPatch(entry.id!, {
                                  totalHours: Number(event.target.value) || 0,
                                })
                              }
                              onBlur={() => debouncedUpdate.flush()}
                              className="h-9 w-24 rounded-xl border border-slate-200 px-3 text-center outline-none"
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-xl"
                              onClick={() => {
                                setCurrentShiftEntry(entry);
                                setShiftModalOpen(true);
                              }}
                            >
                              <CalendarClock className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.workDays ? (
                        <td className="py-4 pr-4 border-b border-slate-200">
                          <div
                            className={cn(
                              "rounded-[20px] border px-4 py-3",
                              isMonthly
                                ? "border-sky-200 bg-white/80 shadow-sm shadow-sky-100"
                                : "border-slate-200 bg-slate-50",
                            )}
                          >
                            <div className="text-lg font-semibold text-slate-900">
                              {breakdown.workingDays}
                              {isMonthly ? (
                                <span className="text-sm text-slate-500">
                                  {" "}
                                  / {entry.expectedWorkDays || 30}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs leading-5 text-slate-500">
                              {isMonthly ? (
                                <>
                                  Nghỉ {breakdown.absentDays} ngày, vượt
                                  phép {breakdown.unpaidLeaveDays} ngày.
                                </>
                              ) : (
                                <>Tự tính từ dữ liệu chấm công.</>
                              )}
                            </div>
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.rate ? (
                        <td className="px-4 py-4 border-b border-slate-500 text-center">
                          <div className="mx-auto max-w-[120px]">
                            <InputMoney
                              value={entry.hourlyRate}
                              set={(value) =>
                                applyEntryPatch(
                                  entry.id!,
                                  { hourlyRate: value },
                                  { hourlyRate: value },
                                )
                              }
                              onBlur={() => debouncedUpdate.flush()}
                              className="h-9 rounded-xl text-center"
                            />
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.weekend ? (
                        <td className="px-4 py-4 border-b border-slate-500 text-center">
                          <input
                            type="number"
                            onWheel={preventNumberInputScroll}
                            value={entry.weekendHours || ""}
                            onChange={(event) =>
                              applyEntryPatch(entry.id!, {
                                weekendHours: Number(event.target.value) || 0,
                              })
                            }
                            onBlur={() => debouncedUpdate.flush()}
                            className="h-9 w-24 rounded-xl border border-slate-200 px-3 text-center outline-none"
                          />
                        </td>
                      ) : null}

                      {visibleColumns.allowance ? (
                        <td className="py-4 pr-4 border-b border-slate-200">
                          <button
                            onClick={() => {
                              setAllowanceEntryId(entry.id || null);
                              setEditAllowances(entry.allowances || []);
                              setAttendanceBonusEnabled(
                                entry.attendanceBonusEnabled || false,
                              );
                              setAttendanceBonusDays(
                                entry.attendanceBonusDays || 0,
                              );
                              setAttendanceBonusAmount(
                                entry.attendanceBonusAmount || 0,
                              );
                            }}
                            className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                          >
                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">
                              {(entry.allowances || []).length} khoản
                              {entry.attendanceBonusEnabled
                                ? " + chuyên cần"
                                : ""}
                            </div>
                            <div className="mt-1 font-semibold text-slate-900">
                              {formatCurrency(
                                getAllowanceTotal(entry) +
                                  getAttendanceBonusValue(entry),
                              )}
                            </div>
                          </button>
                        </td>
                      ) : null}

                      {visibleColumns.total ? (
                        <td className="px-4 py-4 border-b border-slate-500 text-right">
                          <button
                            type="button"
                            onClick={() => setSalaryDetailEntryId(entry.id || null)}
                            className="text-right transition hover:opacity-90"
                            title="Xem chi tiết cách tính lương"
                          >
                            <div className="font-bold text-emerald-600 hover:underline">
                              {formatCurrency(entry.salary || 0)}
                            </div>
                          </button>
                          <div className="mt-1 text-xs text-slate-400">
                            {formatHours(entry.totalHours || 0)}h x{" "}
                            {formatCurrency(entry.hourlyRate || 0)}
                            {breakdown.salaryType === "hourly" &&
                            breakdown.hourlyMultiplier !== 1
                              ? ` x ${formatHours(breakdown.hourlyMultiplier)}`
                              : ""}
                          </div>
                        </td>
                      ) : null}

                      {visibleColumns.note ? (
                        <td className="px-4 py-4 border-b border-slate-500">
                          <input
                            value={entry.note || ""}
                            onChange={(event) =>
                              applyEntryPatch(entry.id!, {
                                note: event.target.value,
                              })
                            }
                            onBlur={() => debouncedUpdate.flush()}
                            placeholder="Ghi chú..."
                            className="w-full bg-transparent text-sm italic text-slate-400 outline-none"
                          />
                        </td>
                      ) : null}

                      {visibleColumns.action ? (
                        <td className="px-4 py-4 border-b border-slate-500 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-100"
                              onClick={() => {
                                setSettingsEntryId(entry.id || null);
                                const entrySalaryType =
                                  resolvePayrollSalaryType(entry);
                                setSettingsData({
                                  salaryType: entrySalaryType,
                                  monthlySalary:
                                    entry.monthlySalary ||
                                    entry.fixedSalary ||
                                    0,
                                  expectedWorkDays:
                                    entrySalaryType === "monthly"
                                      ? entry.expectedWorkDays || 30
                                      : 30,
                                  paidLeaveDays:
                                    entrySalaryType === "monthly"
                                      ? entry.paidLeaveDays || 0
                                      : 0,
                                  standardHours:
                                    entrySalaryType === "monthly"
                                      ? entry.standardHours || 0
                                      : 0,
                                  overtimeRate: entry.hourlyRate || 0,
                                  hourlyMultiplier: entry.hourlyMultiplier ?? 1,
                                });
                              }}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-50"
                              onClick={() => handleDeleteEntry(entry.id!)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}

                {filteredEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(visibleCount, 1)}
                      className="py-16 text-center text-slate-500"
                    >
                      Không có nhân viên phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-slate-500">
              Có {warnings} dòng cần kiểm tra lại dữ liệu chấm công.
            </p>
            <div className="flex flex-wrap gap-5 text-sm">
              <div>
                Giờ làm:{" "}
                <span className="font-semibold text-slate-900">
                  {formatHours(filteredHours)}h
                </span>
              </div>

              <div>
                Ngày công:{" "}
                <span className="font-semibold text-slate-900">
                  {filteredWorkDays}
                </span>
              </div>

              <div>
                Tổng lương:{" "}
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(filteredTotal)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddPayrollEntryDialog
        open={showAddDialog}
        employees={availableEmployees}
        storeId={storeId}
        onAddExisting={handleAddExistingEmployee}
        onClose={() => setShowAddDialog(false)}
        onCreateNew={handleCreateEmployee}
      />
      {salaryDetailEntry && salaryDetailBreakdown ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setSalaryDetailEntryId(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Chi tiết lương
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {salaryDetailEntry.employeeName} •{" "}
                  {salaryDetailEntry.role || "Nhân viên"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSalaryDetailEntryId(null)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              {salaryDetailBreakdown.baseSalary > 0 ? (
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
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
                      ({formatHours(salaryDetailEntry.totalHours || 0)}h x{" "}
                      {formatCurrency(salaryDetailEntry.hourlyRate || 0)}
                      {salaryDetailBreakdown.hourlyMultiplier !== 1
                        ? ` x ${formatHours(
                            salaryDetailBreakdown.hourlyMultiplier,
                          )}`
                        : ""}
                      )
                    </div>
                  ) : null}
                </div>
              </div>
              ) : null}

              {salaryDetailBreakdown.salaryType === "monthly" ? (
                salaryDetailBreakdown.overtimePay > 0 ? (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">
                    Tiền OT
                    {salaryDetailBreakdown.overtimeHours > 0
                      ? ` (${formatHours(
                          salaryDetailBreakdown.overtimeHours,
                        )}h x ${formatCurrency(
                          salaryDetailBreakdown.overtimeRate,
                        )})`
                      : ""}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(salaryDetailBreakdown.overtimePay)}
                  </span>
                </div>
                ) : null
              ) : salaryDetailBreakdown.weekendBonus > 0 ? (
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="text-slate-600">Tiền cuối tuần</span>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900">
                      {formatCurrency(salaryDetailBreakdown.weekendBonus)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      ({formatHours(salaryDetailEntry.weekendHours || 0)}h)
                    </div>
                  </div>
                </div>
              ) : null}

              {salaryDetailBreakdown.allowanceTotal > 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Tiền trợ cấp</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(salaryDetailBreakdown.allowanceTotal)}
                  </span>
                </div>
                {(salaryDetailEntry.allowances || []).length > 0 ? (
                  <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-slate-500">
                    {(salaryDetailEntry.allowances || []).map(
                      (allowance, index) => (
                        <div
                          key={`${allowance.name}-${index}`}
                          className="flex items-center justify-between"
                        >
                          <span>+ {allowance.name || `Trợ cấp ${index + 1}`}</span>
                          <span>{formatCurrency(allowance.amount)}</span>
                        </div>
                      ),
                    )}
                  </div>
                ) : null}
              </div>
              ) : null}

              {salaryDetailBreakdown.attendanceBonus > 0 ? (
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
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
                <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
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
                {formatCurrency(salaryDetailEntry.salary || 0)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
      {allowanceEntryId ? (
        <AllowanceDialog
          allowances={editAllowances}
          attendanceBonusAmount={attendanceBonusAmount}
          attendanceBonusDays={attendanceBonusDays}
          attendanceBonusEnabled={attendanceBonusEnabled}
          computedAttendanceBonus={allowanceBreakdown?.attendanceBonus || 0}
          employeeName={allowanceEntry?.employeeName || "Nh\u00e2n vi\u00ean"}
          onAdd={() =>
            setEditAllowances((current) => [
              ...current,
              { name: "", amount: 0 },
            ])
          }
          onAmountChange={(index, value) =>
            setEditAllowances((current) =>
              current.map((allowance, allowanceIndex) =>
                allowanceIndex === index
                  ? { ...allowance, amount: value }
                  : allowance,
              ),
            )
          }
          onAttendanceBonusAmountChange={setAttendanceBonusAmount}
          onAttendanceBonusDaysChange={setAttendanceBonusDays}
          onAttendanceBonusEnabledChange={setAttendanceBonusEnabled}
          onClose={() => setAllowanceEntryId(null)}
          onNameChange={(index, value) =>
            setEditAllowances((current) =>
              current.map((allowance, allowanceIndex) =>
                allowanceIndex === index
                  ? { ...allowance, name: value }
                  : allowance,
              ),
            )
          }
          onRemove={(index) =>
            setEditAllowances((current) =>
              current.filter((_, allowanceIndex) => allowanceIndex !== index),
            )
          }
          onSave={() => {
            if (!allowanceEntryId) return;
            applyEntryPatch(
              allowanceEntryId,
              {
                allowances: editAllowances,
                attendanceBonusEnabled,
                attendanceBonusDays,
                attendanceBonusAmount,
              },
              {
                attendanceBonusEnabled,
                attendanceBonusDays,
                attendanceBonusAmount,
              },
              { immediate: true },
            );
            setAllowanceEntryId(null);
          }}
          workingDays={allowanceBreakdown?.workingDays || 0}
          absentDays={allowanceBreakdown?.absentDays || 0}
        />
      ) : null}

      {settingsEntryId ? (
        <PayrollSettingsDialog
          hourlyMultiplier={settingsData.hourlyMultiplier}
          monthlySalary={settingsData.monthlySalary}
          expectedWorkDays={settingsData.expectedWorkDays}
          onClose={() => setSettingsEntryId(null)}
          onExpectedWorkDaysChange={(value) =>
            setSettingsData((current) => ({
              ...current,
              expectedWorkDays: value || 30,
            }))
          }
          onHourlyMultiplierChange={(value) =>
            setSettingsData((current) => ({
              ...current,
              hourlyMultiplier: value,
            }))
          }
          onMonthlySalaryChange={(value) =>
            setSettingsData((current) => ({ ...current, monthlySalary: value }))
          }
          onOvertimeRateChange={(value) =>
            setSettingsData((current) => ({ ...current, overtimeRate: value }))
          }
          onPaidLeaveDaysChange={(value) =>
            setSettingsData((current) => ({ ...current, paidLeaveDays: value }))
          }
          onSave={() => {
            void savePayrollSettings();
          }}
          onSalaryTypeChange={(value) =>
            setSettingsData((current) => ({
              ...current,
              salaryType: value,
              expectedWorkDays:
                value === "monthly"
                  ? current.expectedWorkDays || 30
                  : current.expectedWorkDays,
            }))
          }
          onStandardHoursChange={(value) =>
            setSettingsData((current) => ({ ...current, standardHours: value }))
          }
          overtimeRate={settingsData.overtimeRate}
          paidLeaveDays={settingsData.paidLeaveDays}
          salaryType={settingsData.salaryType}
          standardHours={settingsData.standardHours}
        />
      ) : null}

      <ShiftDetailModal
        isOpen={shiftModalOpen}
        onClose={() => setShiftModalOpen(false)}
        onSave={handleSaveShifts}
        employeeName={currentShiftEntry?.employeeName || ""}
        employeeId={
          currentShiftEntry?.employeeCode || currentShiftEntry?.employeeId || ""
        }
        initialShifts={currentShiftEntry?.shifts || []}
      />
    </div>
  );
}
