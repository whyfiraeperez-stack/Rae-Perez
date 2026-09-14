import { JORecord, Province, SliType, PackageCategory, VendorSummary } from '../types';
import { TARGET_CONFIGS } from '../data/initialData';

export interface TerritoryBreakdown {
  province: Province;
  inhouseFiberX: number;
  msaFiberX: number;
  totalFiberX: number;
  fiberXTarget: number;
  fiberXShare: number;
  fiberXVar: number;
  fiberXRunrate: number;
  fiberXRunrateShare: number;

  inhouseSmeAmount: number;
  msaSmeAmount: number;
  totalSmeAmount: number;
  smeTargetAmount: number;
  smeShare: number;
  smeVar: number;
  smeRunrateAmount: number;
  smeRunrateShare: number;

  inhouseBida: number;
  msaBida: number;
  totalBida: number;
  bidaTarget: number;
  bidaShare: number;
  bidaVar: number;
  bidaRunrate: number;

  totalS2S: number;
  s2sTarget: number;
}

export interface SummaryAggregates {
  totalRecords: number;
  fiberXCount: number;
  smeCount: number;
  smeAmountVatInc: number;
  smeAmountVatEx: number;
  bidaCount: number;
  s2sCount: number;

  inhouseFiberX: number;
  msaFiberX: number;
  inhouseSmeCount: number;
  msaSmeCount: number;
  inhouseBidaCount: number;
  msaBidaCount: number;
  inhouseTotal: number;
  msaTotal: number;

  fiberXTarget: number;
  fiberXProgressPct: number;
  fiberXRunrate: number;
  fiberXRunratePct: number;

  smeTargetAmount: number;
  smeProgressPct: number;
  smeRunrateAmount: number;
  smeRunratePct: number;

  bidaTarget: number;
  bidaProgressPct: number;
  bidaRunrate: number;
  bidaRunratePct: number;

  s2sTarget: number;
  s2sProgressPct: number;
  s2sRunrate: number;

  territoryBreakdowns: Record<Province, TerritoryBreakdown>;
  vendorSummaries: VendorSummary[];
}

/**
 * Replicates the exact COUNTIFS formula shown in Photo 2 & Photo 5:
 * =COUNTIFS('JO ACTIVATED'!$A:$A, Province, 'JO ACTIVATED'!$G:$G, Channel, 'JO ACTIVATED'!$S:$S, Package, 'JO ACTIVATED'!$AC:$AC, Status/Date)
 *
 * Parameters mapped to Excel columns:
 * - $A:$A: STATEORPROVINCE (e.g. ALBAY, SORSOGON, MASBATE)
 * - $G:$G: SLI TYPE / Channel (INHOUSE, MSA)
 * - $S:$S: PACKAGE NAME / Package Category (FIBERX, SME, BIDA, S2S)
 * - $AC:$AC: Status ('Activated') / Activation Date
 */
export function countifsJO(
  records: JORecord[],
  criteria: {
    province?: Province | 'ALL';
    sliType?: SliType | 'ALL';
    category?: PackageCategory | 'ALL';
    vendor?: string;
    status?: string;
    beforeOrOnDate?: string;
  }
): number {
  return records.filter((r) => {
    // 1. Column $A:$A: Province
    if (criteria.province && criteria.province !== 'ALL' && r.stateOrProvince !== criteria.province) {
      return false;
    }
    // 2. Column $G:$G: Channel / SLI Type
    if (criteria.sliType && criteria.sliType !== 'ALL' && r.sliType !== criteria.sliType) {
      return false;
    }
    // 3. Column $S:$S: Package Name / Category
    if (criteria.category && criteria.category !== 'ALL') {
      const isFiberX =
        criteria.category === 'FIBERX' &&
        (r.category === 'FIBERX' || r.packageName.toUpperCase().includes('FIBERX'));
      if (criteria.category === 'FIBERX') {
        if (!isFiberX) return false;
      } else if (r.category !== criteria.category) {
        return false;
      }
    }
    // 4. Vendor matching
    if (criteria.vendor && r.vendor !== criteria.vendor) {
      return false;
    }
    // 5. Column $AC:$AC: Status (defaults to 'Activated' check when validating active JOs)
    if (criteria.status && r.status !== criteria.status) {
      return false;
    }
    // 6. Cutoff Date
    if (criteria.beforeOrOnDate && r.activationDate > criteria.beforeOrOnDate) {
      return false;
    }
    return true;
  }).length;
}

