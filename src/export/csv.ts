/** Excel-safe CSV: quote anything containing a delimiter, quote, or newline. */
function escape(value: string): string {
  const v = value ?? ''
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(rows: string[][]): string {
  // A leading BOM makes Excel read UTF-8 correctly, which matters for IPA symbols.
  return '﻿' + rows.map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n'
}
