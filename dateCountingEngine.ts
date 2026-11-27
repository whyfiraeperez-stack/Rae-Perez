import { JORecord, Province, SliType, PackageCategory } from '../types';

export type DateFilterMode = 'specific_date' | 'entire_month';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_MAP: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/**
 * Authoritative Date Normalizer supporting:
 * - Date strings such as "15-Sep-2026", "15-SEP-2026", "15 Sep 2026", "15-September-2026", "15-Sep-26"
 * - Month-first strings such as "September 15, 2026", "Sep 15, 2026", "Sep-15-2026"
 * - ISO & Year-first strings: "2026-09-15", "2026/09/15", "2026-09-15T00:00:00.000Z"
 * - Standard numeric dates: "15-09-2026", "15/09/2026", "9/15/2026", "09/15/2026"
 * - Real spreadsheet dates: Excel numeric serial numbers (e.g. 46281) & native Date objects
 */
export function normalizeDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;

  // 1. Native Date object
  if (value instanceof Date) {
    return isNaN(value.getTime())
      ? null
      : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  // 2. Real Excel numeric serial numbers (e.g. 46280, 46281)
  if (
    typeof value === 'number' ||
    (!isNaN(Number(value)) &&
      !String(value).includes('-') &&
      !String(value).includes('/') &&
      !String(value).includes('.') &&
      !String(value).includes('T'))
  ) {
    const num = Number(value);
    if (num > 20000 && num < 80000) {
      // Excel epoch: Dec 30 1899 UTC
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 24 * 60 * 60 * 1000;
      const d = new Date(excelEpoch.getTime() + num * msPerDay);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
  }

  const str = String(value).trim();
  if (!str) return null;

  // 3. Named month with Day first (e.g. "15-Sep-2026", "15-SEP-2026", "15 Sep 2026", "15-September-2026", "15-Sep-26")
  const dMmmYMatch = str.match(/^(\d{1,2})[-/ ]([A-Za-z]+)[-/ ](\d{2,4})(.*)$/);
  if (dMmmYMatch) {
    const day = parseInt(dMmmYMatch[1], 10);
    const mStr = dMmmYMatch[2].toLowerCase();
    let year = parseInt(dMmmYMatch[3], 10);
    if (year < 100) year += 2000;
    const month =
      MONTH_MAP[mStr] ??
      MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(mStr.slice(0, 3)));
    if (month >= 0) {
      const d = new Date(year, month, day);
      if (
        !isNaN(d.getTime()) &&
        d.getDate() === day &&
        d.getMonth() === month &&
        d.getFullYear() === year
      ) {
        return d;
      }
    }
  }

  // 4. Named month with Month first (e.g. "Sep-15-2026", "September 15, 2026", "Sep 15 2026")
  const mmmDYMatch = str.match(/^([A-Za-z]+)[-/ ](\d{1,2}),?[-/ ](\d{2,4})(.*)$/);
  if (mmmDYMatch) {
    const mStr = mmmDYMatch[1].toLowerCase();
    const day = parseInt(mmmDYMatch[2], 10);
    let year = parseInt(mmmDYMatch[3], 10);
    if (year < 100) year += 2000;
    const month =
      MONTH_MAP[mStr] ??
      MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(mStr.slice(0, 3)));
    if (month >= 0) {
      const d = new Date(year, month, day);
      if (
        !isNaN(d.getTime()) &&
        d.getDate() === day &&
        d.getMonth() === month &&
        d.getFullYear() === year
      ) {
        return d;
      }
    }
  }

  // 5. Year-Month-Day format (e.g. "2026-09-15" or "2026/09/15" or ISO timestamp)
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (
      !isNaN(d.getTime()) &&
      d.getDate() === day &&
      d.getMonth() === month &&
      d.getFullYear() === year
    ) {
      return d;
    }
  }

  // 6. Day-Month-Year or Month-Day-Year numeric: "15-09-2026", "15/09/2026", "9/15/2026", "09/15/2026"
  const numMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(.*)$/);
  if (numMatch) {
    const p1 = parseInt(numMatch[1], 10);
    const p2 = parseInt(numMatch[2], 10);
    let year = parseInt(numMatch[3], 10);
    if (year < 100) year += 2000;

    let day = p1;
    let month = p2 - 1;
    // If first part <= 12 and second part > 12, it's M/D/Y (e.g. 9/15/2026)
    if (p1 <= 12 && p2 > 12) {
      month = p1 - 1;
      day = p2;
    }
    const d = new Date(year, month, day);
    if (
      !isNaN(d.getTime()) &&
      d.getDate() === day &&
      d.getMonth() === month &&
      d.getFullYear() === year
    ) {
      return d;
    }
  }

  // 7. General standard Date fallback
  const parsed = new Date(str.replace(/-/g, ' '));
  if (!isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

/**
 * Formats a Date as "September 14, 2026"
 */
export function formatDateDisplay(date: Date): string {
  const monthName = MONTH_NAMES[date.getMonth()];
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${monthName} ${day}, ${year}`;
}

/**
 * Formats a month/year as "September 2026"
 */
export function formatMonthDisplay(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`;
}

/**
 * Formats a Date as "YYYY-MM-DD" for ISO matching and keys
 */
export function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Dynamically generates all calendar dates for a given month & year.
 * Accounts correctly for:
 * - 28-day February
 * - 29-day February in leap years
 * - 30-day months
 * - 31-day months
 */
export function getDatesInMonth(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(new Date(year, month, day));
  }

  return dates;
}