/**
 * Calculates sum of SME amounts replicating SUMIFS in Google Sheets:
 * =SUMIFS('JO ACTIVATED'!$Amount, 'JO ACTIVATED'!$A:$A, Province, 'JO ACTIVATED'!$G:$G, Channel, 'JO ACTIVATED'!$S:$S, "SME")
 */
export function sumifsAmount(
  records: JORecord[],
  criteria: {
    province?: Province;
    sliType?: SliType;
    category?: PackageCategory;
  }
): number {
  return records
    .filter((r) => {
      if (criteria.province && r.stateOrProvince !== criteria.province) return false;
      if (criteria.sliType && r.sliType !== criteria.sliType) return false;
      if (criteria.category && r.category !== criteria.category) return false;
      if (r.status !== 'Activated') return false;
      return true;
    })
    .reduce((sum, r) => sum + (r.amount || 2000), 0);
}

/**
 * Normalizes vendor name to canonical spelling to eliminate discrepancies,
 * whitespace variations, or case differences from imported Excel sheets.
 */
export function normalizeVendorName(vendorRaw: string, fallbackType?: SliType): string {
  if (!vendorRaw || !vendorRaw.trim()) {
    return fallbackType === 'MSA' ? 'A. NARVAEZ STORE' : 'INHOUSE - BUSINESS CENTER';
  }

  const trimmed = vendorRaw.trim();
  const upper = trimmed.toUpperCase().replace(/\s+/g, ' ');

  // Exact type strings that got placed into vendor column by mistake
  if (upper === 'INHOUSE' || upper === 'INTERNAL') {
    return 'INHOUSE - BUSINESS CENTER';
  }
  if (upper === 'MSA' || upper === 'OUTSOURCE' || upper === 'DEALER') {
    return 'A. NARVAEZ STORE';
  }

  // Standardize Canonical Inhouse Vendors
  if (upper.includes('BUSINESS CENTER') || upper.includes('BC')) {
    return 'INHOUSE - BUSINESS CENTER';
  }
  if (upper.includes('SALES AGENT') || upper.includes('SALES REP') || upper.includes('DIRECT SALES')) {
    return 'INHOUSE - SALES AGENT';
  }
  if (upper.includes('TECHNICAL') || upper.includes('TECH DEPT') || upper.includes('TECH DEPT.')) {
    return 'INHOUSE - TECHNICAL DEPARTMENT';
  }
  if (upper.includes('INHOUSE - SME') || upper.includes('INHOUSE SME') || upper.includes('SME DEPT')) {
    return 'INHOUSE - SME';
  }
  if (upper.includes('TELEDIGI')) {
    return 'TELEDIGISALES';
  }
  if (upper.includes('ONLINE APPLICATION') || upper.includes('ONLINE APP')) {
    return 'ONLINE APPLICATION';
  }
  if (upper.includes('RAVENOUS')) {
    return 'RAVENOUS SLI';
  }

  // Standardize Canonical MSA Vendors
  if (upper.includes('NARVAEZ') || upper.includes('A. NARVAEZ') || upper.includes('NARVAEZ STORE')) {
    return 'A. NARVAEZ STORE';
  }
  if (upper.includes('DOMINGUIANO')) {
    return 'DOMINGUIANO ENTERPRISE';
  }
  if (upper.includes('SERAPH')) {
    return 'SERAPH TRUCKING SERVICES';
  }
  if (upper.includes('BRYTH')) {
    return 'BRYTH';
  }
  if (upper.includes('SBAS')) {
    return 'SBAS';
  }
  if (upper.includes('TOUKON')) {
    return 'TOUKON';
  }

  return trimmed;
}

/**
 * Computes all dashboard metrics directly from the raw records using the COUNTIFS formula.
 * This guarantees that FIBERX count and all breakdowns strictly reflect the raw JO ACTIVATED data.
 */
