import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Calculator, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { paginateItems } from "@/lib/listPagination";
import { SelectBox } from "@/components/ui/SelectBox";
import { SingleDatePicker } from "@/components/ui/SingleDatePicker";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import {
  getProfitPeriod,
  saveProfitPeriod,
  type ProfitPeriodResponse,
} from "@/services/dailyProfitService";
import {
  emptyProfitInputs,
  PROFIT_FIELDS,
  type ProfitInputs,
} from "./dailyProfit";
import {
  calculateProfitPeriod,
  profitPresetRange,
  type ProfitPreset,
} from "./profitPeriod";
import { AmountInput } from "./AmountInput";

export const profitMoney = (value: number) =>
  value.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " đ";
export const profitDate = (value: string) =>
  value.split("-").reverse().join("/");
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const control =
  "h-10 min-w-0 rounded-sm border border-slate-200 bg-white px-3 text-sm text-emerald-900 shadow-sm hover:border-[#064E3B] hover:bg-white focus-visible:outline-none focus-visible:border-[#064E3B] focus-visible:ring-0 focus-visible:ring-offset-0";
const openControl = "border-[#064E3B] ring-0 ring-offset-0";

export function ProfitCalculation({
  storeId,
  onSaved,
}: {
  storeId: string;
  onSaved: () => void;
}) {
  const [preset, setPreset] = useState<ProfitPreset>("day");
  const [anchor, setAnchor] = useState(today);
  const [custom, setCustom] = useState(() => ({
    startDate: today(),
    endDate: today(),
  }));
  const range = useMemo(() => {
    if (preset === "custom") return custom;
    try {
      return profitPresetRange(preset, anchor);
    } catch {
      return { startDate: "", endDate: "" };
    }
  }, [preset, anchor, custom]);
  const scope = `${storeId}:${range.startDate}:${range.endDate}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const drafts = useRef<Record<string, ProfitInputs>>({});
  const formPanel = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<{
    scope: string;
    data: ProfitPeriodResponse;
  } | null>(null);
  const [inputs, setInputs] = useState<Record<string, ProfitInputs>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [costPage, setCostPage] = useState({ scope: "", page: 1 });
  const data = loaded?.scope === scope ? loaded.data : null;
  const calculation = useMemo(
    () => calculateProfitPeriod(data?.days ?? [], inputs),
    [data, inputs],
  );
  const selected = calculation.rows.find((row) => row.date === selectedDate);
  const costPageScope = `${scope}:${selectedDate}`;
  const paginatedCosts = paginateItems(
    selected?.result.costRows ?? [],
    costPage.scope === costPageScope ? costPage.page : 1,
  );
  const missingCostCount = selected?.result.costRows.filter((row) => row.unitCost === null).length ?? 0;
  const missingExpenseFields = PROFIT_FIELDS
    .filter((field) => selected?.result.missingFields.includes(field.label))
    .map((field) => field.label);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoaded(null);
    setInputs({});
    setDirty(false);
    setError("");
    setMessage("");
    setSelectedDate(range.startDate);
    if (!range.startDate || !range.endDate || range.startDate > range.endDate) {
      setError("Vui lòng chọn khoảng ngày hợp lệ.");
      setLoading(false);
      return;
    }
    getProfitPeriod(storeId, range.startDate, range.endDate)
      .then((response) => {
        if (active) {
          setLoaded({ scope, data: response });
          setInputs(
            Object.fromEntries(
              response.days.map((day) => [
                day.date,
                drafts.current[`${storeId}:${day.date}`] ??
                  day.saved?.inputs ??
                  emptyProfitInputs(),
              ]),
            ),
          );
          setDirty(
            response.days.some((day) =>
              Object.prototype.hasOwnProperty.call(
                drafts.current,
                `${storeId}:${day.date}`,
              ),
            ),
          );
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được báo cáo.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [storeId, scope, range.startDate, range.endDate, reload]);

  function edit(date: string, value: ProfitInputs) {
    drafts.current[`${storeId}:${date}`] = value;
    setInputs((previous) => ({ ...previous, [date]: value }));
    setDirty(true);
    setMessage("");
  }
  async function save() {
    if (!data || !calculation.complete || saving) return;
    const savingScope = scope;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await saveProfitPeriod(
        storeId,
        range.startDate,
        range.endDate,
        inputs,
      );
      for (const day of response.days)
        delete drafts.current[`${storeId}:${day.date}`];
      if (currentScope.current === savingScope) {
        setLoaded({ scope, data: response });
        setInputs(
          Object.fromEntries(
            response.days.map((day) => [day.date, day.saved!.inputs]),
          ),
        );
        setDirty(false);
        setMessage(
          "Đã lưu báo cáo và chi phí từng ngày. Xem kết quả đã lưu ở tab Lịch sử.",
        );
      }
      onSaved();
    } catch (reason) {
      if (currentScope.current === savingScope)
        setError(
          reason instanceof Error ? reason.message : "Không lưu được báo cáo.",
        );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <fieldset
          disabled={saving}
          className="grid min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-end"
        >
          <div>
            <p
              className="mb-1 block text-xs font-medium text-slate-500"
            >
              Kỳ báo cáo
            </p>
            <SelectBox<ProfitPreset>
              ariaLabel="Kỳ báo cáo"
              value={preset}
              onValueChange={setPreset}
              disabled={saving}
              options={[{value:"day",label:"Một ngày"},{value:"week",label:"Một tuần"},{value:"month",label:"Một tháng"},{value:"custom",label:"Khoảng ngày"}]}
              className="w-full sm:w-40"
              triggerClassName={control}
              openTriggerClassName={openControl}
            />
          </div>
          {preset === "custom" ? (
            <DateRangePicker
              label="Khoảng ngày"
              startDate={custom.startDate}
              endDate={custom.endDate}
              onChange={(startDate, endDate) =>
                setCustom({ startDate, endDate })
              }
              disabled={saving}
              className="w-full sm:w-80"
              triggerClassName={control}
              openTriggerClassName={openControl}
            />
          ) : (
            <SingleDatePicker
              label={preset === "day"
                  ? "Ngày báo cáo"
                  : preset === "week"
                    ? "Tuần báo cáo"
                    : "Tháng báo cáo"}
              value={anchor}
              summary={preset === "week"
                ? `${profitDate(range.startDate)} – ${profitDate(range.endDate)}`
                : preset === "month"
                  ? `Tháng ${anchor.slice(5, 7)}/${anchor.slice(0, 4)}`
                  : undefined}
              onChange={setAnchor}
              disabled={saving}
              className={preset === "week" ? "min-w-0 sm:w-72" : "min-w-0 sm:w-56"}
              triggerClassName={`${control} aria-expanded:border-[#064E3B] aria-expanded:ring-0`}
            />
          )}
        </fieldset>
        <div className="grid gap-3 sm:flex">
          <Button
            variant="outline"
            disabled={loading || saving || dirty}
            onClick={() => setReload((value) => value + 1)}
            className={`gap-2 ${control}`}
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </Button>
          <Button
            disabled={!calculation.complete || loading || saving}
            isLoading={saving}
            onClick={() => void save()}
            className="gap-2 rounded-sm bg-emerald-800 text-white hover:bg-emerald-900"
          >
            <Save className="h-4 w-4" />
            Lưu báo cáo
          </Button>
        </div>
      </div>
      {(preset === "week" || preset === "month") && (
        <p className="text-xs text-slate-500">
          {preset === "week"
            ? "Chọn một ngày trong lịch để xem cả tuần, từ Thứ Hai đến Chủ nhật."
            : "Chọn một ngày trong lịch để xem toàn bộ tháng đó."}
        </p>
      )}
      <div className="flex flex-wrap justify-between gap-2 border-y border-slate-200 py-3 text-xs text-slate-500">
        <span>
          {profitDate(range.startDate)} — {profitDate(range.endDate)}
          {data && ` · ${data.days.length} ngày`}
        </span>
        <span>
          {dirty ? "Có thay đổi chưa lưu" : "Chi phí lưu riêng theo từng ngày"}
        </span>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          {message}
        </p>
      )}
      {loading ? (
        <p
          role="status"
          className="rounded-lg border border-slate-200 bg-white p-10 text-center text-slate-500"
        >
          Đang tải doanh thu và chi phí trong kỳ...
        </p>
      ) : (
        data && (
          <>
            <section
              aria-label="Kết quả lợi nhuận kỳ"
              className="grid min-w-0 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5 lg:grid-cols-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500">
                  Lợi nhuận ròng ước tính
                </p>
                <p
                  className={`mt-2 break-words text-2xl font-bold tabular-nums sm:text-3xl ${calculation.profit === null ? "text-slate-400" : calculation.profit < 0 ? "text-red-700" : "text-emerald-800"}`}
                >
                  {calculation.profit === null
                    ? "Chưa đủ số liệu"
                    : profitMoney(calculation.profit)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {calculation.margin === null
                    ? "Tính từ doanh thu và chi phí của từng ngày"
                    : `Biên lợi nhuận: ${calculation.margin.toFixed(1)}%`}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500">
                  Doanh thu thuần
                </p>
                <p
                  className={`mt-2 break-words text-2xl font-bold tabular-nums ${calculation.revenue < 0 ? "text-red-700" : "text-emerald-800"}`}
                >
                  {profitMoney(calculation.revenue)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-500">
                  Tổng chi phí
                </p>
                <p className="mt-2 break-words text-2xl font-bold text-slate-800 tabular-nums">
                  {calculation.complete
                    ? profitMoney(calculation.totalCosts)
                    : "Chưa đủ số liệu"}
                </p>
              </div>
              {!calculation.complete && (
                <p
                  role="status"
                  className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 lg:col-span-3"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Còn {calculation.missingDays.length} ngày thiếu chi phí/cost.
                </p>
              )}
            </section>
            <fieldset
              disabled={saving}
              className="min-w-0 space-y-5"
              key={scope}
            >
              {selected && (
                <div
                  ref={formPanel}
                  className="grid min-w-0 gap-5 xl:grid-cols-2"
                >
                  <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h2 className="text-base font-bold">Chi phí cần nhập</h2>
                      <div className={calculation.rows.length > 1 ? "min-w-0 w-full sm:w-40" : "min-w-0"}>
                        {calculation.rows.length > 1 && (
                          <>
                            <p className="mb-1 block text-xs font-medium text-slate-500">
                              Ngày nhập chi phí
                            </p>
                            <SelectBox
                              ariaLabel="Ngày nhập chi phí"
                              value={selectedDate}
                              onValueChange={setSelectedDate}
                              options={calculation.rows.map((row) => ({value:row.date,label:profitDate(row.date)}))}
                              disabled={saving}
                              searchable
                              searchPlaceholder="Tìm ngày..."
                              triggerClassName={control}
                              openTriggerClassName={openControl}
                              searchInputClassName="hover:border-[#064E3B] focus:border-[#064E3B] focus:ring-0"
                            />
                          </>
                        )}
                        <p className={`text-xs ${calculation.rows.length > 1 ? "mt-1" : ""} ${selected.result.complete ? "text-emerald-700" : "text-amber-700"}`}>
                          {selected.result.complete ? "Đã nhập đủ" : "Thiếu chi phí"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2">
                      <div className="min-w-0 sm:col-span-2">
                        <p className="mb-1.5 text-sm font-semibold">Lương nhân viên (1 ngày)</p>
                        <p className={`rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 font-semibold ${selected.inputs.salary === null ? "text-amber-700" : "text-emerald-800"}`}>
                          {selected.inputs.salary === null ? "Chưa có ước lượng lương đã lưu" : profitMoney(selected.inputs.salary)}
                        </p>
                        <p className="mt-1.5 text-xs text-slate-500">
                          {selected.source.salaryEstimate ? `Lấy từ ${selected.source.salaryEstimate.name}. ` : "Lưu lịch phân ca trong Ước lượng lương để lấy lương ngày này. "}
                          <a className="font-semibold text-emerald-800 underline" href={`/admin/payroll-estimate${selected.source.salaryEstimate ? `?payrollId=${encodeURIComponent(selected.source.salaryEstimate.payrollId)}` : ""}`}>Xem ước lượng lương</a>
                        </p>
                      </div>
                      {PROFIT_FIELDS.filter((field) => field.key !== "salary").map((field) => (
                        <div
                          key={field.key}
                          className="min-w-0"
                        >
                          <label
                            htmlFor={`profit-${selected.date}-${field.key}`}
                            className="mb-1.5 block text-sm font-semibold"
                          >
                            {field.label}
                            {field.key !== "marketing" && (
                              <span className="text-red-600"> *</span>
                            )}
                          </label>
                          <AmountInput
                            key={`${selected.date}:${field.key}`}
                            id={`profit-${selected.date}-${field.key}`}
                            label={`${field.label} ngày ${profitDate(selected.date)}`}
                            value={selected.inputs[field.key]}
                            onChange={(value) =>
                              edit(selected.date, {
                                ...selected.inputs,
                                [field.key]: value,
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                    {selected.inputs.legacyUtilities != null && (
                      <p className="mt-4 rounded-sm bg-amber-50 p-3 text-xs text-amber-900">
                        Ngày này trước đây lưu điện/nước gộp:{" "}
                        {profitMoney(selected.inputs.legacyUtilities)}. Nhập lại
                        phần tiền điện và tiền nước riêng trước khi lưu.
                      </p>
                    )}
                    {!selected.result.complete && (
                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
                        {missingExpenseFields.length > 0 && (
                          <p className="text-amber-800">
                            Cần bổ sung: {missingExpenseFields.join(", ")}.
                          </p>
                        )}
                        {missingCostCount > 0 && (
                          <p className="flex items-start gap-2 text-slate-600">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                            <span>
                              Có {missingCostCount} món chưa có cost.{" "}
                              <a href="#profit-cost-details" className="font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-950">
                                Bổ sung tại chi tiết ngày
                              </a>
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                  <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                    <h2 className="flex items-center gap-2 text-base font-bold">
                      <Calculator
                        className="h-5 w-5 text-emerald-700"
                        aria-hidden="true"
                      />
                      Bảng tính trong ngày
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      {profitDate(selected.date)} · {selected.source.billCount}{" "}
                      hóa đơn hoàn tất
                    </p>
                    <dl className="mt-4 divide-y divide-slate-100 text-sm">
                      <div className="flex min-w-0 justify-between gap-3 py-2.5">
                        <dt>Doanh thu thuần</dt>
                        <dd
                          className={`shrink-0 text-right font-bold tabular-nums ${selected.source.revenue < 0 ? "text-red-700" : "text-emerald-800"}`}
                        >
                          {profitMoney(selected.source.revenue)}
                        </dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3 py-2.5">
                        <dt>− Giá vốn món đã bán</dt>
                        <dd className="shrink-0 text-right font-semibold tabular-nums">
                          {selected.result.costRows.some(
                            (row) => row.cost === null,
                          )
                            ? "Cần bổ sung cost"
                            : profitMoney(selected.result.materialCost)}
                        </dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3 py-2.5">
                        <dt>− Lương nhân viên (1 ngày)</dt>
                        <dd className="shrink-0 text-right font-semibold tabular-nums">
                          {selected.inputs.salary === null
                            ? "Chưa nhập"
                            : profitMoney(selected.inputs.salary)}
                        </dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3 py-2.5">
                        <dt>− Chi phí tại quầy thu ngân</dt>
                        <dd className="shrink-0 text-right font-semibold tabular-nums">
                          {profitMoney(selected.result.voucherCost)}
                        </dd>
                      </div>
                      {(
                        ["electricity", "water", "other", "marketing"] as const
                      ).map((key) => (
                        <div
                          key={key}
                          className="flex min-w-0 justify-between gap-3 py-2.5"
                        >
                          <dt>
                            −{" "}
                            {
                              PROFIT_FIELDS.find((field) => field.key === key)!
                                .label
                            }
                          </dt>
                          <dd className="shrink-0 text-right font-semibold tabular-nums">
                            {selected.inputs[key] === null
                              ? "Chưa nhập"
                              : profitMoney(selected.inputs[key]!)}
                          </dd>
                        </div>
                      ))}
                      <div className="flex min-w-0 justify-between gap-3 py-3 font-bold">
                        <dt>Tổng chi phí ngày</dt>
                        <dd className="text-right tabular-nums">
                          {selected.result.complete
                            ? profitMoney(selected.result.totalCosts)
                            : "Chưa đủ số liệu"}
                        </dd>
                      </div>
                      <div className="flex min-w-0 justify-between gap-3 py-3 font-bold">
                        <dt>Lợi nhuận ngày</dt>
                        <dd
                          className={`text-right tabular-nums ${selected.result.profit === null ? "text-slate-400" : selected.result.profit < 0 ? "text-red-700" : "text-emerald-800"}`}
                        >
                          {selected.result.profit === null
                            ? "Chưa đủ số liệu"
                            : profitMoney(selected.result.profit)}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>
              )}
              {calculation.rows.length > 1 && (
                <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 p-4 sm:p-5">
                    <h2 className="text-base font-bold">
                      Tổng hợp lợi nhuận theo ngày
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Chọn ngày để nhập hoặc điều chỉnh chi phí trên form phía
                      trên.
                    </p>
                  </div>
                  <div className="max-h-[420px] overflow-auto overscroll-contain">
                    <table className="w-full min-w-[800px] text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                        <tr>
                          {[
                            "Ngày",
                            "Doanh thu",
                            "Tổng chi phí",
                            "Lợi nhuận",
                            "Trạng thái",
                            "",
                          ].map((label, index) => (
                            <th
                              key={index}
                              scope="col"
                              className="px-4 py-3 text-left font-semibold"
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {calculation.rows.map((row) => (
                          <tr
                            key={row.date}
                            className={
                              selectedDate === row.date
                                ? "bg-emerald-50/50"
                                : "hover:bg-slate-50"
                            }
                          >
                            <th
                              scope="row"
                              className="whitespace-nowrap px-4 py-3 text-left font-semibold"
                            >
                              {profitDate(row.date)}
                            </th>
                            <td
                              className={`whitespace-nowrap px-4 py-3 ${row.source.revenue < 0 ? "text-red-700" : "text-emerald-800"}`}
                            >
                              {profitMoney(row.source.revenue)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3">
                              {row.result.complete
                                ? profitMoney(row.result.totalCosts)
                                : "Chưa đủ số liệu"}
                            </td>
                            <td
                              className={`whitespace-nowrap px-4 py-3 font-bold ${row.result.profit === null ? "text-slate-400" : row.result.profit < 0 ? "text-red-700" : "text-emerald-800"}`}
                            >
                              {row.result.profit === null
                                ? "Chưa đủ số liệu"
                                : profitMoney(row.result.profit)}
                            </td>
                            <td
                              className={`px-4 py-3 text-xs ${row.result.complete ? "text-emerald-700" : "text-amber-700"}`}
                            >
                              {!row.result.complete
                                ? "Thiếu chi phí"
                                : Object.prototype.hasOwnProperty.call(
                                      drafts.current,
                                      `${storeId}:${row.date}`,
                                    )
                                  ? "Có thay đổi chưa lưu"
                                  : row.saved
                                    ? "Đã lưu chi phí"
                                    : "Đã nhập đủ"}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-pressed={selectedDate === row.date}
                                onClick={() => {
                                  setSelectedDate(row.date);
                                  formPanel.current?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                                }}
                                className="whitespace-nowrap text-emerald-800"
                              >
                                Nhập chi phí
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {selected && (
                <>
                <section id="profit-cost-details" className="min-w-0 scroll-mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold">
                        Chi tiết ngày {profitDate(selected.date)}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Cost lấy từ danh mục hoặc công thức nguyên liệu của món.
                      </p>
                    </div>
                    <div className="sm:text-right">
                      <p className={`text-base font-bold tabular-nums ${missingCostCount > 0 ? "text-slate-500" : "text-emerald-800"}`}>
                        <span className="mr-2 text-sm font-normal text-slate-500">Tổng giá vốn</span>
                        {missingCostCount > 0 ? "Chưa đủ cost" : profitMoney(selected.result.materialCost)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {selected.result.costRows.length} món
                        {missingCostCount > 0 && <span className="ml-3 text-amber-800">{missingCostCount} món chưa có cost</span>}
                      </p>
                    </div>
                  </div>
                    <div className="mt-4 min-w-0 overflow-x-auto">
                      <table className="w-full min-w-[600px] table-fixed text-sm">
                        <colgroup>
                          <col className="w-[35%]" />
                          <col className="w-[15%]" />
                          <col className="w-[25%]" />
                          <col className="w-[25%]" />
                        </colgroup>
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th scope="col" className="p-3 text-left">Món</th>
                            <th scope="col" className="whitespace-nowrap p-3 text-right">Số lượng</th>
                            <th scope="col" className="p-3 text-right">Cost / món</th>
                            <th scope="col" className="whitespace-nowrap p-3 text-right">Tổng giá vốn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedCosts.items.map((row) => (
                            <tr key={row.key}>
                              <td className="break-words px-3 py-2.5 font-medium">{row.name}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                {row.quantity.toLocaleString("vi-VN")}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums">
                                <div className="ml-auto max-w-48">
                                {row.unitCost === null ||
                                Object.prototype.hasOwnProperty.call(
                                  selected.inputs.costOverrides,
                                  row.key,
                                ) ? (
                                  <AmountInput
                                    key={`${selected.date}:${row.key}`}
                                    id={`cost-${selected.date}-${encodeURIComponent(row.key)}`}
                                    label={`Cost ${row.name} ngày ${profitDate(selected.date)}`}
                                    value={row.unitCost}
                                    onChange={(value) =>
                                      edit(selected.date, {
                                        ...selected.inputs,
                                        costOverrides: {
                                          ...selected.inputs.costOverrides,
                                          [row.key]: value,
                                        },
                                      })
                                    }
                                  />
                                ) : (
                                  <>
                                    {profitMoney(row.unitCost)}
                                    <span className="mt-1 block text-xs text-slate-500">{row.costSource === "recipe" ? "Từ công thức" : "Từ danh mục"}</span>
                                  </>
                                )}
                                </div>
                              </td>
                              <td className="relative px-3 py-2.5 text-right font-semibold tabular-nums">
                                {row.cost === null
                                  ? <span className="font-normal text-slate-400"><span aria-hidden="true">—</span><span className="sr-only">Chưa có cost</span></span>
                                  : profitMoney(row.cost)}
                              </td>
                            </tr>
                          ))}
                          {!selected.result.costRows.length && (
                            <tr>
                              <td
                                colSpan={4}
                                className="p-5 text-center text-slate-500"
                              >
                                Không có món bán trong ngày này.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {paginatedCosts.pagination.totalPages > 1 && (
                      <Pagination
                        currentPage={paginatedCosts.pagination.currentPage}
                        totalItems={selected.result.costRows.length}
                        onPageChange={(page) => setCostPage({ scope: costPageScope, page })}
                        disabled={saving}
                        className="px-0 pb-0 sm:px-0"
                      />
                    )}
                </section>
                <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold">Phiếu chi tại quầy</h2>
                        <p className="mt-1 text-sm text-slate-500">Ngày {profitDate(selected.date)}</p>
                      </div>
                      <p className="text-base font-bold tabular-nums text-emerald-800">
                        <span className="mr-2 text-sm font-normal text-slate-500">Tổng chi</span>
                        {profitMoney(selected.result.voucherCost)}
                      </p>
                    </div>
                    {selected.source.vouchers.length ? (
                      <div className="mt-4 min-w-0 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th scope="col" className="p-3 text-left sm:w-1/3">Phiếu chi</th>
                              <th scope="col" className="hidden p-3 text-left sm:table-cell">Nội dung</th>
                              <th scope="col" className="p-3 text-right">Số tiền</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selected.source.vouchers.map((voucher) => (
                              <tr key={voucher.id}>
                                <td className="p-3 align-top">
                                  <span className="block break-words">{voucher.category}</span>
                                  <span className="mt-1 block text-xs text-slate-500">{voucher.code}</span>
                                  {voucher.note && <span className="mt-1 block break-words text-slate-500 sm:hidden">{voucher.note}</span>}
                                </td>
                                <td className="hidden break-words p-3 align-top sm:table-cell">{voucher.note || "—"}</td>
                                <td className="whitespace-nowrap p-3 text-right align-top font-semibold tabular-nums">
                                  {profitMoney(voucher.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
                        Không có phiếu chi hợp lệ: 0 đ.
                      </p>
                    )}
                </section>
                </>
              )}
            </fieldset>
          </>
        )
      )}
    </div>
  );
}