/**
 * Returns available months list based on data plus fallback anchor (September 2026).
 */
export function getAvailableMonths(records: JORecord[]): { year: number; month: number; label: string }[] {
  const map = new Map<string, { year: number; month: number; label: string }>();

  // Ensure September 2026 is always available as baseline
  const defaultKey = '2026-8';
  map.set(defaultKey, { year: 2026, month: 8, label: 'September 2026' });

  for (const r of records) {
    const rawDate = r.closingDate || r.activationDate;
    const d = normalizeDate(rawDate);
    if (d) {
      const y = d.getFullYear();
      const m = d.getMonth();
      const k = `${y}-${m}`;
      if (!map.has(k)) {
        map.set(k, { year: y, month: m, label: formatMonthDisplay(y, m) });
      }
    }
  }

  // Sort descending by date
  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
}

/**
 * Checks if a record matches territory/province filter (Column G: STATEORPROVINCE)
 */
export function matchesProvince(record: JORecord, selectedProvince: string): boolean {
  if (!selectedProvince || selectedProvince === 'All districts' || selectedProvince === 'ALL' || selectedProvince === 'All' || selectedProvince === 'All Provinces') {
    return true;
  }
  const cleanFilter = selectedProvince.trim().toUpperCase();
  const cleanRecordProv = (record.stateOrProvince || '').trim().toUpperCase();
  return cleanRecordProv === cleanFilter || (cleanFilter.length >= 3 && cleanRecordProv.includes(cleanFilter));
}

/**
 * Checks if a record matches SLI Type filter (Column S: SLI TYPE, Column U: VENDOR TYPE, Column T: VENDOR)
 */
export function matchesSliType(record: JORecord, selectedSliType: string): boolean {
  if (!selectedSliType || selectedSliType === 'All' || selectedSliType === 'ALL' || selectedSliType === 'All SLI Types') {
    return true;
  }
  const cleanFilter = selectedSliType.trim().toUpperCase();
  const rawType = (record.sliType || record.vendorType || '').trim().toUpperCase();

  if (cleanFilter === 'INHOUSE') {
    if (rawType === 'INHOUSE' || rawType.includes('INHOUSE') || rawType.includes('IN-HOUSE') || rawType.includes('INTERNAL')) return true;
    const vendor = (record.vendor || record.sli || '').trim().toUpperCase();
    return (
      vendor.includes('INHOUSE') ||
      vendor.includes('IN-HOUSE') ||
      vendor.includes('INTERNAL') ||
      vendor.includes('BUSINESS CENTER') ||
      vendor.includes('TELEDIGISALES') ||
      vendor.includes('ONLINE APPLICATION')
    );
  }

  if (cleanFilter === 'MSA') {
    if (rawType === 'MSA' || rawType.includes('MSA') || rawType.includes('OUTSOURCE') || rawType.includes('DEALER')) return true;
    const vendor = (record.vendor || record.sli || '').trim().toUpperCase();
    return (
      vendor.includes('MSA') ||
      vendor.includes('ENTERPRISE') ||
      vendor.includes('OUTSOURCE') ||
      vendor.includes('STORE') ||
      vendor.includes('TRUCKING') ||
      vendor.includes('SERAPH') ||
      vendor.includes('BRYTH') ||
      vendor.includes('SBAS') ||
      vendor.includes('TOUKON') ||
      vendor.includes('NARVAEZ')
    );
  }

  return rawType === cleanFilter;
}

/**
 * Checks if a record matches Package filter (Column AC: PACKAGE)
 */