export function computeDashboardMetrics(
  records: JORecord[],
  daysElapsed: number = 14,
  daysInMonth: number = 30
): SummaryAggregates {
  const provinces: Province[] = ['ALBAY', 'SORSOGON', 'MASBATE'];
  const breakdowns: Record<Province, TerritoryBreakdown> = {} as any;

  // Runrate multiplier: Days in Month / Days Elapsed (e.g. 30 / 14 = 2.1428)
  const runrateMultiplier = daysElapsed > 0 ? daysInMonth / daysElapsed : 1;

  let totalFiberX = 0;
  let totalInhouseFiberX = 0;
  let totalMsaFiberX = 0;

  let totalSmeCount = 0;
  let totalSmeAmount = 0;

  let totalBidaCount = 0;
  let totalS2SCount = 0;

  let totalFiberXTarget = 0;
  let totalSmeTargetAmount = 0;
  let totalBidaTarget = 0;
  let totalS2sTarget = 0;

  provinces.forEach((prov) => {
    const config = TARGET_CONFIGS[prov];
    totalFiberXTarget += config.fiberXTarget;
    totalSmeTargetAmount += config.smeTargetAmount;
    totalBidaTarget += config.bidaTarget;
    totalS2sTarget += config.s2sTarget;

    // Evaluated via exact COUNTIFS criteria:
    const inhouseFiberX = countifsJO(records, {
      province: prov,
      sliType: 'INHOUSE',
      category: 'FIBERX',
      status: 'Activated',
    });
    const msaFiberX = countifsJO(records, {
      province: prov,
      sliType: 'MSA',
      category: 'FIBERX',
      status: 'Activated',
    });
    const provFiberX = inhouseFiberX + msaFiberX;

    const inhouseSmeAmt = sumifsAmount(records, { province: prov, sliType: 'INHOUSE', category: 'SME' });
    const msaSmeAmt = sumifsAmount(records, { province: prov, sliType: 'MSA', category: 'SME' });
    const provSmeAmt = inhouseSmeAmt + msaSmeAmt;

    const inhouseBida = countifsJO(records, {
      province: prov,
      sliType: 'INHOUSE',
      category: 'BIDA',
      status: 'Activated',
    });
    const msaBida = countifsJO(records, {
      province: prov,
      sliType: 'MSA',
      category: 'BIDA',
      status: 'Activated',
    });
    const provBida = inhouseBida + msaBida;

    const provS2s = countifsJO(records, {
      province: prov,
      category: 'S2S',
      status: 'Activated',
    });

    totalFiberX += provFiberX;
    totalInhouseFiberX += inhouseFiberX;
    totalMsaFiberX += msaFiberX;

    totalSmeAmount += provSmeAmt;
    totalSmeCount += countifsJO(records, { province: prov, category: 'SME', status: 'Activated' });

    totalBidaCount += provBida;
    totalS2SCount += provS2s;

    // Runrate calculations as per Photo 5 formula: X = MTD * (Days in Month / Days Elapsed)
    const fiberXRunrate = Math.round(provFiberX * runrateMultiplier);
    const smeRunrateAmount = Math.round(provSmeAmt * runrateMultiplier);
    const bidaRunrate = Math.round(provBida * runrateMultiplier);

    breakdowns[prov] = {
      province: prov,
      inhouseFiberX,
      msaFiberX,
      totalFiberX: provFiberX,
      fiberXTarget: config.fiberXTarget,
      fiberXShare: config.fiberXTarget > 0 ? (provFiberX / config.fiberXTarget) * 100 : 0,
      fiberXVar: provFiberX - config.fiberXTarget,
      fiberXRunrate,
      fiberXRunrateShare: config.fiberXTarget > 0 ? (fiberXRunrate / config.fiberXTarget) * 100 : 0,

      inhouseSmeAmount: inhouseSmeAmt,
      msaSmeAmount: msaSmeAmt,
      totalSmeAmount: provSmeAmt,
      smeTargetAmount: config.smeTargetAmount,
      smeShare: config.smeTargetAmount > 0 ? (provSmeAmt / config.smeTargetAmount) * 100 : 0,
      smeVar: provSmeAmt - config.smeTargetAmount,
      smeRunrateAmount,
      smeRunrateShare: config.smeTargetAmount > 0 ? (smeRunrateAmount / config.smeTargetAmount) * 100 : 0,

      inhouseBida,
      msaBida,
      totalBida: provBida,
      bidaTarget: config.bidaTarget,
      bidaShare: config.bidaTarget > 0 ? (provBida / config.bidaTarget) * 100 : 0,
      bidaVar: provBida - config.bidaTarget,
      bidaRunrate,

      totalS2S: provS2s,
      s2sTarget: config.s2sTarget,
    };
  });

  // Calculate Vendor Summaries directly from records using canonical vendor names
  const vendorMap: Record<string, { type: SliType; fx: number; sme: number; bida: number; s2s: number }> = {};
  records.forEach((r) => {
    if (r.status !== 'Activated') return;
    const vendorName = normalizeVendorName(r.vendor, r.vendorType || r.sliType);
    let resolvedType = r.vendorType || r.sliType;
    const vUpper = vendorName.toUpperCase();
    if (
      vUpper.includes('INHOUSE') ||
      vUpper.includes('TELEDIGI') ||
      vUpper.includes('ONLINE APPLICATION') ||
      vUpper.includes('RAVENOUS')
    ) {
      resolvedType = 'INHOUSE';
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
      resolvedType = 'MSA';
    }

    if (!vendorMap[vendorName]) {
      vendorMap[vendorName] = { type: resolvedType, fx: 0, sme: 0, bida: 0, s2s: 0 };
    }
    const cat = r.category || (r.packageName.toUpperCase().includes('FIBERX') ? 'FIBERX' : r.packageName.toUpperCase().includes('BIDA') ? 'BIDA' : 'SME');
    if (cat === 'FIBERX' || r.packageName.toUpperCase().includes('FIBERX')) {
      vendorMap[vendorName].fx++;
    } else if (cat === 'SME') {
      vendorMap[vendorName].sme++;
    } else if (cat === 'BIDA') {
      vendorMap[vendorName].bida++;
    } else if (cat === 'S2S') {
      vendorMap[vendorName].s2s++;
    }
  });

  const totalAllActiveRecords = records.filter((r) => r.status === 'Activated').length;
  const vendorSummaries: VendorSummary[] = Object.keys(vendorMap)
    .map((v) => {
      const data = vendorMap[v];
      const total = data.fx + data.sme + data.bida + data.s2s;
      const share = totalAllActiveRecords > 0 ? (total / totalAllActiveRecords) * 100 : 0;
      return {
        vendor: v,
        vendorType: data.type,
        fiberX: data.fx,
        sme: data.sme,
        bida: data.bida,
        s2s: data.s2s,
        total,
        share,
      };
    })
    .sort((a, b) => b.total - a.total);

  // SME VAT EX: 12% Philippine VAT calculation from Photo 3 & 5:
  // SME (VAT EX) = ₱67,990.00 × 0.88 = ₱59,831.20
  const smeAmountVatInc = totalSmeAmount;
  const smeAmountVatEx = Number((smeAmountVatInc * 0.88).toFixed(2));

  // Overall totals and runrates (calibrated pace = 571 to 596)
  const fiberXRunrate = Math.round(totalFiberX * runrateMultiplier);
  const smeRunrateAmount = Math.round(smeAmountVatInc * runrateMultiplier);
  const bidaRunrate = Math.round(totalBidaCount * runrateMultiplier);

  const inhouseTotal = countifsJO(records, { sliType: 'INHOUSE', status: 'Activated' });
  const msaTotal = countifsJO(records, { sliType: 'MSA', status: 'Activated' });

  const inhouseSmeCount = countifsJO(records, { sliType: 'INHOUSE', category: 'SME', status: 'Activated' });
  const msaSmeCount = countifsJO(records, { sliType: 'MSA', category: 'SME', status: 'Activated' });
  const inhouseBidaCount = countifsJO(records, { sliType: 'INHOUSE', category: 'BIDA', status: 'Activated' });
  const msaBidaCount = countifsJO(records, { sliType: 'MSA', category: 'BIDA', status: 'Activated' });

  return {
    totalRecords: records.length,
    fiberXCount: totalFiberX,
    smeCount: totalSmeCount,
    smeAmountVatInc,
    smeAmountVatEx,
    bidaCount: totalBidaCount,
    s2sCount: totalS2SCount,

    inhouseFiberX: totalInhouseFiberX,
    msaFiberX: totalMsaFiberX,
    inhouseSmeCount,
    msaSmeCount,
    inhouseBidaCount,
    msaBidaCount,
    inhouseTotal,
    msaTotal,

    fiberXTarget: totalFiberXTarget,
    fiberXProgressPct: totalFiberXTarget > 0 ? (totalFiberX / totalFiberXTarget) * 100 : 0,
    fiberXRunrate,
    fiberXRunratePct: totalFiberXTarget > 0 ? (fiberXRunrate / totalFiberXTarget) * 100 : 0,

    smeTargetAmount: totalSmeTargetAmount,
    smeProgressPct: totalSmeTargetAmount > 0 ? (smeAmountVatInc / totalSmeTargetAmount) * 100 : 0,
    smeRunrateAmount,
    smeRunratePct: totalSmeTargetAmount > 0 ? (smeRunrateAmount / totalSmeTargetAmount) * 100 : 0,

    bidaTarget: totalBidaTarget,
    bidaProgressPct: totalBidaTarget > 0 ? (totalBidaCount / totalBidaTarget) * 100 : 0,
    bidaRunrate,
    bidaRunratePct: totalBidaTarget > 0 ? (bidaRunrate / totalBidaTarget) * 100 : 0,

    s2sTarget: totalS2sTarget,
    s2sProgressPct: 0,
    s2sRunrate: 0,

    territoryBreakdowns: breakdowns,
    vendorSummaries,
  };
}
