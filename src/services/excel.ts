import * as XLSX from 'xlsx'

export function parseExcel(file: File): Promise<any[]> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      // Đọc toàn bộ sheet thành mảng 2 chiều
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
      }) as any[][]

      resolve(rows)
    }

    reader.readAsArrayBuffer(file)
  })
}
