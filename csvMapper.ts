import { JORecord, Province, SliType, PackageCategory } from '../types';
import { normalizeVendorName } from './calculations';
import { normalizeDate, formatIsoDate } from './dateCountingEngine';

const cleanKey = (val: any): string => {
  return String(val || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Maps raw rows parsed by PapaParse (from Google Sheet CSV)
 * into typed JORecord objects compatible with the Almasor Dashboard.
 *
 * Handles both:
 * 1. Array of objects (when PapaParse is run with { header: true })
 * 2. 2D array of rows (when PapaParse is run with { header: false } or raw array)
 *
 * Intelligently skips empty rows, Google Sheet padding rows, subtotal rows,
 * and header repeats, ensuring identical metrics to manual Excel upload.
 */
export function mapCsvRowsToJORecords(rows: any[]): JORecord[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // If rows is a 2D array (array of arrays), find best header row first
  const is2DArray = Array.isArray(rows[0]);

  if (is2DArray) {
    return map2DArrayToJORecords(rows as any[][]);
  }

  // Otherwise, handle array of row objects
  return mapObjectRowsToJORecords(rows);
}

function mapObjectRowsToJORecords(rows: any[]): JORecord[] {
  const validRecords: JORecord[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (!row || typeof row !== 'object') continue;

    // Exact match first, then fallback substring match
    const findVal = (exactMatches: string[], fallbackKeywords: string[] = []): string => {
      const keys = Object.keys(row);
      // 1. Exact match pass
      for (const em of exactMatches) {
        for (const k of keys) {
          const cleanK = cleanKey(k);
          if (cleanK === em) {
            const val = row[k];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              return String(val).trim();
            }
          }
        }
      }
      // 2. Substring fallback pass
      for (const kw of fallbackKeywords) {
        for (const k of keys) {
          const cleanK = cleanKey(k);
          if (cleanK.includes(kw)) {
            const val = row[k];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
              return String(val).trim();
            }
          }
        }
      }
      return '';
    };

    // Column G: STATEORPROVINCE
    const provRaw = findVal(['stateorprovince', 'province', 'state'], ['province']);
    // Column S: SLI TYPE (Channel)
    const sliTypeRaw = findVal(['slitype', 'channel'], ['slitype']);
    // Column AA: MONTH ACTIVATED
    const monthRaw = findVal(['monthactivated', 'month', 'activationmonth'], ['month']);
    // Column AC: PACKAGE
    const pkgRaw = findVal(['package', 'packagename'], ['pkg']);
    // Column AE: MRC (Exact match for MRC takes priority over PVI MRC or Amount Remitted)
    const mrcRaw = findVal(['mrc', 'monthlyrecurringcharge'], ['mrc']) || findVal(['amount', 'revenue'], []);
    // Column AF: CLOSING DATE (determines activation date)
    const closingDateRaw = findVal(['closingdate', 'closedate', 'dateclosed', 'closeddate'], ['closing']) || findVal(['jodate', 'activationdate', 'date'], ['date']);
    
    // Auxiliary fields
    const vendorRaw = findVal(['vendorname', 'vendor', 'contractor', 'wfmsliname', 'sliname'], ['vendor']);
    const joNumRaw = findVal(['jono', 'jonumber', 'jo#', 'orderid', 'jo'], ['jono']);
    const cityRaw = findVal(['city', 'municipality'], ['city']);
    const brgyRaw = findVal(['barangayname', 'barangay', 'brgy'], ['brgy']);
    const joDateRaw = findVal(['jodate', 'activationdate', 'date'], ['date']);
    const crewRaw = findVal(['crew', 'installer', 'slisystemcheck'], ['crew']);
    const slaRaw = findVal(['sla', 'ageingdays', 'aging', 'delay'], ['sla']);

    // 1. Strict Empty Row Filter:
    // In published Google Sheets, trailing rows often contain empty strings or whitespace.
    // If a row lacks both package AND JO number, or lacks province, package, AND vendor, it is padding.
    const hasAnyCoreData = Boolean(pkgRaw || joNumRaw || (provRaw && vendorRaw));
    if (!hasAnyCoreData) {
      continue;
    }

    // Check if all non-empty values in the object are just whitespace or empty
    const values = Object.values(row).map((v) => String(v || '').trim());
    const nonEmptyCount = values.filter((v) => v.length > 0).length;
    if (nonEmptyCount === 0) {
      continue;
    }

    // 2. Skip header row repeats
    const provUpper = provRaw.toUpperCase().trim();
    const pkgUpper = pkgRaw.toUpperCase().trim();
    const vendorUpper = vendorRaw.toUpperCase().trim();
    const joNumUpper = joNumRaw.toUpperCase().trim();

    if (
      provUpper === 'STATEORPROVINCE' ||
      provUpper === 'PROVINCE' ||
      provUpper === 'STATE' ||
      pkgUpper === 'PACKAGE' ||
      pkgUpper === 'PACKAGENAME' ||
      pkgUpper === 'PLAN' ||
      vendorUpper === 'VENDOR' ||
      vendorUpper === 'VENDORNAME' ||
      joNumUpper === 'JONO' ||
      joNumUpper === 'JO NUMBER'
    ) {
      continue;
    }

    // 3. Skip summary / subtotal rows
    if (
      provUpper.startsWith('TOTAL') ||
      provUpper.startsWith('GRAND TOTAL') ||
      provUpper.startsWith('SUBTOTAL') ||
      provUpper.startsWith('COUNT') ||
      provUpper.startsWith('SUM') ||
      vendorUpper.startsWith('TOTAL') ||
      joNumUpper.startsWith('TOTAL') ||
      pkgUpper.startsWith('TOTAL')
    ) {
      continue;
    }

    // 4. Province classification: SORSOGON, ALBAY, MASBATE
    let province: Province = 'ALBAY';
    if (provUpper.includes('SORSOGON') || provUpper.includes('SOR')) {
      province = 'SORSOGON';
    } else if (provUpper.includes('MASBATE') || provUpper.includes('MAS')) {
      province = 'MASBATE';
    } else if (provUpper.includes('ALBAY') || provUpper.includes('ALB') || provUpper.includes('LEGAZPI')) {
      province = 'ALBAY';
    } else {
      const cityUpper = cityRaw.toUpperCase();
      if (cityUpper.includes('SORSOGON')) province = 'SORSOGON';
      else if (cityUpper.includes('MASBATE')) province = 'MASBATE';
      else province = 'ALBAY';
    }

    // 5. Channel / SLI TYPE classification: INHOUSE or MSA
    let sliType: SliType = 'INHOUSE';
    const sliTypeUpper = sliTypeRaw.toUpperCase();
    if (sliTypeUpper.includes('INHOUSE') || sliTypeUpper.includes('IN-HOUSE') || sliTypeUpper.includes('INTERNAL')) {
      sliType = 'INHOUSE';
    } else if (
      sliTypeUpper.includes('MSA') ||
      sliTypeUpper.includes('OUTSOURCE') ||
      sliTypeUpper.includes('DEALER') ||
      sliTypeUpper.includes('AGENT') ||
      sliTypeUpper.includes('STORE') ||
      sliTypeUpper.includes('ENTERPRISE')
    ) {
      sliType = 'MSA';
    } else {
      if (vendorUpper.includes('INHOUSE')) {
        sliType = 'INHOUSE';
      } else if (
        vendorUpper.includes('STORE') ||
        vendorUpper.includes('ENTERPRISE') ||
        vendorUpper.includes('NARVAEZ') ||
        vendorUpper.includes('DOMINGUIANO')
      ) {
        sliType = 'MSA';
      } else {
        sliType = 'INHOUSE';
      }
    }

    // 6. Vendor Canonical Normalization
    const resolvedVendor = normalizeVendorName(vendorRaw, sliType);

    // Determine vendorType accurately
    let vendorType: SliType = sliType;
    const vUpper = resolvedVendor.toUpperCase();
    if (
      vUpper.includes('INHOUSE') ||
      vUpper.includes('TELEDIGI') ||
      vUpper.includes('ONLINE APPLICATION') ||
      vUpper.includes('RAVENOUS')
    ) {
      vendorType = 'INHOUSE';
    } else if (
      vUpper.includes('STORE') ||
      vUpper.includes('ENTERPRISE') ||
      vUpper.includes('NARVAEZ') ||
      vUpper.includes('DOMINGUIANO') ||
      vUpper.includes('SERAPH') ||
      vUpper.includes('BRYTH') ||
      vUpper.includes('SBAS') ||
      vUpper.includes('TOUKON')
    ) {
      vendorType = 'MSA';
    }

    // 7. Package Category classification: FIBERX, SME, BIDA, S2S
    let category: PackageCategory = 'FIBERX';
    if (
      pkgUpper.includes('BIZ') ||
      pkgUpper.includes('SME') ||
      pkgUpper.includes('MICRO') ||
      pkgUpper.includes('ENTERPRISE') ||
      pkgUpper.includes('BUSINESS')
    ) {
      category = 'SME';
    } else if (pkgUpper.includes('BIDA')) {
      category = 'BIDA';
    } else if (pkgUpper.includes('S2S') || pkgUpper.includes('SURF')) {
      category = 'S2S';
    } else {
      category = 'FIBERX';
    }

    // 8. MRC / Amount parsing
    const cleanMrcNum = parseFloat(mrcRaw.replace(/[^0-9.]/g, '')) || 0;
    let amount: number | undefined = undefined;
    if (cleanMrcNum > 0) {
      amount = cleanMrcNum;
    } else if (category === 'SME') {
      const match = pkgRaw.match(/\d{4,5}/);
      amount = match ? parseInt(match[0], 10) : 3500;
    } else if (category === 'FIBERX') {
      amount = 1500;
    } else if (category === 'BIDA') {
      amount = 888;
    } else {
      amount = 700;
    }

    // 9. SLA Hours
    let slaHours = 24;
    const slaLower = slaRaw.toLowerCase();
    if (slaLower.includes('beyond') || slaLower.includes('140') || slaLower.includes('144')) slaHours = 144;
    else if (slaLower.includes('48')) slaHours = 48;
    else if (slaLower.includes('72') || slaLower.includes('3 days')) slaHours = 72;

    const joNumber = joNumRaw || `R37${40000 + idx}`;
    const city =
      cityRaw ||
      (province === 'ALBAY'
        ? 'CITY OF LEGAZPI'
        : province === 'SORSOGON'
        ? 'CITY OF SORSOGON'
        : 'CITY OF MASBATE');
    const barangay = brgyRaw || 'Central';
    const joDate = joDateRaw || '2026-09-14';

    validRecords.push({
      id: `gsheet-${idx}-${Date.now()}`,
      joNumber,
      stateOrProvince: province,
      city,
      barangayName: barangay,
      packageName: pkgRaw || (category === 'FIBERX' ? 'FIBERX 1500' : category === 'SME' ? 'SME' : 'BIDA FIBER 888'),
      category,
      napCode: `${province.substring(0, 3)}001`,
      napPort: 'P1-O',
      crew: crewRaw || (vendorType === 'INHOUSE' ? 'RV069-' : 'RV115-'),
      cpeSerialNo: `48575443${String(idx).padStart(4, '0')}`,
      agentCode: `${resolvedVendor} Rep`,
      sliSystemCheckCrewCode: resolvedVendor,
      sli: resolvedVendor,
      sliType: sliType, // Column S (SLI TYPE) is authoritative!
      vendor: resolvedVendor,
      vendorType,
      activationDate: joDate,
      closingDate: closingDateRaw || joDate,
      monthActivated: monthRaw || 'September',
      status: 'Activated',
      amount,
      slaHours,
    });
  }

  return validRecords;
}

