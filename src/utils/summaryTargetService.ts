import { JORecord, Province, SliType, SummaryProvinceTargets, SummarySheetTargets } from '../types';
import { normalizeDate } from './dateCountingEngine';

/**
 * Default monthly targets corresponding to the "SUMMARY" sheet
 * Column D = FIBERX
 * Column E = SME (MRC monetary value)
 * Column F = BIDA
 *
 * Cell references:
 * ALBAY:    D11 (FiberX), E11 (SME), F11 (BIDA)
 * SORSOGON: D17 (FiberX), E17 (SME), F17 (BIDA)
 * MASBATE:  D23 (FiberX), E23 (SME), F23 (BIDA)
 * OVERALL:  D29 (FiberX), E29 (SME), F29 (BIDA)
 */
export const DEFAULT_SUMMARY_TARGETS: SummarySheetTargets = {
  monthKey: 'SEPTEMBER',
  reportingMonth: 'September 2026',
  albay: {
    fiberXTarget: 467,
    smeMonthlyTarget: 71993,
    bidaMonthlyTarget: 82,
  },
  sorsogon: {
    fiberXTarget: 189,
    smeMonthlyTarget: 59354,
    bidaMonthlyTarget: 21,
  },
  masbate: {
    fiberXTarget: 203,
    smeMonthlyTarget: 5161,
    bidaMonthlyTarget: 10,
  },
  overall: {
    fiberXTarget: 859,
    smeMonthlyTarget: 136508,
    bidaMonthlyTarget: 113,
  },
  rawCells: {
    'SUMMARY!D11': 467,
    'SUMMARY!E11': 71993,
    'SUMMARY!F11': 82,
    'SUMMARY!D17': 189,
    'SUMMARY!E17': 59354,
    'SUMMARY!F17': 21,
    'SUMMARY!D23': 203,
    'SUMMARY!E23': 5161,
    'SUMMARY!F23': 10,
    'SUMMARY!D29': 859,
    'SUMMARY!E29': 136508,
    'SUMMARY!F29': 113,
  },
};

/**
 * Clean and parse a numeric cell value from spreadsheet raw cells.
 * Handles strings with currency symbols (₱, $, etc.), commas, and formula results.
 */
export function parseNumericCell(val: any, fallback: number = 0): number {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val).trim();
  const cleaned = str.replace(/[^0-9.-]+/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? fallback : num;
}

/**
 * Retrieves targets dynamically for the selected Province from the active Summary targets.
 *
 * Mapping rules:
 * - If Province = "All districts" or "ALL" or "OVERALL":
 *     fiberXTarget = SUMMARY!D29
 *     smeTarget    = SUMMARY!E29
 *     bidaTarget   = SUMMARY!F29
 * - If Province = "Albay":
 *     fiberXTarget = SUMMARY!D11
 *     smeTarget    = SUMMARY!E11
 *     bidaTarget   = SUMMARY!F11
 * - If Province = "Sorsogon":
 *     fiberXTarget = SUMMARY!D17
 *     smeTarget    = SUMMARY!E17
 *     bidaTarget   = SUMMARY!F17
 * - If Province = "Masbate":
 *     fiberXTarget = SUMMARY!D23
 *     smeTarget    = SUMMARY!E23
 *     bidaTarget   = SUMMARY!F23
 */
export function getTargetsForProvince(
  targets: SummarySheetTargets,
  province: string | undefined
): SummaryProvinceTargets {
  if (!province) return targets.overall;
  const pNorm = province.trim().toUpperCase();

  if (pNorm.includes('ALBAY') || pNorm.includes('ALB')) {
    return targets.albay;
  }
  if (pNorm.includes('SORSOGON') || pNorm.includes('SOR')) {
    return targets.sorsogon;
  }
  if (pNorm.includes('MASBATE') || pNorm.includes('MAS')) {
    return targets.masbate;
  }

  // "All districts" or overall
  return targets.overall;
}

/**
 * Dynamically parses the "SUMMARY" worksheet from an imported XLSX workbook.
 * Maps exact cell references:
 * ALBAY:    D11, E11, F11
 * SORSOGON: D17, E17, F17
 * MASBATE:  D23, E23, F23
 * OVERALL:  D29, E29, F29
 */
