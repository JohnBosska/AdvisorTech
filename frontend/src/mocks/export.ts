// Demo file export. Real Excel workbooks are generated server-side (brief §5.6); this produces a
// clearly-labelled CSV so the download flow can be exercised in the prototype.
export function downloadDemoCsv(filename: string, rows: (string | number)[][]) {
  const header = ['ДЕМО-ФАЙЛ: данные демонстрационные, не из вашей 1С']
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(';')).join('\r\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
