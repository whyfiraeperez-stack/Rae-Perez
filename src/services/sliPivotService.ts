import { SliPivotDetailRow, SliPivotGroup } from '../types';

export const GOOGLE_SHEET_ID = '17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg';
export const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`;

const MONTH_NAMES = [
  'JANUARY',
  'FEBRUARY',
  'MARCH',
  'APRIL',
  'MAY',
  'JUNE',
  'JULY',
  'AUGUST',
  'SEPTEMBER',
  'OCTOBER',
  'NOVEMBER',
  'DECEMBER',
];

export function toTitleCase(val: string): string {
  const norm = String(val || '').trim().toUpperCase();
  if (norm === 'ALBAY') return 'Albay';
  if (norm === 'SORSOGON') return 'Sorsogon';
  if (norm === 'MASBATE') return 'Masbate';
  if (!norm) return '';
  return norm.charAt(0) + norm.slice(1).toLowerCase();
}

/**
 * Format month key (e.g. "2026-09") into the pivot tab sheet name:
 * "SLI ACTIVATION - SEPTEMBER 2026"
 */
export function getSliPivotTabName(yearMonth: string): string {
  if (!yearMonth) return 'SLI ACTIVATION - SEPTEMBER 2026';
  const [yStr, mStr] = yearMonth.split('-');
  const y = Number(yStr) || 2026;
  const m = Number(mStr) || 9;
  const mName = MONTH_NAMES[m - 1] || 'SEPTEMBER';
  return `SLI ACTIVATION - ${mName} ${y}`;
}

export interface FetchPivotResult {
  table: any;
  sheetSource: string;
  found: boolean;
  error?: string;
}

/**
 * Fetch the SLI ACTIVATION monthly pivot from Google Sheets.
 *
 * It dynamically requests the sheet named e.g. "SLI ACTIVATION - SEPTEMBER 2026".
 * If not directly a separate sheet, it also scans "DAILY REPORT ALMASOR"
 * where the official "SLI ACTIVATION - SEPTEMBER 2026" pivot table block is maintained.
 */
export async function fetchSliActivationPivot(
  sheetName: string = 'SLI ACTIVATION - SEPTEMBER 2026',
  signal?: AbortSignal
): Promise<FetchPivotResult> {
  // Helper to query GViz
  const queryGviz = async (targetSheet: string) => {
    const url =
      `${GOOGLE_SHEET_URL}/gviz/tq` +
      `?sheet=${encodeURIComponent(targetSheet)}` +
      `&tqx=out:json` +
      `&headers=0` +
      `&_=${Date.now()}`;

    const response = await fetch(url, {
      cache: 'no-store',
      signal,
      headers: { Accept: 'text/plain' },
    });

    if (!response.ok) {
      throw new Error(`SLI ACTIVATION pivot failed: HTTP ${response.status}`);
    }

    const text = await response.text();
    const match = text.match(
      /google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/
    );

    if (!match) {
      throw new Error('Could not parse SLI ACTIVATION pivot.');
    }

    const json = JSON.parse(match[1]);
    if (json.status === 'error') {
      throw new Error(
        json.errors?.[0]?.detailed_message ||
          json.errors?.[0]?.message ||
          'SLI ACTIVATION pivot returned an error.'
      );
    }

    return json.table;
  };

  // Helper to check if a table contains the pivot headers
  const containsPivotHeader = (table: any, expectedTitle?: string) => {
    if (!table || !Array.isArray(table.rows)) return false;
    let foundHeader = false;
    let foundTitle = !expectedTitle;

    for (let r = 0; r < Math.min(50, table.rows.length); r++) {
      const row = table.rows[r];
      if (!row || !row.c) continue;
      for (let c = 0; c < row.c.length; c++) {
        const val = String(row.c[c]?.v || '').trim().toUpperCase();
        if (expectedTitle && val.includes(expectedTitle.toUpperCase())) {
          foundTitle = true;
        }
        if (val === 'SLI TYPE') {
          const next = String(row.c[c + 1]?.v || '').trim().toUpperCase();
          if (next === 'SLI') {
            foundHeader = true;
          }
        }
      }
    }
    return foundHeader && foundTitle;
  };

  try {
    // 1. First, attempt to fetch the exact sheet name (e.g. "SLI ACTIVATION - SEPTEMBER 2026")
    const table = await queryGviz(sheetName);
    if (containsPivotHeader(table)) {
      return { table, sheetSource: sheetName, found: true };
    }

    // 2. If the sheet name was redirected to sheet 0 (or didn't have the header),
    // check DAILY REPORT ALMASOR where the official pivot block is located
    const draTable = await queryGviz('DAILY REPORT ALMASOR');
    if (containsPivotHeader(draTable, sheetName)) {
      return { table: draTable, sheetSource: 'DAILY REPORT ALMASOR', found: true };
    }

    // Also check without title filter if September 2026
    if (sheetName.includes('SEPTEMBER 2026') && containsPivotHeader(draTable)) {
      return { table: draTable, sheetSource: 'DAILY REPORT ALMASOR', found: true };
    }

    return {
      table: null,
      sheetSource: sheetName,
      found: false,
      error: `No SLI activation pivot available for this month.`,
    };
  } catch (err: any) {
    return {
      table: null,
      sheetSource: sheetName,
      found: false,
      error: err.message || 'Error fetching SLI activation pivot.',
    };
  }
}

/**
 * Parses the raw GViz table dynamically without assuming fixed row indices.
 * Detects header: SLI TYPE | SLI | STATEORPROVINCE
 * Detects package columns: FIBERX | SME | BIDA | Grand Total
 * Filters out subtotal rows ("Total", "Grand Total")
 * Produces SliPivotDetailRow items.
 */
export function parseSliActivationPivotTable(
  table: any,
  sheetNameHint?: string
): SliPivotDetailRow[] {
  if (!table || !Array.isArray(table.rows) || table.rows.length === 0) {
    return [];
  }

  const rows = table.rows;

  let headerRowIdx = -1;
  let sliTypeCol = -1;
  let sliCol = -1;
  let provCol = -1;

  // Dynamically locate the header row containing "SLI TYPE" and "SLI"
  for (let r = 0; r < Math.min(60, rows.length); r++) {
    const row = rows[r];
    if (!row || !row.c) continue;
    for (let c = 0; c < row.c.length; c++) {
      const v = String(row.c[c]?.v || '').trim().toUpperCase();
      if (v === 'SLI TYPE') {
        const c1 = String(row.c[c + 1]?.v || '').trim().toUpperCase();
        const c2 = String(row.c[c + 2]?.v || '').trim().toUpperCase();
        if (c1 === 'SLI' && (c2.includes('STATE') || c2.includes('PROVINCE'))) {
          headerRowIdx = r;
          sliTypeCol = c;
          sliCol = c + 1;
          provCol = c + 2;
          break;
        }
      }
    }
    if (headerRowIdx !== -1) break;
  }

  if (headerRowIdx === -1) {
    return [];
  }

  // Detect package columns: FIBERX, SME, BIDA, Grand Total
  let fiberXCol = provCol + 1;
  let smeCol = provCol + 2;
  let bidaCol = provCol + 3;
  let totalCol = provCol + 4;

  for (
    let r = Math.max(0, headerRowIdx - 2);
    r <= Math.min(rows.length - 1, headerRowIdx + 1);
    r++
  ) {
    const row = rows[r];
    if (!row || !row.c) continue;
    for (let c = provCol + 1; c < Math.min(row.c.length, provCol + 8); c++) {
      const text = String(row.c[c]?.v || '').trim().toUpperCase();
      if (text === 'FIBERX' || text.includes('FIBERX')) fiberXCol = c;
      else if (text === 'SME' || text.includes('SME')) smeCol = c;
      else if (text === 'BIDA' || text.includes('BIDA')) bidaCol = c;
      else if (text === 'GRAND TOTAL' || text === 'TOTAL') totalCol = c;
    }
  }

  let currentSliType: 'INHOUSE' | 'MSA' | '' = '';
  let currentSli = '';
  const detailRows: SliPivotDetailRow[] = [];

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.c) continue;

    const rawType = String(row.c[sliTypeCol]?.v || '').trim();
    const rawSli = String(row.c[sliCol]?.v || '').trim();
    const rawProv = String(row.c[provCol]?.v || '').trim();

    const fiberX = Number(row.c[fiberXCol]?.v) || 0;
    const sme = Number(row.c[smeCol]?.v) || 0;
    const bida = Number(row.c[bidaCol]?.v) || 0;
    const rawTotal = Number(row.c[totalCol]?.v);
    const total =
      Number.isFinite(rawTotal) && rawTotal > 0
        ? rawTotal
        : fiberX + sme + bida;

    // Check for empty termination
    if (!rawType && !rawSli && !rawProv && total === 0) {
      if (r + 1 < rows.length) {
        const nextRow = rows[r + 1];
        const nextType = String(nextRow?.c?.[sliTypeCol]?.v || '').trim();
        const nextSli = String(nextRow?.c?.[sliCol]?.v || '').trim();
        if (!nextType && !nextSli) break;
      } else {
        break;
      }
      continue;
    }

    // IGNORE subtotal rows & grand total
    const combinedStr = `${rawType} ${rawSli}`.toUpperCase();
    if (
      combinedStr.includes('TOTAL') ||
      rawType.toUpperCase().endsWith('TOTAL') ||
      rawSli.toUpperCase().endsWith('TOTAL') ||
      rawType.toUpperCase() === 'GRAND TOTAL' ||
      rawSli.toUpperCase() === 'GRAND TOTAL'
    ) {
      continue;
    }

    // Pivot carry-down logic
    const upperType = rawType.toUpperCase();
    if (upperType === 'INHOUSE' || upperType === 'MSA') {
      currentSliType = upperType;
    }
    if (rawSli) {
      currentSli = rawSli.replace(/\s+/g, ' ');
    }

    // Detail row must have SLI TYPE, SLI name, and Province
    if (!currentSliType || !currentSli || !rawProv) {
      continue;
    }

    detailRows.push({
      sliType: currentSliType,
      sli: currentSli,
      province: rawProv.toUpperCase(),
      fiberX,
      sme,
      bida,
      total,
    });
  }

  return detailRows;
}

/**
 * Aggregates detail rows by composite key:
 * const key = `${sliType}|||${sliName.toUpperCase()}`
 *
 * Ranks descending by Total (pivot Grand Total).
 * Calculates share % using the sum of detail row totals.
 */
export function aggregateSliPivotDetailRows(
  detailRows: SliPivotDetailRow[],
  filter?: { province?: string; sliType?: string; package?: string }
): { groups: SliPivotGroup[]; totalSum: number } {
  const map = new Map<
    string,
    {
      sliType: 'INHOUSE' | 'MSA';
      name: string;
      provinces: string[];
      fiberX: number;
      sme: number;
      bida: number;
      total: number;
    }
  >();

  for (const d of detailRows) {
    // Province filter
    if (filter?.province && filter.province !== 'All districts') {
      const filterNorm = filter.province.toUpperCase().trim();
      const provNorm = d.province.toUpperCase().trim();
      if (!provNorm.includes(filterNorm) && !filterNorm.includes(provNorm)) {
        continue;
      }
    }

    // SLI Type filter
    if (filter?.sliType && filter.sliType !== 'All SLI Types') {
      if (d.sliType !== filter.sliType.toUpperCase().trim()) {
        continue;
      }
    }

    // Package filter
    if (filter?.package && filter.package !== 'All Packages') {
      const pkg = filter.package.toUpperCase().trim();
      if (pkg === 'FIBERX' && d.fiberX <= 0) continue;
      if (pkg === 'SME' && d.sme <= 0) continue;
      if (pkg === 'BIDA' && d.bida <= 0) continue;
    }

    const key = `${d.sliType}|||${d.sli.toUpperCase()}`;
    if (!map.has(key)) {
      map.set(key, {
        sliType: d.sliType,
        name: d.sli,
        provinces: [],
        fiberX: 0,
        sme: 0,
        bida: 0,
        total: 0,
      });
    }

    const item = map.get(key)!;
    const cleanProv = toTitleCase(d.province);
    if (cleanProv && !item.provinces.includes(cleanProv)) {
      item.provinces.push(cleanProv);
    }
    item.fiberX += d.fiberX;
    item.sme += d.sme;
    item.bida += d.bida;
    item.total += d.total;
  }

  // Denominator: sum of all detail totals in current filtered scope
  const list = Array.from(map.values()).sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name)
  );
  const totalSum = list.reduce((sum, x) => sum + x.total, 0);

  const groups: SliPivotGroup[] = list.map((item) => {
    const share = totalSum > 0 ? (item.total / totalSum) * 100 : 0;
    let provinceDisplay = '—';
    const sortedProvs = [...item.provinces].sort();
    if (sortedProvs.length === 1) {
      provinceDisplay = sortedProvs[0];
    } else if (sortedProvs.length === 2) {
      provinceDisplay = `${sortedProvs[0]} • ${sortedProvs[1]}`;
    } else if (sortedProvs.length > 2) {
      provinceDisplay = 'Multiple provinces';
    }

    return {
      key: `${item.sliType}|||${item.name.toUpperCase()}`,
      name: item.name,
      sliType: item.sliType,
      provinces: sortedProvs,
      provinceDisplay,
      fiberX: item.fiberX,
      sme: item.sme,
      bida: item.bida,
      total: item.total,
      share,
    };
  });

  return { groups, totalSum };
}