/**
 * Handles 2D array parsing (e.g. PapaParse with header: false)
 */
function map2DArrayToJORecords(rawRows: any[][]): JORecord[] {
  if (rawRows.length === 0) return [];

  // Find header row by scoring
  let bestHeaderRowIdx = 0;
  let highestMatchScore = -1;
  const maxScan = Math.min(10, rawRows.length);

  for (let rIdx = 0; rIdx < maxScan; rIdx++) {
    const row = rawRows[rIdx];
    if (!Array.isArray(row)) continue;

    let score = 0;
    row.forEach((cell) => {
      const cleaned = cleanKey(cell);
      if (cleaned.includes('stateorprovince') || cleaned === 'province' || cleaned === 'state') score += 4;
      if (cleaned === 'package' || cleaned === 'packagename' || cleaned.includes('pkg') || cleaned === 'plan') score += 4;
      if (cleaned.includes('slitype') || cleaned === 'channel' || cleaned === 'vendortype') score += 3;
      if (cleaned === 'vendor' || cleaned === 'vendorname') score += 3;
      if (cleaned === 'mrc' || cleaned === 'amount' || cleaned.includes('revenue')) score += 3;
      if (cleaned.includes('jono') || cleaned.includes('jonumber')) score += 2;
    });

    if (score > highestMatchScore) {
      highestMatchScore = score;
      bestHeaderRowIdx = rIdx;
    }
  }

  const headerRow = rawRows[bestHeaderRowIdx] || [];
  const findCol = (predicate: (k: string) => boolean, fallbackIdx: number): number => {
    for (let c = 0; c < headerRow.length; c++) {
      const cleaned = cleanKey(headerRow[c]);
      if (cleaned && predicate(cleaned)) return c;
    }
    return fallbackIdx;
  };

  // Exactly matching Converge Sheet columns:
  // Col G (idx 6): STATEORPROVINCE
  // Col S (idx 18): SLI TYPE
  // Col AA (idx 26): MONTH ACTIVATED
  // Col AC (idx 28): PACKAGE
  // Col AE (idx 30): MRC
  const provCol = findCol((k) => k === 'stateorprovince' || k === 'province' || k === 'state', 6);
  const sliTypeCol = findCol((k) => (k === 'slitype' || k === 'channel') && !k.includes('vendor'), 18);
  const vendorCol = findCol((k) => k === 'vendor' || k === 'vendorname', 19);
  const monthCol = findCol((k) => k === 'monthactivated' || k === 'month', 26);
  const pkgCol = findCol((k) => k === 'package' || k === 'packagename', 28);
  const mrcCol = findCol((k) => k === 'mrc', 30);
  const joNumCol = findCol((k) => k.includes('jono') || k.includes('jonumber'), 0);
  const joDateCol = findCol((k) => k.includes('jodate') || k === 'date' || k.includes('activation'), 21);
  const closingDateCol = findCol((k) => k.includes('closingdate') || k.includes('closedate') || k.includes('closing') || k.includes('dateclosed'), 31);
  const cityCol = findCol((k) => k === 'city' || k === 'municipality', 4);
  const brgyCol = findCol((k) => k === 'barangay' || k.includes('brgy'), 3);
  const crewCol = findCol((k) => k.includes('crew') || k.includes('slisystemcheck'), 18);

  const getCellStr = (cell: any): string => (cell !== null && cell !== undefined ? String(cell).trim() : '');

  const mapped: JORecord[] = [];

  for (let rIdx = bestHeaderRowIdx + 1; rIdx < rawRows.length; rIdx++) {
    const row = rawRows[rIdx];
    if (!Array.isArray(row) || row.length === 0) continue;

    const provRaw = getCellStr(row[provCol]);
    const pkgRaw = getCellStr(row[pkgCol]);
    const vendorRaw = getCellStr(row[vendorCol]);
    const sliTypeRaw = getCellStr(row[sliTypeCol]);
    const monthRaw = getCellStr(row[monthCol]);
    const joNumRaw = getCellStr(row[joNumCol]);
    const mrcRaw = getCellStr(row[mrcCol]);
    const joDateRaw = getCellStr(row[joDateCol]);
    const closingDateRaw = getCellStr(row[closingDateCol]) || joDateRaw;
    const cityRaw = getCellStr(row[cityCol]);
    const brgyRaw = getCellStr(row[brgyCol]);
    const crewRaw = getCellStr(row[crewCol]);

    // Skip empty rows
    if (!pkgRaw && !joNumRaw && !provRaw && !vendorRaw) continue;

    const provUpper = provRaw.toUpperCase().trim();
    const pkgUpper = pkgRaw.toUpperCase().trim();
    const vendorUpper = vendorRaw.toUpperCase().trim();
    const joNumUpper = joNumRaw.toUpperCase().trim();

    if (
      provUpper === 'STATEORPROVINCE' ||
      provUpper === 'PROVINCE' ||
      pkgUpper === 'PACKAGE' ||
      vendorUpper === 'VENDOR' ||
      joNumUpper === 'JONO'
    ) {
      continue;
    }

    if (
      provUpper.startsWith('TOTAL') ||
      provUpper.startsWith('SUBTOTAL') ||
      provUpper.startsWith('GRAND TOTAL') ||
      vendorUpper.startsWith('TOTAL')
    ) {
      continue;
    }

    // Column G: STATEORPROVINCE
    let province: Province = 'ALBAY';
    if (provUpper.includes('SORSOGON') || provUpper.includes('SOR')) {
      province = 'SORSOGON';
    } else if (provUpper.includes('MASBATE') || provUpper.includes('MAS')) {
      province = 'MASBATE';
    } else {
      province = 'ALBAY';
    }

    // Column S: SLI TYPE (Authoritative Channel)
    let sliType: SliType = 'INHOUSE';
    const sliTypeUpper = sliTypeRaw.toUpperCase().trim();
    if (sliTypeUpper === 'MSA' || sliTypeUpper.includes('MSA') || sliTypeUpper.includes('OUTSOURCE') || sliTypeUpper.includes('DEALER')) {
      sliType = 'MSA';
    } else {
      sliType = 'INHOUSE';
    }

    const resolvedVendor = normalizeVendorName(vendorRaw, sliType);
    let vendorType: SliType = sliType;
    const vUpper = resolvedVendor.toUpperCase();
    if (
      vUpper.includes('INHOUSE') ||
      vUpper.includes('TELEDIGI') ||
      vUpper.includes('ONLINE APPLICATION')
    ) {
      vendorType = 'INHOUSE';
    } else if (
      vUpper.includes('STORE') ||
      vUpper.includes('ENTERPRISE') ||
      vUpper.includes('NARVAEZ') ||
      vUpper.includes('DOMINGUIANO')
    ) {
      vendorType = 'MSA';
    }

    // Column AC: PACKAGE
    let category: PackageCategory = 'FIBERX';
    if (
      pkgUpper === 'SME' ||
      pkgUpper.includes('BIZ') ||
      pkgUpper.includes('SME') ||
      pkgUpper.includes('MICRO') ||
      pkgUpper.includes('BUSINESS')
    ) {
      category = 'SME';
    } else if (pkgUpper.includes('BIDA')) {
      category = 'BIDA';
    } else if (pkgUpper.includes('S2S')) {
      category = 'S2S';
    }

    // Column AE: MRC
    const cleanMrcNum = parseFloat(mrcRaw.replace(/[^0-9.]/g, '')) || 0;
    let amount: number | undefined = cleanMrcNum > 0 ? cleanMrcNum : category === 'SME' ? 2500 : 1500;

    mapped.push({
      id: `gsheet-2d-${rIdx}-${Date.now()}`,
      joNumber: joNumRaw || `R37${40000 + rIdx}`,
      stateOrProvince: province,
      city: cityRaw || (province === 'ALBAY' ? 'CITY OF LEGAZPI' : province === 'SORSOGON' ? 'CITY OF SORSOGON' : 'CITY OF MASBATE'),
      barangayName: brgyRaw || 'Central',
      packageName: pkgRaw || (category === 'FIBERX' ? 'FIBERX 1500' : category === 'SME' ? 'SME' : 'BIDA FIBER 888'),
      category,
      napCode: `${province.substring(0, 3)}001`,
      napPort: 'P1-O',
      crew: crewRaw || (vendorType === 'INHOUSE' ? 'RV069-' : 'RV115-'),
      cpeSerialNo: `48575443${String(rIdx).padStart(4, '0')}`,
      agentCode: `${resolvedVendor} Rep`,
      sliSystemCheckCrewCode: resolvedVendor,
      sli: resolvedVendor,
      sliType: sliType, // Column S (SLI TYPE) is authoritative!
      vendor: resolvedVendor,
      vendorType,
      activationDate: joDateRaw || '2026-09-14',
      closingDate: closingDateRaw || joDateRaw || '2026-09-14',
      monthActivated: monthRaw || 'September',
      status: 'Activated',
      amount,
      slaHours: 24,
    });
  }

  return mapped;
}

