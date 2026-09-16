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

/**
 * Robust date normalizer supporting:
 * - Day-Month-Year (e.g. "14-09-2026", "01-09-2026", "14/09/2026", "14.09.2026")
 * - Year-Month-Day (e.g. "2026-09-14", "2026/09/14")
 * - English text (e.g. "September 14, 2026", "14 Sep 2026")
 * - Excel numeric serial numbers (e.g. ~46280)
 * - Native Date objects
 */
export function normalizeDate(value: any): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  // Handle Excel serial date numbers (e.g. 46280)
  if (
    typeof value === 'number' ||
    (!isNaN(Number(value)) && !String(value).includes('-') && !String(value).includes('/') && !String(value).includes('.'))
  ) {
    const num = Number(value);
    if (num > 20000 && num < 80000) {
      // Excel epoch: Dec 30 1899 due to the 1900 leap-year bug
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const msPerDay = 24 * 60 * 60 * 1000;
      const d = new Date(excelEpoch.getTime() + num * msPerDay);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
  }

  const str = String(value).trim();
  if (!str) return null;

  // 1. Day-Month-Year format: DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
  // E.g. "14-09-2026" or "01-09-2026"
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(.*)$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
      return d;
    }
  }

  // 2. Year-Month-Day format: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime()) && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year) {
      return d;
    }
  }

  // 3. English month string parsing: "September 14, 2026" or "14 Sep 2026"
  const parsed = new Date(str);
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
function matchesProvince(record: JORecord, selectedProvince: string): boolean {
  if (!selectedProvince || selectedProvince === 'All districts' || selectedProvince === 'ALL' || selectedProvince === 'All') {
    return true;
  }
  const cleanFilter = selectedProvince.trim().toUpperCase();
  const cleanRecordProv = (record.stateOrProvince || '').trim().toUpperCase();
  return cleanRecordProv === cleanFilter;
}

/**
 * Checks if a record matches SLI Type filter (Column S: SLI TYPE)
 */
function matchesSliType(record: JORecord, selectedSliType: string): boolean {
  if (!selectedSliType || selectedSliType === 'All' || selectedSliType === 'ALL' || selectedSliType === 'All SLI Types') {
    return true;
  }
  const cleanFilter = selectedSliType.trim().toUpperCase();
  const cleanRecordSli = (record.sliType || '').trim().toUpperCase();
  return cleanRecordSli === cleanFilter;
}

/**
 * Checks if a record matches Package filter (Column AC: PACKAGE)
 */
function matchesPackage(record: JORecord, selectedPackage: string): boolean {
  if (!selectedPackage || selectedPackage === 'All' || selectedPackage === 'ALL' || selectedPackage === 'All Packages' || selectedPackage === 'Total') {
    return true;
  }
  const cleanFilter = selectedPackage.trim().toUpperCase();
  const cleanCategory = (record.category || '').trim().toUpperCase();
  const cleanPkgName = (record.packageName || '').trim().toUpperCase();

  if (cleanCategory === cleanFilter) return true;
  if (cleanPkgName.includes(cleanFilter)) return true;
  return false;
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