export function parseSummaryWorksheet(
  worksheet: any,
  reportingMonth?: string
): SummarySheetTargets | null {
  if (!worksheet) return null;

  const rawCells: Record<string, number | string> = {};

  const getCell = (colLetter: string, rowNumber: number): any => {
    const address = `${colLetter}${rowNumber}`;
    const cell = worksheet[address];
    if (cell !== undefined && cell.v !== undefined) {
      return cell.v;
    }
    return undefined;
  };

  // 1. Attempt direct cell reading
  let d11 = getCell('D', 11);
  let e11 = getCell('E', 11);
  let f11 = getCell('F', 11);

  let d17 = getCell('D', 17);
  let e17 = getCell('E', 17);
  let f17 = getCell('F', 17);

  let d23 = getCell('D', 23);
  let e23 = getCell('E', 23);
  let f23 = getCell('F', 23);

  let d29 = getCell('D', 29);
  let e29 = getCell('E', 29);
  let f29 = getCell('F', 29);

  // Fallback: If direct cell access yielded nothing, try 2D array matrix access
  if (d11 === undefined && worksheet['!ref']) {
    // Read cells via sheet rows if available
    const rangeStr = worksheet['!ref'];
    // Try lowercase or standard keys
  }

  // Parse values with fallback to default targets if a single cell is empty
  const albayFiberX = parseNumericCell(d11, DEFAULT_SUMMARY_TARGETS.albay.fiberXTarget);
  const albaySme = parseNumericCell(e11, DEFAULT_SUMMARY_TARGETS.albay.smeMonthlyTarget);
  const albayBida = parseNumericCell(f11, DEFAULT_SUMMARY_TARGETS.albay.bidaMonthlyTarget);

  const sorsogonFiberX = parseNumericCell(d17, DEFAULT_SUMMARY_TARGETS.sorsogon.fiberXTarget);
  const sorsogonSme = parseNumericCell(e17, DEFAULT_SUMMARY_TARGETS.sorsogon.smeMonthlyTarget);
  const sorsogonBida = parseNumericCell(f17, DEFAULT_SUMMARY_TARGETS.sorsogon.bidaMonthlyTarget);

  const masbateFiberX = parseNumericCell(d23, DEFAULT_SUMMARY_TARGETS.masbate.fiberXTarget);
  const masbateSme = parseNumericCell(e23, DEFAULT_SUMMARY_TARGETS.masbate.smeMonthlyTarget);
  const masbateBida = parseNumericCell(f23, DEFAULT_SUMMARY_TARGETS.masbate.bidaMonthlyTarget);

  const overallFiberX = parseNumericCell(
    d29,
    albayFiberX + sorsogonFiberX + masbateFiberX || DEFAULT_SUMMARY_TARGETS.overall.fiberXTarget
  );
  const overallSme = parseNumericCell(
    e29,
    albaySme + sorsogonSme + masbateSme || DEFAULT_SUMMARY_TARGETS.overall.smeMonthlyTarget
  );
  const overallBida = parseNumericCell(
    f29,
    albayBida + sorsogonBida + masbateBida || DEFAULT_SUMMARY_TARGETS.overall.bidaMonthlyTarget
  );

  rawCells['SUMMARY!D11'] = albayFiberX;
  rawCells['SUMMARY!E11'] = albaySme;
  rawCells['SUMMARY!F11'] = albayBida;

  rawCells['SUMMARY!D17'] = sorsogonFiberX;
  rawCells['SUMMARY!E17'] = sorsogonSme;
  rawCells['SUMMARY!F17'] = sorsogonBida;

  rawCells['SUMMARY!D23'] = masbateFiberX;
  rawCells['SUMMARY!E23'] = masbateSme;
  rawCells['SUMMARY!F23'] = masbateBida;

  rawCells['SUMMARY!D29'] = overallFiberX;
  rawCells['SUMMARY!E29'] = overallSme;
  rawCells['SUMMARY!F29'] = overallBida;

  return {
    monthKey: reportingMonth?.toUpperCase() || 'CURRENT',
    reportingMonth: reportingMonth || 'Dynamic Period',
    albay: {
      fiberXTarget: albayFiberX,
      smeMonthlyTarget: albaySme,
      bidaMonthlyTarget: albayBida,
    },
    sorsogon: {
      fiberXTarget: sorsogonFiberX,
      smeMonthlyTarget: sorsogonSme,
      bidaMonthlyTarget: sorsogonBida,
    },
    masbate: {
      fiberXTarget: masbateFiberX,
      smeMonthlyTarget: masbateSme,
      bidaMonthlyTarget: masbateBida,
    },
    overall: {
      fiberXTarget: overallFiberX,
      smeMonthlyTarget: overallSme,
      bidaMonthlyTarget: overallBida,
    },
    rawCells,
  };
}

