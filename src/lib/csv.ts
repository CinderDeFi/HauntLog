// Minimal CSV parser (RFC4180-ish).
// Supports double-quoted fields and escaped quotes ("").
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  // Normalize line endings.
  const s = text.replace(/\r\n?/g, '\n');

  while (i < s.length) {
    const c = s[i];

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // Flush trailing field/row.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop trailing fully-empty rows.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === '')) {
    rows.pop();
  }

  return rows;
}

export type SeedCsvRow = Record<string, string>;

// Turn the 2D matrix into header-keyed records.
export function csvToRecords(text: string): SeedCsvRow[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cols) => {
    const rec: SeedCsvRow = {};
    headers.forEach((h, idx) => {
      rec[h] = (cols[idx] ?? '').trim();
    });
    return rec;
  });
}

// Pipe-separated list, with empty-string filtering.
export function splitPipes(s: string | undefined): string[] | undefined {
  if (!s) return undefined;
  const parts = s
    .split('|')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : undefined;
}
