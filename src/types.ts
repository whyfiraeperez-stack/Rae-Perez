export type Province = 'ALBAY' | 'SORSOGON' | 'MASBATE';
export type SliType = 'INHOUSE' | 'MSA';
export type PackageCategory = 'FIBERX' | 'SME' | 'BIDA' | 'S2S';

export interface JORecord {
  id: string;
  joNumber: string;
  stateOrProvince: Province;
  city: string;
  barangayName: string;
  packageName: string;
  category: PackageCategory;
  napCode: string;
  napPort: string;
  crew: string;
  cpeSerialNo: string;
  agentCode: string;
  sliSystemCheckCrewCode: string;
  sli: string;
  sliType: SliType;
  vendor: string;
  vendorType: SliType;
  activationDate: string; // YYYY-MM-DD
  closingDate?: string; // Column AF: CLOSING DATE (determines activation/closing date)
  status: 'Activated' | 'For Activation' | 'For Closeout';
  amount?: number; // for SME packages (Col AE: MRC)
  monthActivated?: string; // Col AA: MONTH ACTIVATED
  slaHours?: number; // e.g. 18, 36, 72, 140
}

export interface VendorSummary {
  vendor: string;
  vendorType: SliType;
  fiberX: number;
  sme: number;
  bida: number;
  s2s: number;
  total: number;
  share: number; // percentage
}

export interface SummaryProvinceTargets {
  fiberXTarget: number;
  smeMonthlyTarget: number;
  bidaMonthlyTarget: number;
}

export interface SummarySheetTargets {
  monthKey?: string;
  reportingMonth?: string;
  albay: SummaryProvinceTargets;
  sorsogon: SummaryProvinceTargets;
  masbate: SummaryProvinceTargets;
  overall: SummaryProvinceTargets;
  rawCells?: Record<string, number | string>;
}

export interface TerritoryTarget {
  province: Province;
  sliType: SliType;
  fiberXActual: number;
  fiberXTarget: number;
  smeActual: number;
  smeTarget: number;
  bidaActual: number;
  bidaTarget: number;
  s2sActual: number;
  s2sTarget: number;
}

export interface DailyMetrics {
  reportDate: string;
  daysElapsed: number;
  daysInMonth: number;
  activatedYesterday: number;
  activatedToday: number;
  fsoi: number;
  openJOsCloseout: number;
  openJOsActivation: number;
}

export interface SyncSourceInfo {
  fileName: string;
  sheetName?: string;
  sourceUrl?: string;
  isGoogleSheet?: boolean;
  importedAt?: string;
  lastSyncTime?: string;
  rowCount?: number;
  totalRecords?: number;
  fiberXCount?: number;
  smeCount?: number;
  bidaCount?: number;
  s2sCount?: number;
  smeAmountVatInc?: number;
  albayCount?: number;
  sorsogonCount?: number;
  masbateCount?: number;
  inhouseCount?: number;
  msaCount?: number;
  isScreenshotSample?: boolean;
}

export type DashboardMetrics = import('./utils/calculations').SummaryAggregates;

export type ParsedJO = {
  joNumber: string;
  province: string;
  sli: string;
  sliType: string;
  vendorType: string;
  package: string;
  mrc: number;
  vatExMrc: number;
  sla: string;
  closingDate: Date;
  mrcVatEx?: number;
};

export interface Targets {
  fiberX: number;
  sme: number;
  bida: number;
  s2s?: number;
}

export interface OperationalStatus {
  asOfText: string;
  fsoi: number;
  forCloseout: number;
  forActivation: number;
}

export interface DailyReportAlmasor {
  reportLabel: string;
  fiberYesterday: string;
  fiberToday: string;
  fsoi: string;
  forCloseout: string;
  forActivation: string;
  fiberMTD: string;
  smeVatIncMTD: string;
  smeVatExMTD: string;
  bidaMTD: string;
  s2sMTD: string;
  fiberRunrate: string;
  smeVatIncRunrate: string;
  smeVatExRunrate: string;
  bidaRunrate: string;
  s2sRunrate: string;
}

export interface SliPivotDetailRow {
  sliType: 'INHOUSE' | 'MSA';
  sli: string;
  province: string;
  fiberX: number;
  sme: number;
  bida: number;
  total: number;
}

export interface SliPivotGroup {
  key: string;
  name: string;
  sliType: 'INHOUSE' | 'MSA';
  provinces: string[];
  provinceDisplay: string;
  fiberX: number;
  sme: number;
  bida: number;
  total: number;
  share: number;
}
