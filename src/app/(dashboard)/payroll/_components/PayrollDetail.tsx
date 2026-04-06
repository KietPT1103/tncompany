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

import ShiftDetailModal, { Shift } from "@/app/(dashboard)/timesheet/ShiftDetailModal";

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

} from "lucide-react";

import {

  calculatePayrollSalary,

  formatCurrency,

  formatHours,

  getAllowanceTotal,

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

};



const COLUMN_OPTIONS: { key: keyof VisibleColumns; label: string }[] = [
  { key: "name", label: "NhÃ¢n viÃªn" },
  { key: "role", label: "Vai trÃ²" },
  { key: "hours", label: "Giá» lÃ m" },
  { key: "workDays", label: "NgÃ y cÃ´ng" },
  { key: "rate", label: "ÄÆ¡n giÃ¡" },
  { key: "weekend", label: "Cuá»‘i tuáº§n" },
  { key: "allowance", label: "Phá»¥ cáº¥p" },
  { key: "total", label: "Tá»•ng lÆ°Æ¡ng" },
  { key: "note", label: "Ghi chÃº" },
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
  (entry.shifts || []).some((shift) => !shift.isValid || !shift.inTime || !shift.outTime);

const isEmployeeAlreadyInPayroll = (entry: PayrollEntry, employee: Employee) => {
  if (entry.employeeId && employee.id && entry.employeeId === employee.id) return true;

  const entryCode = (entry.employeeCode || "").trim().toLowerCase();
  const employeeCode = (employee.employeeCode || "").trim().toLowerCase();
  const entryLegacyCode = (entry.employeeId || "").trim().toLowerCase();

  if (entryCode && employeeCode && entryCode === employeeCode) return true;
  if (!entryCode && entryLegacyCode && employeeCode && entryLegacyCode === employeeCode) return true;

  if (!entryCode && !employeeCode) {
    return entry.employeeName.trim().toLowerCase() === employee.name.trim().toLowerCase();
  }
  return false;
};

const findLinkedEmployee = (entry: PayrollEntry, employees: Employee[]) => {
  if (entry.employeeId && !entry.employeeId.startsWith("manual_")) {
    const matchedById = employees.find((employee) => employee.id === entry.employeeId);
    if (matchedById) return matchedById;

    const legacyEmployeeCode = entry.employeeId.trim().toLowerCase();
    const matchedByLegacyCode = employees.find(
      (employee) => (employee.employeeCode || "").trim().toLowerCase() === legacyEmployeeCode
    );
    if (matchedByLegacyCode) return matchedByLegacyCode;
  }

  const entryCode = (entry.employeeCode || "").trim().toLowerCase();
  if (entryCode) {
    const matchedByCode = employees.find(
      (employee) => (employee.employeeCode || "").trim().toLowerCase() === entryCode
    );
    if (matchedByCode) return matchedByCode;
  }

  const entryName = entry.employeeName.trim().toLowerCase();
  if (!entryName) return undefined;
  return employees.find((employee) => employee.name.trim().toLowerCase() === entryName);
};

const buildPayrollEntryPayload = (entry: PayrollEntry): Partial<PayrollEntry> => {
  const salaryType = resolvePayrollSalaryType(entry);
  const monthlySalary = salaryType === "monthly" ? entry.monthlySalary || entry.fixedSalary || 0 : 0;

  return {
    employeeId: entry.employeeId,
    employeeCode: entry.employeeCode || "",
    employeeName: entry.employeeName,
    role: entry.role,
    hourlyRate: entry.hourlyRate || 0,
    totalHours: entry.totalHours || 0,
    weekendHours: entry.weekendHours || 0,
    salary: entry.salary || 0,
    allowances: entry.allowances || [],
    note: entry.note || "",
    salaryType,
    monthlySalary,
    fixedSalary: salaryType === "monthly" ? monthlySalary : 0,
    expectedWorkDays: salaryType === "monthly" ? entry.expectedWorkDays || 30 : 0,
    paidLeaveDays: salaryType === "monthly" ? entry.paidLeaveDays || 0 : 0,
    attendanceBonusEnabled: entry.attendanceBonusEnabled || false,
    attendanceBonusDays: entry.attendanceBonusDays || 0,
    attendanceBonusAmount: entry.attendanceBonusAmount || 0,
    standardHours: salaryType === "monthly" ? entry.standardHours || 0 : 0,
  };
};

const mergeEntryWithEmployeeProfile = (entry: PayrollEntry, employees: Employee[]) => {
  const linkedEmployee = findLinkedEmployee(entry, employees);
  if (!linkedEmployee) return entry;

  const entrySalaryType = resolvePayrollSalaryType(entry);
  const employeeSalaryType = resolvePayrollSalaryType(linkedEmployee as Partial<PayrollEntry>);
  const shouldUseEmployeeProfile =
    employeeSalaryType === "monthly" &&
    entrySalaryType !== "monthly" &&
    (entry.monthlySalary || entry.fixedSalary || 0) === 0 &&
    (entry.expectedWorkDays || 0) === 0 &&
    (entry.paidLeaveDays || 0) === 0 &&
    (entry.standardHours || 0) === 0 &&
    !entry.attendanceBonusEnabled &&
    (entry.attendanceBonusDays || 0) === 0 &&
    (entry.attendanceBonusAmount || 0) === 0;

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

  const [currentShiftEntry, setCurrentShiftEntry] = useState<PayrollEntry | null>(null);

  const [shiftModalOpen, setShiftModalOpen] = useState(false);

  const [settingsEntryId, setSettingsEntryId] = useState<string | null>(null);

  const [settingsData, setSettingsData] = useState({ salaryType: "hourly" as "hourly" | "monthly", monthlySalary: 0, expectedWorkDays: 30, paidLeaveDays: 0, standardHours: 0, overtimeRate: 0 });

  const [allowanceEntryId, setAllowanceEntryId] = useState<string | null>(null);

  const [editAllowances, setEditAllowances] = useState<{ name: string; amount: number }[]>([]);

  const [attendanceBonusEnabled, setAttendanceBonusEnabled] = useState(false);

  const [attendanceBonusDays, setAttendanceBonusDays] = useState(0);

  const [attendanceBonusAmount, setAttendanceBonusAmount] = useState(0);

  const entrySaveQueuesRef = useRef<Record<string, Promise<void>>>({});



  useEffect(() => { loadEntries(); }, [payrollId]);

  useEffect(() => { if (storeId) loadSavedEmployees(); }, [storeId]);
  useEffect(() => {
    if (savedEmployees.length === 0) return;
    setEntries((current) =>
      current.map((entry) => {
        const mergedEntry = mergeEntryWithEmployeeProfile(entry, savedEmployees);
        return mergedEntry === entry ? entry : mergedEntry;
      })
    );
  }, [savedEmployees]);

  useEffect(() => {

    const saved = localStorage.getItem("payroll_visible_columns_v2");

    if (!saved) return;

    try { setVisibleColumns(JSON.parse(saved)); } catch (error) { console.error(error); }

  }, []);

  useEffect(() => { localStorage.setItem("payroll_visible_columns_v2", JSON.stringify(visibleColumns)); }, [visibleColumns]);



  function queueEntryPersist(nextEntry: PayrollEntry, changes: Partial<PayrollEntry>, employeeChanges?: Partial<Employee>) {
    if (!nextEntry.id) {
      return Promise.resolve();
    }

    const entryId = nextEntry.id;
    const previousTask = entrySaveQueuesRef.current[entryId] || Promise.resolve();
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

    debounce(async (nextEntry: PayrollEntry, employeeData?: Partial<Employee>) => {

      await queueEntryPersist(nextEntry, buildPayrollEntryPayload(nextEntry), employeeData);

    }, 350),

    [savedEmployees, storeId]

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
          monthlySalary: entry.monthlySalary || entry.fixedSalary || 0,
          fixedSalary: entry.fixedSalary || entry.monthlySalary || 0,
        };
        normalizedEntry.salary = calculatePayrollSalary(normalizedEntry);
        return normalizedEntry;
      });
      setEntries(
        savedEmployees.length > 0
          ? normalizedEntries.map((entry) => mergeEntryWithEmployeeProfile(entry, savedEmployees))
          : normalizedEntries
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedEmployees() {
    if (!storeId) return;
    setSavedEmployees(await getEmployees(storeId));
  }

  const availableEmployees = useMemo(() => savedEmployees.filter((employee) => !entries.some((entry) => isEmployeeAlreadyInPayroll(entry, employee))), [entries, savedEmployees]);



  async function persistEntryPatch(nextEntry: PayrollEntry, changes: Partial<PayrollEntry>, employeeChanges?: Partial<Employee>) {
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
        (nextEntry.employeeId && !nextEntry.employeeId.startsWith("manual_") ? nextEntry.employeeId : "");
      const resolvedEmployeeId = profileEmployeeId || nextEntry.employeeId;
      const resolvedEmployeeCode =
        linkedEmployee?.employeeCode ||
        latestEmployees.find((employee) => employee.id === profileEmployeeId)?.employeeCode ||
        nextEntry.employeeCode || "";
      const resolvedSalaryType = resolvePayrollSalaryType(nextEntry);
      const persistedEntry: PayrollEntry = {
        ...nextEntry,
        employeeId: resolvedEmployeeId,
        employeeCode: resolvedEmployeeCode,
        salaryType: resolvedSalaryType,
        monthlySalary:
          resolvedSalaryType === "monthly" ? nextEntry.monthlySalary || nextEntry.fixedSalary || 0 : 0,
        fixedSalary:
          resolvedSalaryType === "monthly"
            ? nextEntry.fixedSalary || nextEntry.monthlySalary || 0
            : 0,
        expectedWorkDays:
          resolvedSalaryType === "monthly"
            ? nextEntry.expectedWorkDays || 30
            : 0,
        paidLeaveDays: resolvedSalaryType === "monthly" ? nextEntry.paidLeaveDays || 0 : 0,
        standardHours: resolvedSalaryType === "monthly" ? nextEntry.standardHours || 0 : 0,
      };
      persistedEntry.salary = calculatePayrollSalary(persistedEntry);

      await updatePayrollEntry(nextEntry.id, buildPayrollEntryPayload(persistedEntry));

      if (employeeChanges && profileEmployeeId) {
        const updatedEmployee = await updateEmployee(profileEmployeeId, {
          ...employeeChanges,
          storeId,
          employeeCode: resolvedEmployeeCode || employeeChanges.employeeCode || nextEntry.employeeCode || "",
        });
        onEmployeesChanged?.();
        if (updatedEmployee?.id) {
          setSavedEmployees((current) =>
            current.map((employee) =>
              employee.id === profileEmployeeId ? updatedEmployee : employee
            )
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
              ? { ...entry, employeeId: resolvedEmployeeId, employeeCode: resolvedEmployeeCode }
              : entry
          )
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
      monthlySalary: resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
      fixedSalary: resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
      paidLeaveDays: resolvedSalaryType === "monthly" ? settingsData.paidLeaveDays : 0,
      expectedWorkDays: resolvedExpectedWorkDays,
      standardHours: resolvedSalaryType === "monthly" ? settingsData.standardHours : 0,
      hourlyRate: resolvedSalaryType === "monthly" ? settingsData.overtimeRate : currentEntry.hourlyRate,
    };
    nextEntry.salary = calculatePayrollSalary(nextEntry);

    setEntries((current) => current.map((entry) => (entry.id === settingsEntryId ? nextEntry : entry)));
    debouncedUpdate.cancel();

    await queueEntryPersist(
      nextEntry,
      buildPayrollEntryPayload(nextEntry),
      {
        salaryType: resolvedSalaryType,
        monthlySalary: resolvedSalaryType === "monthly" ? settingsData.monthlySalary : 0,
        paidLeaveDays: resolvedSalaryType === "monthly" ? settingsData.paidLeaveDays : 0,
        expectedWorkDays: resolvedExpectedWorkDays,
        standardHours: resolvedSalaryType === "monthly" ? settingsData.standardHours : 0,
        hourlyRate: resolvedSalaryType === "monthly" ? settingsData.overtimeRate : currentEntry.hourlyRate,
      }
    );

    setSettingsEntryId(null);
  }

  function applyEntryPatch(

    entryId: string,

    changes: Partial<PayrollEntry>,

    employeeChanges?: Partial<Employee>,

    options?: { immediate?: boolean }

  ) {

    const currentEntry = entries.find((entry) => entry.id === entryId);

    if (!currentEntry?.id) return;



    const nextEntry: PayrollEntry = {

      ...currentEntry,

      ...changes,

      salaryType: resolvePayrollSalaryType({ ...currentEntry, ...changes }),

    };

    nextEntry.salary = calculatePayrollSalary(nextEntry);



    setEntries((current) => current.map((entry) => (entry.id === entryId ? nextEntry : entry)));



    if (options?.immediate) {

      debouncedUpdate.cancel();

      void queueEntryPersist(nextEntry, changes, employeeChanges);

      return;

    }



    debouncedUpdate(

      nextEntry,

      employeeChanges

    );

  }



  async function handleAddExistingEmployee(employee: Employee) {

    if (!employee.id) throw new Error("KhÃ´ng tÃ¬m tháº¥y nhÃ¢n viÃªn Ä‘Ã£ lÆ°u.");
    await addPayrollEntry(payrollId, {

      employeeId: employee.id,

      employeeCode: employee.employeeCode || "",

      employeeName: employee.name,

      role: employee.role || defaultRole,

      hourlyRate: employee.hourlyRate || 0,

      totalHours: 0,

      weekendHours: 0,

      salary: 0,

      allowances: [],

      note: "",

      salaryType: employee.salaryType || "hourly",

      monthlySalary: employee.monthlySalary || 0,

      expectedWorkDays: employee.salaryType === "monthly" ? employee.expectedWorkDays || 30 : employee.expectedWorkDays || 0,

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



  async function handleCreateEmployee(payload: { employeeCode: string; hourlyRate: number; name: string; role: string; salaryType: "hourly" | "monthly"; monthlySalary: number; expectedWorkDays: number; paidLeaveDays: number; standardHours: number; }) {

    if (!storeId) throw new Error("ChÆ°a chá»n cá»­a hÃ ng.");

    const normalizedCode = payload.employeeCode.trim().toLowerCase();

    if (savedEmployees.some((employee) => (employee.employeeCode || "").trim().toLowerCase() === normalizedCode)) {

      throw new Error("MÃ£ nhÃ¢n viÃªn Ä‘Ã£ tá»“n táº¡i.");

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

    if (!confirm("Báº¡n cÃ³ cháº¯c muá»‘n xÃ³a nhÃ¢n viÃªn nÃ y khá»i báº£ng lÆ°Æ¡ng?")) return;

    try {

      await deletePayrollEntry(entryId);

      setEntries((current) => current.filter((entry) => entry.id !== entryId));

    } catch (error) {

      console.error(error);

      alert("KhÃ´ng thá»ƒ xÃ³a dÃ²ng lÆ°Æ¡ng.");

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

    setEntries((current) => current.map((entry) => {

      if (entry.id !== currentShiftEntry.id) return entry;

      const nextEntry = { ...entry, shifts: newShifts, totalHours: Number(totalHours.toFixed(2)), weekendHours: Number(weekendHours.toFixed(2)) };

      nextEntry.salary = calculatePayrollSalary(nextEntry);

      updatedEntry = nextEntry;

      return nextEntry;

    }));

    setShiftModalOpen(false);

    if (!updatedEntry) return;

    await updatePayrollEntry(currentShiftEntry.id, { shifts: newShifts as any[], totalHours: updatedEntry.totalHours, weekendHours: updatedEntry.weekendHours, salary: updatedEntry.salary });

  }



  const filteredEntries = entries

    .filter((entry) => {

      const keyword = searchTerm.trim().toLowerCase();

      const code = (entry.employeeCode || "").toLowerCase();

      const matchesSearch = !keyword || entry.employeeName.toLowerCase().includes(keyword) || code.includes(keyword) || entry.role.toLowerCase().includes(keyword);

      return matchesSearch && (filterRole === "All" || entry.role === filterRole);

    })

    .sort((left, right) => {

      if (sortBy === "name_asc") return left.employeeName.localeCompare(right.employeeName, "vi");

      if (sortBy === "role_asc") return left.role.localeCompare(right.role, "vi");

      if (sortBy === "salary_desc") return (right.salary || 0) - (left.salary || 0);

      if (sortBy === "days_desc") return getPayrollBreakdown(right).workingDays - getPayrollBreakdown(left).workingDays;

      return (right.totalHours || 0) - (left.totalHours || 0);

    });



  const visibleCount = COLUMN_OPTIONS.filter((option) => visibleColumns[option.key]).length;

  const filteredTotal = filteredEntries.reduce((sum, entry) => sum + (entry.salary || 0), 0);

  const filteredHours = filteredEntries.reduce((sum, entry) => sum + (entry.totalHours || 0), 0);

  const filteredWorkDays = filteredEntries.reduce((sum, entry) => sum + getPayrollBreakdown(entry).workingDays, 0);

  const warnings = entries.filter((entry) => hasInvalidShift(entry)).length;

  const monthlyEntries = entries.filter((entry) => resolvePayrollSalaryType(entry) === "monthly").length;

  const allowanceEntry = entries.find((entry) => entry.id === allowanceEntryId);

  const allowanceBreakdown = allowanceEntry ? getPayrollBreakdown(allowanceEntry) : null;



  if (loading) {

    return <div className="flex items-center justify-center rounded-[28px] border border-slate-200 bg-white/80 py-20"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>;

  }



  return (

    <div className="space-y-6">

      <section className="rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-sm">

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">

          <div>

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">PAYROLL DETAIL</p>

            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Chi tiáº¿t báº£ng lÆ°Æ¡ng</h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">NhÃ¢n sá»± lÆ°Æ¡ng thÃ¡ng Ä‘Æ°á»£c lÃ m ná»•i báº­t, tá»± tÃ­nh ngÃ y cÃ´ng, nghá»‰ phÃ©p vÃ  chuyÃªn cáº§n ngay trÃªn tá»«ng dÃ²ng.</p>
          </div>

          <Button variant="outline" className="rounded-2xl" onClick={onBack}>Danh sÃ¡ch báº£ng lÆ°Æ¡ng</Button>

        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">

          <div className="rounded-[24px] bg-slate-900 p-5 text-white"><p className="text-sm text-slate-300">NhÃ¢n viÃªn</p><p className="mt-4 text-3xl font-semibold">{entries.length}</p></div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">LÆ°Æ¡ng thÃ¡ng</p><p className="mt-4 text-2xl font-semibold text-sky-700">{monthlyEntries}</p></div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Tá»•ng giá»</p><p className="mt-4 text-2xl font-semibold text-slate-900">{formatHours(filteredHours)}h</p></div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Tong ngay cong</p><p className="mt-4 text-2xl font-semibold text-slate-900">{filteredWorkDays}</p></div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">Tá»•ng lÆ°Æ¡ng</p><p className="mt-4 text-2xl font-semibold text-slate-900">{formatCurrency(filteredTotal)}</p></div>
        </div>

      </section>



      <Card className="overflow-visible rounded-[28px] border border-slate-200 bg-white/90 shadow-sm">

        <CardContent className="p-0">

          <div className="border-b border-slate-100 px-6 py-5">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">

              <div>

                <h3 className="text-lg font-semibold text-slate-900">Báº£ng lÆ°Æ¡ng Ä‘ang hiá»ƒn thá»‹</h3>
                <p className="mt-1 text-sm text-slate-500">{filteredEntries.length}/{entries.length} nhÃ¢n viÃªn theo bá»™ lá»c hiá»‡n táº¡i.</p>
              </div>

              <div className="flex flex-col gap-3 xl:items-end">

                <div className="grid gap-3 md:grid-cols-3 xl:w-[760px]">

                  <div className="relative md:col-span-3 xl:col-span-1">

                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="TÃ¬m theo mÃ£, tÃªn hoáº·c vai trÃ²" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100" />

                  </div>

                  <select value={filterRole} onChange={(event) => setFilterRole(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100">

                    <option value="All">Táº¥t cáº£ vai trÃ²</option>

                    {Object.entries(roleGroups).map(([group, roles]) => <optgroup key={group} label={group}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</optgroup>)}

                  </select>

                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100">

                    <option value="hours_desc">Giá» lÃ m giáº£m dáº§n</option>

                    <option value="salary_desc">Tá»•ng lÆ°Æ¡ng giáº£m dáº§n</option>
                    <option value="days_desc">NgÃ y cÃ´ng giáº£m dáº§n</option>

                    <option value="name_asc">TÃªn A-Z</option>

                    <option value="role_asc">Vai trÃ² A-Z</option>

                  </select>

                </div>

                <div className="flex flex-col gap-3 sm:flex-row">

                  <div className="relative">

                    <Button variant="outline" className="gap-2 rounded-2xl" onClick={() => setShowColumns((current) => !current)}><Columns3 className="h-4 w-4" />Cá»™t hiá»ƒn thá»‹</Button>
                    {showColumns ? <div className="absolute right-0 top-14 z-20 w-60 rounded-[24px] border border-slate-200 bg-white p-4 shadow-xl"><div className="space-y-3">{COLUMN_OPTIONS.map((option) => <label key={option.key} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-700"><span>{option.label}</span><input type="checkbox" checked={visibleColumns[option.key]} onChange={(event) => setVisibleColumns((current) => ({ ...current, [option.key]: event.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" /></label>)}</div></div> : null}

                  </div>

                  <Button className="gap-2 rounded-2xl" onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4" />ThÃªm nhÃ¢n viÃªn</Button>

                </div>

              </div>

            </div>

          </div>

          <div className="overflow-x-auto px-6 py-5">

            <table className="min-w-[1500px] w-full table-fixed text-sm">

              <thead>

                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-400">

                  {visibleColumns.name ? <th className="pb-3 pr-4 w-[280px]">NhÃ¢n viÃªn</th> : null}

                  {visibleColumns.role ? <th className="pb-3 pr-4 w-[160px]">Vai trÃ²</th> : null}

                  {visibleColumns.hours ? <th className="pb-3 pr-4 w-[150px] text-right">Giá» lÃ m</th> : null}

                  {visibleColumns.workDays ? <th className="pb-3 pr-4 w-[160px]">NgÃ y cÃ´ng</th> : null}

                  {visibleColumns.rate ? <th className="pb-3 pr-4 w-[220px]">ÄÆ¡n giÃ¡</th> : null}

                  {visibleColumns.weekend ? <th className="pb-3 pr-4 w-[140px] text-right">Cuá»‘i tuáº§n</th> : null}
                  {visibleColumns.allowance ? <th className="pb-3 pr-4 w-[180px]">Phá»¥ cáº¥p</th> : null}

                  {visibleColumns.total ? <th className="pb-3 pr-4 w-[170px] text-right">Tá»•ng lÆ°Æ¡ng</th> : null}
                  {visibleColumns.note ? <th className="pb-3 w-[220px]">Ghi chÃº</th> : null}

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredEntries.map((entry) => {

                  const breakdown = getPayrollBreakdown(entry);

                  const isMonthly = breakdown.salaryType === "monthly";

                  return (

                    <tr key={entry.id} className={cn("align-top", isMonthly && "bg-sky-50/30")}>

                      {visibleColumns.name ? <td className="py-4 pr-4"><div className={cn("rounded-[24px] border bg-slate-50 p-3", isMonthly ? "border-sky-200 bg-sky-50/70" : "border-slate-200")}><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex items-center gap-2">{hasInvalidShift(entry) ? <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700"><AlertCircle className="h-4 w-4" /></span> : null}<input value={entry.employeeName} onChange={(event) => applyEntryPatch(entry.id!, { employeeName: event.target.value }, { name: event.target.value })} onBlur={() => debouncedUpdate.flush()} className="h-10 w-full rounded-2xl border border-transparent bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className="inline-flex rounded-full bg-slate-900 px-3 py-1 font-mono text-xs font-semibold text-white">{entry.employeeCode || "ChÆ°a cÃ³ mÃ£"}</span><span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", isMonthly ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200")}>{isMonthly ? "LÆ°Æ¡ng thÃ¡ng" : "Theo giá»"}</span>{savingId === entry.id ? <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-600"><Loader2 className="h-3 w-3 animate-spin" />Äang lÆ°u</span> : null}</div></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl text-slate-500 hover:bg-slate-200" onClick={() => { setSettingsEntryId(entry.id || null); const entrySalaryType = resolvePayrollSalaryType(entry); setSettingsData({ salaryType: entrySalaryType, monthlySalary: entry.monthlySalary || entry.fixedSalary || 0, expectedWorkDays: entrySalaryType === "monthly" ? entry.expectedWorkDays || 30 : 30, paidLeaveDays: entrySalaryType === "monthly" ? entry.paidLeaveDays || 0 : 0, standardHours: entrySalaryType === "monthly" ? entry.standardHours || 0 : 0, overtimeRate: entry.hourlyRate || 0 }); }}><Settings2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-9 w-9 rounded-2xl text-rose-500 hover:bg-rose-50" onClick={() => handleDeleteEntry(entry.id!)}><Trash2 className="h-4 w-4" /></Button></div></div></div></td> : null}

                      {visibleColumns.role ? <td className="py-4 pr-4"><RoleSelect roleGroups={roleGroups} value={entry.role || defaultRole} onChange={(value) => applyEntryPatch(entry.id!, { role: value }, { role: value }, { immediate: true })} /></td> : null}

                      {visibleColumns.hours ? <td className="py-4 pr-4 text-right"><div className="flex items-center justify-end gap-2"><input type="number" onWheel={preventNumberInputScroll} value={entry.totalHours || ""} onChange={(event) => applyEntryPatch(entry.id!, { totalHours: Number(event.target.value) || 0 })} onBlur={() => debouncedUpdate.flush()} className="h-10 w-24 rounded-2xl border border-slate-200 bg-white px-3 text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 no-spin" /><Button variant="outline" size="icon" className="h-10 w-10 rounded-2xl" onClick={() => { setCurrentShiftEntry(entry); setShiftModalOpen(true); }}><CalendarClock className="h-4 w-4" /></Button></div></td> : null}

                      {visibleColumns.workDays ? <td className="py-4 pr-4"><div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"><div className="text-lg font-semibold text-slate-900">{breakdown.workingDays}{isMonthly ? <span className="text-sm text-slate-500"> / {entry.expectedWorkDays || 30}</span> : null}</div><div className="mt-1 text-xs leading-5 text-slate-500">{isMonthly ? <>Nghá»‰ thiáº¿u {breakdown.absentDays} ngÃ y, vÆ°á»£t phÃ©p {breakdown.unpaidLeaveDays} ngÃ y.</> : <>Tá»± tÃ­nh tá»« dá»¯ liá»‡u cháº¥m cÃ´ng.</>}</div></div></td> : null}
                      {visibleColumns.rate ? <td className="py-4 pr-4">{isMonthly ? <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-4 py-3"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">LÆ°Æ¡ng thÃ¡ng</div><div className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(entry.monthlySalary || 0)}</div><div className="mt-2 text-xs leading-5 text-slate-500">PhÃ©p {entry.paidLeaveDays || 0} ngÃ y. OT sau {formatHours(entry.standardHours || 0)}h, {formatCurrency(entry.hourlyRate || 0)}/h.</div></div> : <div className="ml-auto max-w-[180px]"><InputMoney value={entry.hourlyRate} set={(value) => applyEntryPatch(entry.id!, { hourlyRate: value }, { hourlyRate: value })} onBlur={() => debouncedUpdate.flush()} className="h-10 rounded-2xl" /></div>}</td> : null}

                      {visibleColumns.weekend ? <td className="py-4 pr-4 text-right">{isMonthly ? <div className="rounded-[20px] border border-sky-200 bg-white px-4 py-3 text-xs font-medium text-sky-700">KhÃ´ng tÃ­nh</div> : <input type="number" onWheel={preventNumberInputScroll} value={entry.weekendHours || ""} onChange={(event) => applyEntryPatch(entry.id!, { weekendHours: Number(event.target.value) || 0 })} onBlur={() => debouncedUpdate.flush()} className="ml-auto h-10 w-24 rounded-2xl border border-slate-200 bg-white px-3 text-right outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 no-spin" />}</td> : null}

                      {visibleColumns.allowance ? <td className="py-4 pr-4"><button onClick={() => { setAllowanceEntryId(entry.id || null); setEditAllowances(entry.allowances || []); setAttendanceBonusEnabled(entry.attendanceBonusEnabled || false); setAttendanceBonusDays(entry.attendanceBonusDays || 0); setAttendanceBonusAmount(entry.attendanceBonusAmount || 0); }} className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"><div className="text-xs uppercase tracking-[0.16em] text-slate-400">{(entry.allowances || []).length} khoáº£n{entry.attendanceBonusEnabled ? " + chuyÃªn cáº§n" : ""}</div><div className="mt-1 font-semibold text-slate-900">{formatCurrency(getAllowanceTotal(entry) + getAttendanceBonusValue(entry))}</div></button></td> : null}

                      {visibleColumns.total ? <td className="py-4 pr-4 text-right"><div className="font-semibold text-emerald-700">{formatCurrency(entry.salary || 0)}</div>{isMonthly ? <div className="mt-1 text-xs leading-5 text-slate-500">{breakdown.overtimeHours > 0 ? `OT ${formatHours(breakdown.overtimeHours)}h: ${formatCurrency(breakdown.overtimePay)} - Trá»« phÃ©p ${formatCurrency(breakdown.deduction)}` : `Trá»« phÃ©p ${formatCurrency(breakdown.deduction)}`}</div> : <div className="mt-1 text-xs leading-5 text-slate-500">{formatHours(entry.totalHours || 0)}h x {formatCurrency(entry.hourlyRate || 0)}</div>}</td> : null}

                      {visibleColumns.note ? <td className="py-4"><input value={entry.note || ""} onChange={(event) => applyEntryPatch(entry.id!, { note: event.target.value })} onBlur={() => debouncedUpdate.flush()} placeholder="Ghi chÃº thÃªm" className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100" /></td> : null}

                    </tr>

                  );

                })}

                {filteredEntries.length === 0 ? <tr><td colSpan={Math.max(visibleCount, 1)} className="py-16 text-center text-slate-500">KhÃ´ng cÃ³ nhÃ¢n viÃªn phÃ¹ há»£p vá»›i bá»™ lá»c hiá»‡n táº¡i.</td></tr> : null}
              </tbody>

            </table>

          </div>

          <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">

            <p className="text-sm text-slate-500">CÃ³ {warnings} dÃ²ng cáº§n kiá»ƒm tra láº¡i dá»¯ liá»‡u cháº¥m cÃ´ng.</p>
            <div className="flex flex-wrap gap-5 text-sm">

              <div>Giá» lÃ m: <span className="font-semibold text-slate-900">{formatHours(filteredHours)}h</span></div>

              <div>NgÃ y cÃ´ng: <span className="font-semibold text-slate-900">{filteredWorkDays}</span></div>

              <div>Tá»•ng lÆ°Æ¡ng: <span className="font-semibold text-emerald-700">{formatCurrency(filteredTotal)}</span></div>
            </div>

          </div>

        </CardContent>

      </Card>



      <AddPayrollEntryDialog open={showAddDialog} employees={availableEmployees} storeId={storeId} onAddExisting={handleAddExistingEmployee} onClose={() => setShowAddDialog(false)} onCreateNew={handleCreateEmployee} />
      {allowanceEntryId ? (
        <AllowanceDialog
          allowances={editAllowances}
          attendanceBonusAmount={attendanceBonusAmount}
          attendanceBonusDays={attendanceBonusDays}
          attendanceBonusEnabled={attendanceBonusEnabled}
          computedAttendanceBonus={allowanceBreakdown?.attendanceBonus || 0}
          employeeName={allowanceEntry?.employeeName || "Nh\u00e2n vi\u00ean"}
          onAdd={() => setEditAllowances((current) => [...current, { name: "", amount: 0 }])}
          onAmountChange={(index, value) =>
            setEditAllowances((current) =>
              current.map((allowance, allowanceIndex) =>
                allowanceIndex === index ? { ...allowance, amount: value } : allowance
              )
            )
          }
          onAttendanceBonusAmountChange={setAttendanceBonusAmount}
          onAttendanceBonusDaysChange={setAttendanceBonusDays}
          onAttendanceBonusEnabledChange={setAttendanceBonusEnabled}
          onClose={() => setAllowanceEntryId(null)}
          onNameChange={(index, value) =>
            setEditAllowances((current) =>
              current.map((allowance, allowanceIndex) =>
                allowanceIndex === index ? { ...allowance, name: value } : allowance
              )
            )
          }
          onRemove={(index) =>
            setEditAllowances((current) => current.filter((_, allowanceIndex) => allowanceIndex !== index))
          }
          onSave={() => {
            if (!allowanceEntryId) return;
            applyEntryPatch(
              allowanceEntryId,
              { allowances: editAllowances, attendanceBonusEnabled, attendanceBonusDays, attendanceBonusAmount },
              { attendanceBonusEnabled, attendanceBonusDays, attendanceBonusAmount },
              { immediate: true }
            );
            setAllowanceEntryId(null);
          }}
          workingDays={allowanceBreakdown?.workingDays || 0}
          absentDays={allowanceBreakdown?.absentDays || 0}
        />
      ) : null}

      {settingsEntryId ? (
        <PayrollSettingsDialog
          monthlySalary={settingsData.monthlySalary}
          expectedWorkDays={settingsData.expectedWorkDays}
          onClose={() => setSettingsEntryId(null)}
          onExpectedWorkDaysChange={(value) =>
            setSettingsData((current) => ({ ...current, expectedWorkDays: value || 30 }))
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
              expectedWorkDays: value === "monthly" ? current.expectedWorkDays || 30 : current.expectedWorkDays,
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

      <ShiftDetailModal isOpen={shiftModalOpen} onClose={() => setShiftModalOpen(false)} onSave={handleSaveShifts} employeeName={currentShiftEntry?.employeeName || ""} employeeId={currentShiftEntry?.employeeCode || currentShiftEntry?.employeeId || ""} initialShifts={currentShiftEntry?.shifts || []} />
    </div>
  );
}