/**
 * Filter helpers
 */
function matchProvince(recordProvince: string | undefined, filterProvince: string): boolean {
  if (!filterProvince || filterProvince === 'All districts' || filterProvince === 'ALL') {
    return true;
  }
  const rNorm = (recordProvince || '').trim().toUpperCase();
  const fNorm = filterProvince.trim().toUpperCase();
  return rNorm === fNorm;
}

function matchSliType(recordSliType: string | undefined, filterSliType: string): boolean {
  if (!filterSliType || filterSliType === 'All' || filterSliType === 'All SLI Types' || filterSliType === 'ALL') {
    return true;
  }
  const rNorm = (recordSliType || '').trim().toUpperCase();
  const fNorm = filterSliType.trim().toUpperCase();
  return rNorm === fNorm;
}

function isPackage(packageName: string | undefined, targetCategory: string): boolean {
  if (!packageName) return false;
  const norm = packageName.trim().toUpperCase().replace(/\s+/g, '');
  return norm.includes(targetCategory);
}

/**
 * FIBERX RUNNING:
 * Cumulative FIBERX JO count from the first day of the selected month
 * through each date (up to upToDay, or full month if upToDay is null).
 * Uses Column AF (CLOSING DATE).
 */
export function calculateFiberXRunning(
  records: JORecord[],
  selectedYear: number,
  selectedMonth: number,
  upToDay: number | null,
  province: string,
  sliType: string
): number {
  return records.filter((r) => {
    if (!isPackage(r.packageName, 'FIBERX')) return false;
    if (!matchProvince(r.stateOrProvince, province)) return false;
    if (!matchSliType(r.sliType, sliType)) return false;

    const cd = normalizeDate(r.closingDate || r.activationDate);
    if (!cd) return false;
    if (cd.getFullYear() !== selectedYear || cd.getMonth() !== selectedMonth) return false;

    if (upToDay !== null && cd.getDate() > upToDay) return false;
    return true;
  }).length;
}

/**
 * SME RUNNING:
 * Cumulative SUM of MRC (Column AE) for rows where:
 * PACKAGE = SME
 * and CLOSING DATE is within the selected month
 * and CLOSING DATE <= current chart date.
 * (Do NOT count SME rows as the SME performance value).
 */
export function calculateSmeRunningMrc(
  records: JORecord[],
  selectedYear: number,
  selectedMonth: number,
  upToDay: number | null,
  province: string,
  sliType: string
): number {
  return records
    .filter((r) => {
      if (!isPackage(r.packageName, 'SME') && r.category !== 'SME') return false;
      if (!matchProvince(r.stateOrProvince, province)) return false;
      if (!matchSliType(r.sliType, sliType)) return false;

      const cd = normalizeDate(r.closingDate || r.activationDate);
      if (!cd) return false;
      if (cd.getFullYear() !== selectedYear || cd.getMonth() !== selectedMonth) return false;

      if (upToDay !== null && cd.getDate() > upToDay) return false;
      return true;
    })
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

/**
 * BIDA RUNNING:
 * Cumulative COUNT of rows where:
 * PACKAGE = BIDA
 * and CLOSING DATE is within the selected month
 * and CLOSING DATE <= current chart date.
 */
export function calculateBidaRunning(
  records: JORecord[],
  selectedYear: number,
  selectedMonth: number,
  upToDay: number | null,
  province: string,
  sliType: string
): number {
  return records.filter((r) => {
    if (!isPackage(r.packageName, 'BIDA') && r.category !== 'BIDA') return false;
    if (!matchProvince(r.stateOrProvince, province)) return false;
    if (!matchSliType(r.sliType, sliType)) return false;

    const cd = normalizeDate(r.closingDate || r.activationDate);
    if (!cd) return false;
    if (cd.getFullYear() !== selectedYear || cd.getMonth() !== selectedMonth) return false;

    if (upToDay !== null && cd.getDate() > upToDay) return false;
    return true;
  }).length;
}