export function matchesPackage(record: JORecord, selectedPackage: string): boolean {
  if (!selectedPackage || selectedPackage === 'All' || selectedPackage === 'ALL' || selectedPackage === 'All Packages' || selectedPackage === 'Total') {
    return true;
  }
  const cleanFilter = selectedPackage.trim().toUpperCase();
  const cleanCategory = (record.category || '').trim().toUpperCase();
  const cleanPkgName = (record.packageName || '').trim().toUpperCase();

  if (cleanFilter === 'FIBERX') {
    return cleanCategory === 'FIBERX' || cleanPkgName === 'FIBERX' || cleanPkgName.startsWith('FIBERX') || cleanPkgName.includes('FIBERX');
  }
  if (cleanFilter === 'SME') {
    return (
      cleanCategory === 'SME' ||
      cleanPkgName === 'SME' ||
      cleanPkgName.includes('SME') ||
      cleanPkgName.includes('BIZ') ||
      cleanPkgName.includes('FAST') ||
      cleanPkgName.includes('ENTERPRISE')
    );
  }
  if (cleanFilter === 'BIDA') {
    return cleanCategory === 'BIDA' || cleanPkgName === 'BIDA' || cleanPkgName.includes('BIDA');
  }
  if (cleanFilter === 'S2S' || cleanFilter === 'SURF2SAWA') {
    return (
      cleanCategory === 'S2S' ||
      cleanPkgName === 'S2S' ||
      cleanPkgName.includes('S2S') ||
      cleanPkgName.includes('SURF2SAWA') ||
      cleanPkgName.includes('SURF')
    );
  }

  if (cleanCategory === cleanFilter) return true;
  if (cleanPkgName === cleanFilter || cleanPkgName.includes(cleanFilter)) return true;
  return false;
}

/**
 * Format a Date object into the standard Closed On display: DD-Mmm-YYYY (e.g., 01-Sep-2026, 15-Sep-2026)
 */
export function formatClosedOnDisplay(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthStr = monthAbbrs[date.getMonth()] || 'Sep';
  return `${day}-${monthStr}-${date.getFullYear()}`;
}

/**
 * Generates the equivalent Google Sheets formula string for verification
 * =COUNTIFS('JO ACTIVATED'!G:G,"ALBAY",'JO ACTIVATED'!S:S,"INHOUSE",'JO ACTIVATED'!AC:AC,"FIBERX",'JO ACTIVATED'!AF:AF,DATE(2026,9,15))
 */
export function getSheetsCountifsFormula(
  selectedProvince: string,
  selectedSliType: string,
  selectedPackage: string,
  selectedDate: Date | string
): string {
  const target = normalizeDate(selectedDate);
  const provCriteria = selectedProvince === 'All districts' ? '' : `'JO ACTIVATED'!G:G,"${selectedProvince.toUpperCase()}",`;
  const sliCriteria = selectedSliType === 'All' || selectedSliType === 'All SLI Types' ? '' : `'JO ACTIVATED'!S:S,"${selectedSliType.toUpperCase()}",`;
  const pkgCriteria = selectedPackage === 'All' || selectedPackage === 'All Packages' ? '' : `'JO ACTIVATED'!AC:AC,"${selectedPackage.toUpperCase()}",`;
  const dateStr = target
    ? `DATE(${target.getFullYear()},${target.getMonth() + 1},${target.getDate()})`
    : `"${selectedDate}"`;

  return `=COUNTIFS(${provCriteria}${sliCriteria}${pkgCriteria}'JO ACTIVATED'!AF:AF,${dateStr})`;
}

/**
 * Generates the equivalent Google Sheets SUMIFS formula for Total MRC verification
 * =SUMIFS('JO ACTIVATED'!AE:AE,'JO ACTIVATED'!G:G,"ALBAY",'JO ACTIVATED'!S:S,"INHOUSE",'JO ACTIVATED'!AC:AC,"FIBERX",'JO ACTIVATED'!AF:AF,DATE(2026,9,15))
 */
export function getSheetsSumifsFormula(
  selectedProvince: string,
  selectedSliType: string,
  selectedPackage: string,
  selectedDate: Date | string
): string {
  const target = normalizeDate(selectedDate);
  const provCriteria = selectedProvince === 'All districts' ? '' : `,'JO ACTIVATED'!G:G,"${selectedProvince.toUpperCase()}"`;
  const sliCriteria = selectedSliType === 'All' || selectedSliType === 'All SLI Types' ? '' : `,'JO ACTIVATED'!S:S,"${selectedSliType.toUpperCase()}"`;
  const pkgCriteria = selectedPackage === 'All' || selectedPackage === 'All Packages' ? '' : `,'JO ACTIVATED'!AC:AC,"${selectedPackage.toUpperCase()}"`;
  const dateStr = target
    ? `DATE(${target.getFullYear()},${target.getMonth() + 1},${target.getDate()})`
    : `"${selectedDate}"`;

  return `=SUMIFS('JO ACTIVATED'!AE:AE,'JO ACTIVATED'!AF:AF,${dateStr}${provCriteria}${sliCriteria}${pkgCriteria})`;
}

/**
 * Specific Date Count Function:
 * Counts rows where:
 *   STATEORPROVINCE = selected province
 *   AND SLI TYPE = selected SLI type
 *   AND PACKAGE = selected package
 *   AND CLOSING DATE = selected date
 *
 * Notice: CLOSING DATE (Column AF) is the authoritative source!
 */
