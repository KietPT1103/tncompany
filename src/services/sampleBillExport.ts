export type SampleBillExportType = "coffee" | "hotpot" | "farm";

const SAMPLE_BILL_FILE_PREFIX: Record<SampleBillExportType, string> = {
  coffee: "Bill_mau_nuoc",
  hotpot: "Bill_mau_lau",
  farm: "Bill_mau_farm",
};

export function getSampleBillExportFileName(
  billType: SampleBillExportType,
  date: string,
) {
  const prefix = SAMPLE_BILL_FILE_PREFIX[billType];
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!dateMatch) {
    return `${prefix}.xlsx`;
  }

  const [, year, month, day] = dateMatch;
  return `${prefix}_${day}_${month}_${year}.xlsx`;
}

export function resolveSampleBillExportFileName(
  serverFileName: string,
  billType: SampleBillExportType,
  date: string,
) {
  const isGenericDownloadName = /^download(?:\.[a-z0-9]+)?$/i.test(
    serverFileName,
  );

  return serverFileName && !isGenericDownloadName
    ? serverFileName
    : getSampleBillExportFileName(billType, date);
}