export function countActivatedForDate(
  rows: JORecord[],
  selectedDate: Date | string,
  selectedProvince: string = 'All districts',
  selectedSliType: string = 'All',
  selectedPackage: string = 'All'
): number {
  const target = normalizeDate(selectedDate);
  if (!target) return 0;

  return rows.filter((row) => {
    // Column AF: CLOSING DATE is the authoritative date
    const closingDate = normalizeDate(row.closingDate || row.activationDate);
    if (!closingDate) return false;

    const sameDate =
      closingDate.getFullYear() === target.getFullYear() &&
      closingDate.getMonth() === target.getMonth() &&
      closingDate.getDate() === target.getDate();

    if (!sameDate) return false;

    if (!matchesProvince(row, selectedProvince)) return false;
    if (!matchesSliType(row, selectedSliType)) return false;
    if (!matchesPackage(row, selectedPackage)) return false;

    return true;
  }).length;
}

/**
 * Entire Month Count Function:
 * Counts rows where:
 *   STATEORPROVINCE = selected province
 *   AND SLI TYPE = selected SLI type
 *   AND PACKAGE = selected package
 *   AND CLOSING DATE >= firstDayOfMonth
 *   AND CLOSING DATE <= lastDayOfMonth
 */
export function countActivatedForMonth(
  rows: JORecord[],
  selectedYear: number,
  selectedMonth: number,
  selectedProvince: string = 'All districts',
  selectedSliType: string = 'All',
  selectedPackage: string = 'All'
): number {
  return rows.filter((row) => {
    // Column AF: CLOSING DATE is authoritative
    const closingDate = normalizeDate(row.closingDate || row.activationDate);
    if (!closingDate) return false;

    if (closingDate.getFullYear() !== selectedYear) return false;
    if (closingDate.getMonth() !== selectedMonth) return false;

    if (!matchesProvince(row, selectedProvince)) return false;
    if (!matchesSliType(row, selectedSliType)) return false;
    if (!matchesPackage(row, selectedPackage)) return false;

    return true;
  }).length;
}

/**
 * Filter rows for a specific date
 */
export function filterRecordsForDate(
  rows: JORecord[],
  selectedDate: Date | string,
  selectedProvince: string = 'All districts',
  selectedSliType: string = 'All',
  selectedPackage: string = 'All'
): JORecord[] {
  const target = normalizeDate(selectedDate);
  if (!target) return [];

  return rows.filter((row) => {
    const closingDate = normalizeDate(row.closingDate || row.activationDate);
    if (!closingDate) return false;

    const sameDate =
      closingDate.getFullYear() === target.getFullYear() &&
      closingDate.getMonth() === target.getMonth() &&
      closingDate.getDate() === target.getDate();

    if (!sameDate) return false;

    if (!matchesProvince(row, selectedProvince)) return false;
    if (!matchesSliType(row, selectedSliType)) return false;
    if (!matchesPackage(row, selectedPackage)) return false;

    return true;
  });
}

/**
 * Filter rows for an entire month
 */
export function filterRecordsForMonth(
  rows: JORecord[],
  selectedYear: number,
  selectedMonth: number,
  selectedProvince: string = 'All districts',
  selectedSliType: string = 'All',
  selectedPackage: string = 'All'
): JORecord[] {
  return rows.filter((row) => {
    const closingDate = normalizeDate(row.closingDate || row.activationDate);
    if (!closingDate) return false;

    if (closingDate.getFullYear() !== selectedYear) return false;
    if (closingDate.getMonth() !== selectedMonth) return false;

    if (!matchesProvince(row, selectedProvince)) return false;
    if (!matchesSliType(row, selectedSliType)) return false;
    if (!matchesPackage(row, selectedPackage)) return false;

    return true;
  });
}

/**
 * Sums MRC amounts (Col AE: MRC) for a specific date
 */
export function sumAmountForDate(
  rows: JORecord[],
  selectedDate: Date | string,
  selectedProvince: string = 'All districts',
  selectedSliType: string = 'All',
  selectedPackage: string = 'All'
): number {
  const records = filterRecordsForDate(rows, selectedDate, selectedProvince, selectedSliType, selectedPackage);
  return records.reduce((sum, r) => sum + (r.amount || 0), 0);
}

/**
 * Sums MRC amounts (Col AE: MRC) for an entire month
 */
export function sumAmountForMonth(
  rows: JORecord[],
  selectedYear: number,
  selectedMonth: number,
  selectedProvince: string = 'All districts',
  selectedSliType: string = 'All',
  selectedPackage: string = 'All'
): number {
  const records = filterRecordsForMonth(rows, selectedYear, selectedMonth, selectedProvince, selectedSliType, selectedPackage);
  return records.reduce((sum, r) => sum + (r.amount || 0), 0);
}
