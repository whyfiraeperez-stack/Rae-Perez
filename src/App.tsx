import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as XLSX from "xlsx";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

import { MtdVsTargetAlmasor } from "./components/MtdVsTargetAlmasor";
import { MtdVsTargetProvince } from "./components/MtdVsTargetProvince";
import { TotalClosedTables } from "./components/TotalClosedTables";
import { SlaPerformanceSection } from "./components/SlaPerformanceSection";
import { DailySLIReport } from "./components/DailySLIReport";
import { TopPerformingSliSection } from "./components/TopPerformingSliSection";
import { DailyReportAlmasor, OperationalStatus, ParsedJO, Targets, SliPivotDetailRow } from "./types";
import { DEFAULT_DAILY_REPORT, fetchDailyReportAlmasor } from "./utils/dailyReport";
import {
  fetchSliActivationPivot,
  parseSliActivationPivotTable,
  getSliPivotTabName,
} from "./services/sliPivotService";
import liveCacheFallback from "./data/live_sheets_cache.json";

/* =========================================================
   CONFIGURATION
========================================================= */

const GOOGLE_SHEET_ID =
  "17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg";

const GOOGLE_SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`;

const DEFAULT_TARGETS_MAP: Record<string, Targets> = {
  Albay: { fiberX: 467, sme: 71993, bida: 82, s2s: 572 },
  Sorsogon: { fiberX: 189, sme: 59354, bida: 21, s2s: 169 },
  Masbate: { fiberX: 203, sme: 5161, bida: 10, s2s: 41 },
  "All districts": { fiberX: 859, sme: 136508, bida: 113, s2s: 782 },
  ALBAY: { fiberX: 467, sme: 71993, bida: 82, s2s: 572 },
  SORSOGON: { fiberX: 189, sme: 59354, bida: 21, s2s: 169 },
  MASBATE: { fiberX: 203, sme: 5161, bida: 10, s2s: 41 },
  ALMASOR: { fiberX: 859, sme: 136508, bida: 113, s2s: 782 },
};

/*
  Live refresh interval: 60 seconds.
*/
const LIVE_REFRESH_MS = 60_000;

/*
  Initial/default reporting month.
*/
const DEFAULT_MONTH = "2026-09";

/*
  Dashboard filters.
*/
const PROVINCES = [
  "All districts",
  "Albay",
  "Sorsogon",
  "Masbate",
];

const SLI_TYPES = [
  "All SLI Types",
  "INHOUSE",
  "MSA",
];

const PACKAGES = [
  "All Packages",
  "FiberX",
  "SME",
  "BIDA",
];

/*
  SUMMARY target row mappings:
    Row 11 = ALBAY
    Row 17 = SORSOGON
    Row 23 = MASBATE
    Row 29 = ALMASOR / OVERALL

  Columns:
    D = FIBERX
    E = SME
    F = BIDA
*/
const TARGET_ROWS: Record<string, number> = {
  "All districts": 29,
  ALMASOR: 29,
  Albay: 11,
  ALBAY: 11,
  Sorsogon: 17,
  SORSOGON: 17,
  Masbate: 23,
  MASBATE: 23,
};

type RawRow = Record<string, any>;

type Filters = {
  month: string;
  province: string;
  sliType: string;
  package: string;
};

type LiveState = {
  sourceName: string;
  joRows: RawRow[];
  summaryRows: RawRow[];
  targetsMap: Record<string, Targets>;
  dailyReport: DailyReportAlmasor;
  dailyReportError: string;
  operationalStatus?: OperationalStatus;
  sliPivotRows?: SliPivotDetailRow[];
  sliPivotSource?: string;
  sliPivotAvailable?: boolean;
  lastSynced: Date | null;
  syncing: boolean;
  error: string;
};

/* =========================================================
   TEXT & CATEGORY NORMALIZATION
========================================================= */

function normalizeText(value: any): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function compactText(value: any): string {
  return normalizeText(value).replace(/\s/g, "");
}

function normalizeProvince(value: any): string {
  const norm = normalizeText(value);
  if (norm.includes("ALBAY")) return "ALBAY";
  if (norm.includes("SORSOGON")) return "SORSOGON";
  if (norm.includes("MASBATE")) return "MASBATE";
  return norm;
}

function normalizePackage(value: any): string {
  const valueText = compactText(value);

  if (valueText === "FIBERX" || valueText.startsWith("FIBERX")) {
    return "FIBERX";
  }

  if (valueText === "SME" || valueText.startsWith("SME")) {
    return "SME";
  }

  if (valueText === "BIDA" || valueText.startsWith("BIDA")) {
    return "BIDA";
  }

  if (valueText === "S2S" || valueText.startsWith("S2S")) {
    return "S2S";
  }

  return valueText;
}

/*
  SLI TYPE MUST COME ONLY FROM COLUMN S.
  Do NOT use Column U / VENDOR TYPE as a fallback.
  Valid SLI TYPE values: INHOUSE, MSA
*/
function normalizeSLI(row: RawRow): string {
  const sliType =
    String(
      row["SLI TYPE"] ?? row["S"] ?? ""
    )
      .trim()
      .toUpperCase();

  if (sliType === "INHOUSE") {
    return "INHOUSE";
  }

  if (sliType === "MSA") {
    return "MSA";
  }

  return "";
}

function normalizeVendorType(row: RawRow): string {
  const vendorType = normalizeText(getRowValue(row, "VENDOR TYPE", "U", "VENDORTYPE"));

  if (vendorType === "INHOUSE") return "INHOUSE";
  if (vendorType === "MSA") return "MSA";

  return vendorType;
}

/*
  Normalize SLA Column Y:
  Categories:
  - within 24 hrs
  - within 48 hrs
  - within 3 days
  - within 5 days
  - beyond 5 days
*/
function normalizeSLA(value: any): string {
  if (value === null || value === undefined) return "within 24 hrs";
  const raw = String(value).trim().toLowerCase();
  if (!raw) return "within 24 hrs";

  // Check beyond first
  if (raw.includes("beyond") || raw.includes("> 5") || raw.includes(">5")) {
    return "beyond 5 days";
  }

  if (
    raw.includes("within 24") ||
    raw.includes("24 hr") ||
    raw.includes("24hr") ||
    raw.includes("24 hour") ||
    raw.includes("24-hr") ||
    raw.includes("<= 24") ||
    raw === "24"
  ) {
    return "within 24 hrs";
  }

  if (
    raw.includes("within 48") ||
    raw.includes("48 hr") ||
    raw.includes("48hr") ||
    raw.includes("48 hour") ||
    raw.includes("48-hr") ||
    raw.includes("<= 48") ||
    raw === "48"
  ) {
    return "within 48 hrs";
  }

  if (
    raw.includes("within 3") ||
    raw.includes("3 day") ||
    raw.includes("3day") ||
    raw.includes("72 hr") ||
    raw.includes("72hr") ||
    raw.includes("72 hour") ||
    raw === "72"
  ) {
    return "within 3 days";
  }

  if (
    raw.includes("within 5") ||
    raw.includes("5 day") ||
    raw.includes("5day") ||
    raw.includes("120 hr") ||
    raw.includes("120hr") ||
    raw.includes("120 hour") ||
    raw === "120"
  ) {
    return "within 5 days";
  }

  // Pure numeric fallback (hours or days)
  const num = Number(raw.replace(/[^\d.]/g, ""));
  if (!isNaN(num) && num > 0) {
    if (num <= 1) return "within 24 hrs";
    if (num <= 2) return "within 48 hrs";
    if (num <= 3) return "within 3 days";
    if (num <= 5) return "within 5 days";
    if (num <= 24) return "within 24 hrs";
    if (num <= 48) return "within 48 hrs";
    if (num <= 72) return "within 3 days";
    if (num <= 120) return "within 5 days";
    return "beyond 5 days";
  }

  return "within 24 hrs";
}

/* =========================================================
   NUMBER & DATE NORMALIZATION
========================================================= */

function numberValue(value: any): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const cleaned = String(value)
    .replace(/₱/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  const result = Number(cleaned);

  return Number.isFinite(result) ? result : 0;
}

function parseDate(value: any): Date | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date && !isNaN(value.getTime())) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  const raw = String(value).trim();

  // Google Visualization API date: Date(2026,8,17)
  const googleDate = raw.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)$/);
  if (googleDate) {
    return new Date(
      Number(googleDate[1]),
      Number(googleDate[2]),
      Number(googleDate[3])
    );
  }

  // Excel serial number
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);
    if (serial > 20000 && serial < 80000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const milliseconds = serial * 24 * 60 * 60 * 1000;
      const date = new Date(excelEpoch.getTime() + milliseconds);
      return new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      );
    }
  }

  // DD-MMM-YYYY
  const dmyMonth = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmyMonth) {
    const date = new Date(`${dmyMonth[2]} ${dmyMonth[1]}, ${dmyMonth[3]}`);
    if (!isNaN(date.getTime())) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }
  }

  // MM/DD/YYYY
  const slashDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    return new Date(
      Number(slashDate[3]),
      Number(slashDate[1]) - 1,
      Number(slashDate[2])
    );
  }

  // YYYY-MM-DD
  const isoDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    return new Date(
      Number(isoDate[1]),
      Number(isoDate[2]) - 1,
      Number(isoDate[3])
    );
  }

  // Generic fallback
  const genericDate = new Date(raw);
  if (!isNaN(genericDate.getTime())) {
    return new Date(
      genericDate.getFullYear(),
      genericDate.getMonth(),
      genericDate.getDate()
    );
  }

  return null;
}

function monthKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
  ].join("-");
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatCount(value: number): string {
  return Math.round(numberValue(value)).toLocaleString("en-PH");
}

function formatPeso(value: number): string {
  return `₱${Math.round(numberValue(value)).toLocaleString("en-PH")}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value) || isNaN(value) || value <= 0) {
    return "0.00%";
  }
  return `${value.toFixed(2)}%`;
}

function calculatePercentage(actual: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) {
    return 0;
  }
  if (!Number.isFinite(actual) || actual <= 0) {
    return 0;
  }
  return (actual / target) * 100;
}

/* =========================================================
   GOOGLE SHEETS GVIZ FETCHERS
========================================================= */

function getRowValue(row: RawRow, ...keys: string[]): any {
  if (!row) return "";
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
    const lowerKey = key.toLowerCase().trim();
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase().trim() === lowerKey) {
        if (row[rowKey] !== undefined && row[rowKey] !== null && row[rowKey] !== "") {
          return row[rowKey];
        }
      }
    }
  }
  return "";
}

async function fetchGoogleSheet(sheetName: string, query: string): Promise<RawRow[]> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=${encodeURIComponent(sheetName)}` +
    `&tq=${encodeURIComponent(query)}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "text/plain" },
  });

  if (!response.ok) {
    throw new Error(`Unable to read ${sheetName}: HTTP ${response.status}`);
  }

  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    throw new Error(`Could not parse ${sheetName} from Google Sheets.`);
  }

  const json = JSON.parse(match[1]);
  if (json.status === "error") {
    throw new Error(
      json.errors?.[0]?.detailed_message ||
      json.errors?.[0]?.message ||
      `Google Sheets error: ${sheetName}`
    );
  }

  const table = json.table;
  const headers = table.cols.map(
    (column: any, index: number) =>
      column.label || column.id || `Column${index + 1}`
  );

  return table.rows.map((row: any) => {
    const record: RawRow = {};
    headers.forEach((header: string, index: number) => {
      record[header] = row.c?.[index]?.v ?? "";
    });
    return record;
  });
}

/*
  Fetch JO ACTIVATED with columns:
  A  = JO NUMBER
  G  = STATEORPROVINCE
  Q  = SLI
  S  = SLI TYPE
  U  = VENDOR TYPE
  Y  = SLA
  AC = PACKAGE
  AE = MRC
  AF = CLOSING DATE
  AU = VAT EX MRC
*/
async function fetchJOActivated(): Promise<RawRow[]> {
  const sheetName = "JO ACTIVATED";
  const query = "select A,G,Q,S,U,Y,AC,AE,AF,AU where A is not null";
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=${encodeURIComponent(sheetName)}` +
    `&tq=${encodeURIComponent(query)}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "text/plain" },
  });

  if (!response.ok) {
    throw new Error(`Unable to read ${sheetName}: HTTP ${response.status}`);
  }

  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    throw new Error(`Could not parse ${sheetName} from Google Sheets.`);
  }

  const json = JSON.parse(match[1]);
  if (json.status === "error") {
    throw new Error(
      json.errors?.[0]?.detailed_message ||
      json.errors?.[0]?.message ||
      `Google Sheets error: ${sheetName}`
    );
  }

  const table = json.table;
  return table.rows.map((row: any) => {
    const values = row.c || [];

    return {
      "JO NUMBER": values[0]?.v ?? "",
      "STATEORPROVINCE": values[1]?.v ?? "",
      "SLI": values[2]?.v ?? "",
      "SLI TYPE": values[3]?.v ?? "",
      "VENDOR TYPE": values[4]?.v ?? "",
      "SLA": values[5]?.v ?? "",
      "PACKAGE": values[6]?.v ?? "",
      "MRC": values[7]?.v ?? "",
      "CLOSING DATE": values[8]?.v ?? "",
      "VAT EX MRC": values[9]?.v ?? "",
      A: values[0]?.v ?? "",
      G: values[1]?.v ?? "",
      Q: values[2]?.v ?? "",
      S: values[3]?.v ?? "",
      U: values[4]?.v ?? "",
      Y: values[5]?.v ?? "",
      AC: values[6]?.v ?? "",
      AE: values[7]?.v ?? "",
      AF: values[8]?.v ?? "",
      AU: values[9]?.v ?? "",
    };
  });
}

/*
  Fetch SUMMARY rows for general matrix parsing and fallback.
*/
async function fetchSummary(): Promise<RawRow[]> {
  return fetchGoogleSheet("SUMMARY", `select B,C,D,E,F,G`);
}

/*
  Fetch single SUMMARY target row via exact range query.
  Row 11 = Albay
  Row 17 = Sorsogon
  Row 23 = Masbate
  Row 29 = Almasor / Overall
  Columns: D = FIBERX, E = SME, F = BIDA, G = S2S
*/
async function fetchSummaryTargetRow(rowNumber: number): Promise<Targets> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=SUMMARY` +
    `&range=D${rowNumber}:G${rowNumber}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: { Accept: "text/plain" },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch SUMMARY row ${rowNumber}: HTTP ${response.status}`);
  }

  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    throw new Error(`Could not parse SUMMARY row ${rowNumber}`);
  }

  const json = JSON.parse(match[1]);
  if (json.status === "error") {
    throw new Error(json.errors?.[0]?.message || `Error fetching SUMMARY row ${rowNumber}`);
  }

  const table = json.table;
  const firstRow = table?.rows?.[0]?.c || [];

  return {
    fiberX: Math.abs(numberValue(firstRow[0]?.v)),
    sme: Math.abs(numberValue(firstRow[1]?.v)),
    bida: Math.abs(numberValue(firstRow[2]?.v)),
    s2s: Math.abs(numberValue(firstRow[3]?.v)),
  };
}

/*
  Fetch all targets concurrently from live SUMMARY rows.
*/
async function fetchAllTargets(): Promise<Record<string, Targets>> {
  const [albay, sorsogon, masbate, overall] = await Promise.all([
    fetchSummaryTargetRow(11),
    fetchSummaryTargetRow(17),
    fetchSummaryTargetRow(23),
    fetchSummaryTargetRow(29),
  ]);

  return {
    Albay: albay,
    Sorsogon: sorsogon,
    Masbate: masbate,
    "All districts": overall,
    ALBAY: albay,
    SORSOGON: sorsogon,
    MASBATE: masbate,
    ALMASOR: overall,
  };
}

/*
  Parse targets from raw SUMMARY table rows (used as fallback or for Excel uploads).
*/
function parseTargetsFromSummaryRows(summaryRows: RawRow[]): Record<string, Targets> {
  const getProvinceTarget = (province: string): Targets => {
    const targetProvince = province === "All districts" ? "OVERALL" : normalizeProvince(province);
    let currentProvince = "";

    for (let i = 0; i < summaryRows.length; i++) {
      const row = summaryRows[i];
      const provLabel = normalizeProvince(getRowValue(row, "PROVINCE", "B"));
      if (provLabel) {
        currentProvince = provLabel;
      }

      const sliLabel = normalizeText(getRowValue(row, "SLI", "C"));
      if (sliLabel === "TARGET") {
        if (currentProvince === targetProvince) {
          return {
            fiberX: Math.abs(numberValue(getRowValue(row, "FIBERX", "D"))),
            sme: Math.abs(numberValue(getRowValue(row, "SME", "E"))),
            bida: Math.abs(numberValue(getRowValue(row, "BIDA", "F"))),
            s2s: Math.abs(numberValue(getRowValue(row, "S2S", "G"))),
          };
        }
      }
    }

    // Index-based fallback
    const rowNum = TARGET_ROWS[province];
    if (rowNum && summaryRows.length >= rowNum) {
      const candidate = summaryRows[rowNum - 1];
      if (candidate) {
        return {
          fiberX: Math.abs(numberValue(getRowValue(candidate, "FIBERX", "D"))),
          sme: Math.abs(numberValue(getRowValue(candidate, "SME", "E"))),
          bida: Math.abs(numberValue(getRowValue(candidate, "BIDA", "F"))),
          s2s: Math.abs(numberValue(getRowValue(candidate, "S2S", "G"))),
        };
      }
    }

    return { fiberX: 0, sme: 0, bida: 0, s2s: 0 };
  };

  const albay = getProvinceTarget("Albay");
  const sorsogon = getProvinceTarget("Sorsogon");
  const masbate = getProvinceTarget("Masbate");
  const overall = getProvinceTarget("All districts");

  return {
    Albay: albay,
    Sorsogon: sorsogon,
    Masbate: masbate,
    "All districts": overall,
    ALBAY: albay,
    SORSOGON: sorsogon,
    MASBATE: masbate,
    ALMASOR: overall,
  };
}

/* =========================================================
   PARSE JO RECORDS (UNIQUE JO NUMBER DE-DUPLICATION)
========================================================= */

export function uniqueByJoNumber(rows: ParsedJO[]): ParsedJO[] {
  const map = new Map<string, ParsedJO>();
  for (const row of rows) {
    if (!map.has(row.joNumber)) {
      map.set(row.joNumber, row);
    }
  }
  return Array.from(map.values());
}

function parseJORows(rawRows: RawRow[]): ParsedJO[] {
  const parsed: ParsedJO[] = [];

  for (const row of rawRows) {
    const joNumber = String(
      row["JO NUMBER"] ?? getRowValue(row, "JO NUMBER", "A", "JO NO", "JONUMBER")
    ).trim();

    if (!joNumber || joNumber === "JO NUMBER") {
      continue;
    }

    const closingDate = parseDate(
      row["CLOSING DATE"] ?? getRowValue(row, "CLOSING DATE", "AF", "ACTIVATION DATE")
    );

    if (!closingDate) {
      continue;
    }

    const packageName = normalizePackage(
      row["PACKAGE"] ?? getRowValue(row, "PACKAGE", "AC", "PACKAGE NAME")
    );

    if (
      packageName !== "FIBERX" &&
      packageName !== "SME" &&
      packageName !== "BIDA" &&
      packageName !== "S2S"
    ) {
      continue;
    }

    const rawSli = String(row["SLI"] ?? getRowValue(row, "SLI", "Q", "SLINAME") ?? "").trim();
    const sli = rawSli.replace(/\s+/g, " ");

    const rawMrc = numberValue(row["MRC"] ?? getRowValue(row, "MRC", "AE", "AMOUNT"));
    const rawMrcVatEx = numberValue(
      row["VAT EX MRC"] ??
      row["VAT EX"] ??
      row["MRC VAT EX"] ??
      getRowValue(row, "VAT EX MRC", "AU", "MRCVATEX", "VATEXMRC")
    );
    const vatExMrc = rawMrcVatEx || (rawMrc > 0 ? rawMrc / 1.12 : 0);

    const rawSla = String(row["SLA"] ?? getRowValue(row, "SLA", "Y", "Ageing", "Aging") ?? "").trim();
    const sla = normalizeSLA(rawSla);

    parsed.push({
      joNumber,
      province: normalizeProvince(
        row["STATEORPROVINCE"] ?? getRowValue(row, "STATEORPROVINCE", "G", "PROVINCE")
      ),
      sli,
      sliType: normalizeSLI(row),
      vendorType: normalizeVendorType(row),
      package: packageName,
      mrc: rawMrc,
      vatExMrc,
      sla,
      closingDate,
      mrcVatEx: vatExMrc,
    });
  }

  // De-duplicate using UNIQUE JO NUMBER
  return uniqueByJoNumber(parsed);
}

/* =========================================================
   FILTER MATCHERS
========================================================= */

function matchesProvince(row: ParsedJO, province: string): boolean {
  if (province === "All districts") return true;
  return row.province === normalizeProvince(province);
}

function matchesSLI(row: ParsedJO, sliType: string): boolean {
  if (sliType === "All SLI Types") return true;
  return row.sliType === normalizeText(sliType);
}

function matchesPackage(row: ParsedJO, packageName: string): boolean {
  if (packageName === "All Packages") return true;
  return row.package === normalizePackage(packageName);
}

/* =========================================================
   LIVE DATA HOOK
========================================================= */

function useLiveGoogleSheet(selectedMonth?: string) {
  const [state, setState] = useState<LiveState>(() => {
    const cachedJo = (liveCacheFallback as any)?.joRows || [];
    const cachedSummary = (liveCacheFallback as any)?.summaryRows || [];
    const cachedTargets =
      (liveCacheFallback as any)?.targetsMap || DEFAULT_TARGETS_MAP;
    const cachedDailyReport =
      (liveCacheFallback as any)?.dailyReport || DEFAULT_DAILY_REPORT;
    const cachedOperational = (liveCacheFallback as any)?.operationalStatus || {
      asOfText: "19 Sep 2026",
      fsoi: 16,
      forCloseout: 1,
      forActivation: 2,
    };
    const cachedPivotRows = (liveCacheFallback as any)?.sliPivotRows || [];
    const cachedPivotSource = (liveCacheFallback as any)?.sliPivotSource || "SLI ACTIVATION - SEPTEMBER 2026";
    const cachedPivotAvailable = (liveCacheFallback as any)?.sliPivotAvailable ?? true;
    return {
      sourceName: "Live Google Sheet",
      joRows: cachedJo,
      summaryRows: cachedSummary,
      targetsMap: cachedTargets,
      dailyReport: cachedDailyReport,
      dailyReportError: "",
      operationalStatus: cachedOperational,
      sliPivotRows: cachedPivotRows,
      sliPivotSource: cachedPivotSource,
      sliPivotAvailable: cachedPivotAvailable,
      lastSynced: (liveCacheFallback as any)?.updatedAt
        ? new Date((liveCacheFallback as any).updatedAt)
        : new Date(),
      syncing: false,
      error: "",
    };
  });

  const mountedRef = useRef(true);

  const syncNow = useCallback(async (silent = false) => {
    if (!mountedRef.current) return;

    setState((prev) => ({
      ...prev,
      syncing: true,
      error: silent ? prev.error : "",
    }));

    try {
      let joRows: RawRow[] = [];
      let summaryRows: RawRow[] = [];
      let liveTargets: Record<string, Targets> | null = null;
      let liveDailyReport: DailyReportAlmasor | null = null;
      let draError = "";
      let liveOperational: OperationalStatus | undefined = undefined;
      let livePivotRows: SliPivotDetailRow[] = [];
      let livePivotSource = "SLI ACTIVATION - SEPTEMBER 2026";
      let livePivotAvailable = true;
      let sourceName = "Live Google Sheet";

      // 1. Fetch via backend proxy first (avoids browser iframe CORS/network blocks)
      try {
        const monthQuery = selectedMonth ? `&month=${encodeURIComponent(selectedMonth)}` : "";
        const res = await fetch(`/api/live-data?force=1${monthQuery}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.joRows) && data.joRows.length > 0) {
            joRows = data.joRows;
            summaryRows = data.summaryRows || [];
            liveTargets = data.targetsMap || null;
            if (data.dailyReport) {
              liveDailyReport = data.dailyReport;
            }
            if (data.operationalStatus) {
              liveOperational = data.operationalStatus;
            }
            if (Array.isArray(data.sliPivotRows)) {
              livePivotRows = data.sliPivotRows;
              livePivotSource = data.sliPivotSource || livePivotSource;
              livePivotAvailable = data.sliPivotAvailable ?? true;
            }
            sourceName = data.sourceName || "Live Google Sheet";
          }
        }
      } catch (proxyErr) {
        console.warn(
          "Backend proxy live-data fetch failed, trying direct Google Sheet GViz:",
          proxyErr
        );
      }

      // 2. Direct GViz fallback if proxy did not return rows
      if (joRows.length === 0) {
        const [directJo, directSummary, directTargets] = await Promise.all([
          fetchJOActivated(),
          fetchSummary().catch(() => []),
          fetchAllTargets().catch(() => null),
        ]);
        joRows = directJo;
        summaryRows = directSummary;
        liveTargets = directTargets;
      }

      // 3. Direct fetch for SLI pivot if not returned by proxy
      if (livePivotRows.length === 0) {
        try {
          const tabName = getSliPivotTabName(selectedMonth || "2026-09");
          const pivotRes = await fetchSliActivationPivot(tabName);
          if (pivotRes.found && pivotRes.table) {
            livePivotRows = parseSliActivationPivotTable(pivotRes.table);
            livePivotSource = pivotRes.sheetSource;
            livePivotAvailable = true;
          } else {
            livePivotRows = [];
            livePivotSource = tabName;
            livePivotAvailable = false;
          }
        } catch (pivotErr) {
          console.warn("Direct SLI pivot fetch error:", pivotErr);
        }
      }

      // 4. Ensure fresh DAILY REPORT ALMASOR is retrieved
      if (!liveDailyReport) {
        try {
          liveDailyReport = await fetchDailyReportAlmasor();
        } catch (draErr: any) {
          console.warn("fetchDailyReportAlmasor direct error:", draErr);
          draError = "Daily Report temporarily unavailable";
        }
      }

      if (!mountedRef.current) return;

      const finalTargets =
        liveTargets ||
        parseTargetsFromSummaryRows(summaryRows) ||
        DEFAULT_TARGETS_MAP;

      setState((prev) => ({
        sourceName,
        joRows,
        summaryRows,
        targetsMap: finalTargets,
        dailyReport: liveDailyReport || prev.dailyReport || DEFAULT_DAILY_REPORT,
        dailyReportError: draError,
        operationalStatus: liveOperational || prev.operationalStatus,
        sliPivotRows: livePivotRows.length > 0 ? livePivotRows : (prev.sliPivotRows || []),
        sliPivotSource: livePivotSource || prev.sliPivotSource,
        sliPivotAvailable: livePivotAvailable,
        lastSynced: new Date(),
        syncing: false,
        error: "",
      }));
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.warn("Sync error:", err);
      setState((prev) => ({
        ...prev,
        syncing: false,
        error:
          prev.joRows.length === 0
            ? err?.message || "Unable to refresh Google Sheet."
            : "",
      }));
    }
  }, [selectedMonth]);

  const setManualExcel = useCallback(
    (excelJo: RawRow[], excelSummary: RawRow[], fileName: string) => {
      const parsedTargets = parseTargetsFromSummaryRows(excelSummary);
      setState((prev) => ({
        sourceName: fileName,
        joRows: excelJo,
        summaryRows: excelSummary,
        targetsMap: parsedTargets,
        dailyReport: prev.dailyReport,
        dailyReportError: prev.dailyReportError,
        operationalStatus: prev.operationalStatus,
        lastSynced: new Date(),
        syncing: false,
        error: "",
      }));
    },
    []
  );

  useEffect(() => {
    mountedRef.current = true;
    syncNow();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        syncNow(true);
      }
    }, LIVE_REFRESH_MS);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncNow(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [syncNow]);

  return {
    ...state,
    refresh: () => syncNow(false),
    setManualExcel,
  };
}

/* =========================================================
   MAIN DASHBOARD APPLICATION
========================================================= */

function formatDisplayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function App() {
  const [filters, setFilters] = useState<Filters>({
    month: DEFAULT_MONTH,
    province: "All districts",
    sliType: "All SLI Types",
    package: "All Packages",
  });

  const {
    sourceName,
    joRows,
    targetsMap,
    dailyReport,
    dailyReportError,
    operationalStatus,
    sliPivotRows,
    sliPivotSource,
    sliPivotAvailable,
    lastSynced,
    syncing,
    error,
    refresh,
    setManualExcel,
  } = useLiveGoogleSheet(filters.month);

  const [reportDate, setReportDate] = useState<string>("2026-09-19");

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);

  // Download Data dropdown & toast feedback state
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(event.target as Node)
      ) {
        setDownloadDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Parse JO records with unique de-duplication
  const rows = useMemo(() => parseJORows(joRows), [joRows]);

  // Available months from data
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(DEFAULT_MONTH);
    for (const r of rows) {
      set.add(monthKey(r.closingDate));
    }
    return Array.from(set).sort().reverse();
  }, [rows]);

  // Handle month change and date synchronization
  const handleMonthChange = (newMonth: string) => {
    const [, , oldD] = reportDate.split("-").map(Number);
    const [newY, newM] = newMonth.split("-").map(Number);
    const daysInNewMonth = new Date(newY, newM, 0).getDate();
    const clampedDay = Math.min(oldD || 1, daysInNewMonth);
    const newReportDate = `${newY}-${String(newM).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;

    setFilters((prev) => ({ ...prev, month: newMonth }));
    setReportDate(newReportDate);
  };

  // Generate calendar dates for selected month
  const dateOptions = useMemo(() => {
    const [year, monthNum] = filters.month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const options: Array<{ value: string; label: string; day: number }> = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dObj = new Date(year, monthNum - 1, day);
      const label = dObj.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      options.push({ value: iso, label, day });
    }
    return options;
  }, [filters.month]);

  // Find latest recorded closing date in dataset
  const latestAvailableDate = useMemo(() => {
    let maxDate = "2026-09-18";
    for (const r of rows) {
      const k = dateKey(r.closingDate);
      if (k > maxDate) maxDate = k;
    }
    return maxDate;
  }, [rows]);

  // All unique records in selected month (unfiltered territory scope)
  const monthRows = useMemo(
    () => rows.filter((r) => monthKey(r.closingDate) === filters.month),
    [rows, filters.month]
  );

  // Cutoff date components
  const [cutoffYear, cutoffMonth, cutoffDay] = useMemo(
    () => reportDate.split("-").map(Number),
    [reportDate]
  );

  // Records in selected month strictly up to reportDate cutoff (MTD)
  const mtdRows = useMemo(() => {
    return monthRows.filter((r) => {
      const y = r.closingDate.getFullYear();
      const m = r.closingDate.getMonth() + 1;
      const d = r.closingDate.getDate();
      return y === cutoffYear && m === cutoffMonth && d <= cutoffDay;
    });
  }, [monthRows, cutoffYear, cutoffMonth, cutoffDay]);

  // Filtered MTD records respecting all dropdown filters
  const filteredRows = useMemo(
    () =>
      mtdRows.filter(
        (r) =>
          matchesProvince(r, filters.province) &&
          matchesSLI(r, filters.sliType) &&
          matchesPackage(r, filters.package)
      ),
    [mtdRows, filters.province, filters.sliType, filters.package]
  );

  // Download uses filtered unique JO rows respecting Month, Date, Province, SLI Type, Package
  const filteredDownloadRows = filteredRows;

  function formatExportDate(d: Date): string {
    if (!d || isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function createExportFilename(extension: "xlsx" | "csv") {
    const province = filters.province.replace(/\s+/g, "-");
    const sli = filters.sliType.replace(/\s+/g, "-");
    const pkg = filters.package.replace(/\s+/g, "-");

    return (
      `ALMASOR_Sales_Data_` +
      `${reportDate}_` +
      `${province}_` +
      `${sli}_` +
      `${pkg}.` +
      extension
    );
  }

  const exportToExcel = () => {
    setDownloadDropdownOpen(false);

    if (!filteredDownloadRows.length) {
      showToast("No data available for the selected filters.");
      return;
    }

    const exportRows = filteredDownloadRows.map((row) => ({
      "JO NUMBER": row.joNumber,
      "STATEORPROVINCE": row.province,
      "SLI": row.sli,
      "SLI TYPE": row.sliType,
      "VENDOR TYPE": row.vendorType,
      "PACKAGE": row.package,
      "MRC": row.mrc,
      "VAT EX MRC": row.vatExMrc,
      "CLOSING DATE": formatExportDate(row.closingDate),
      "SLA": row.sla,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Filtered Data");
    XLSX.writeFile(workbook, createExportFilename("xlsx"));
    showToast("Data downloaded successfully.");
  };

  const exportToCSV = () => {
    setDownloadDropdownOpen(false);

    if (!filteredDownloadRows.length) {
      showToast("No data available for the selected filters.");
      return;
    }

    const exportRows = filteredDownloadRows.map((row) => ({
      "JO NUMBER": row.joNumber,
      "STATEORPROVINCE": row.province,
      "SLI": row.sli,
      "SLI TYPE": row.sliType,
      "VENDOR TYPE": row.vendorType,
      "PACKAGE": row.package,
      "MRC": row.mrc,
      "VAT EX MRC": row.vatExMrc,
      "CLOSING DATE": formatExportDate(row.closingDate),
      "SLA": row.sla,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = createExportFilename("csv");

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("Data downloaded successfully.");
  };

  // Package section scope: respects province and SLI filters, MTD cutoff
  const packageRows = useMemo(
    () =>
      mtdRows.filter(
        (r) =>
          matchesProvince(r, filters.province) && matchesSLI(r, filters.sliType)
      ),
    [mtdRows, filters.province, filters.sliType]
  );

  // Active target for current province filter
  const activeTargets: Targets = useMemo(() => {
    return (
      targetsMap[filters.province] ||
      targetsMap["All districts"] || { fiberX: 0, sme: 0, bida: 0, s2s: 0 }
    );
  }, [targetsMap, filters.province]);

  // Overall Almasor targets from Row 29
  const almasorTargets: Targets = useMemo(() => {
    return (
      targetsMap["All districts"] ||
      targetsMap["ALMASOR"] || { fiberX: 0, sme: 0, bida: 0, s2s: 0 }
    );
  }, [targetsMap]);

  // Provincial targets mapping
  const provincialTargets = useMemo(
    () => ({
      ALBAY: targetsMap["ALBAY"] || targetsMap["Albay"] || { fiberX: 0, sme: 0, bida: 0, s2s: 0 },
      MASBATE: targetsMap["MASBATE"] || targetsMap["Masbate"] || { fiberX: 0, sme: 0, bida: 0, s2s: 0 },
      SORSOGON: targetsMap["SORSOGON"] || targetsMap["Sorsogon"] || { fiberX: 0, sme: 0, bida: 0, s2s: 0 },
    }),
    [targetsMap]
  );

  /*
    1. MAIN KPI METRICS (MTD up to reportDate)
    Activated JO Count = Count of unique JOs in filteredRows
    Total MRC = Sum of Column AE in filteredRows
  */
  const mainKpis = useMemo(() => {
    let activatedJO = 0;
    let totalMRC = 0;

    for (const r of filteredRows) {
      activatedJO++;
      totalMRC += r.mrc || 0;
    }

    return { activatedJO, totalMRC };
  }, [filteredRows]);

  /*
    2. PACKAGE BREAKDOWN METRICS (MTD up to reportDate)
    FIBERX Running = Count of unique JOs where package = FIBERX
    SME Running = Sum of MRC where package = SME (Do NOT count SME JOs as running value)
    BIDA Running = Count of unique JOs where package = BIDA
  */
  const packageMetrics = useMemo(() => {
    let fiberX = 0;
    let fiberXMRC = 0;

    let sme = 0;
    let smeMRC = 0;

    let bida = 0;
    let bidaMRC = 0;

    for (const r of packageRows) {
      if (r.package === "FIBERX") {
        fiberX++;
        fiberXMRC += r.mrc || 0;
      }
      if (r.package === "SME") {
        sme++;
        smeMRC += r.mrc || 0;
      }
      if (r.package === "BIDA") {
        bida++;
        bidaMRC += r.mrc || 0;
      }
    }

    return {
      fiberX,
      fiberXMRC,
      sme,
      smeMRC,
      bida,
      bidaMRC,
    };
  }, [packageRows]);

  /*
    3. SLI CHANNEL METRICS (MTD up to reportDate)
  */
  const sliMetrics = useMemo(() => {
    let inhouse = 0;
    let msa = 0;

    for (const r of filteredRows) {
      if (r.sliType === "INHOUSE") inhouse++;
      if (r.sliType === "MSA") msa++;
    }

    return { inhouse, msa };
  }, [filteredRows]);

  /*
    4. MTD VS TARGET — ALMASOR SCOPE (MTD up to reportDate)
  */
  const almasorRunning = useMemo(() => {
    let fiberX = 0;
    let smeMRC = 0;
    let bida = 0;

    for (const r of mtdRows) {
      if (r.package === "FIBERX") fiberX++;
      if (r.package === "SME") smeMRC += r.mrc || 0;
      if (r.package === "BIDA") bida++;
    }

    return { fiberX, smeMRC, bida };
  }, [mtdRows]);

  /*
    5. MTD VS TARGET — PROVINCIAL SCOPE (MTD up to reportDate)
  */
  const provincialRunning = useMemo(() => {
    const albayRows = mtdRows.filter((r) => r.province === "ALBAY");
    const masbateRows = mtdRows.filter((r) => r.province === "MASBATE");
    const sorsogonRows = mtdRows.filter((r) => r.province === "SORSOGON");

    return {
      ALBAY: {
        fiberXCount: albayRows.filter((r) => r.package === "FIBERX").length,
        smeMRC: albayRows
          .filter((r) => r.package === "SME")
          .reduce((sum, r) => sum + (r.mrc || 0), 0),
        bidaCount: albayRows.filter((r) => r.package === "BIDA").length,
      },
      MASBATE: {
        fiberXCount: masbateRows.filter((r) => r.package === "FIBERX").length,
        smeMRC: masbateRows
          .filter((r) => r.package === "SME")
          .reduce((sum, r) => sum + (r.mrc || 0), 0),
        bidaCount: masbateRows.filter((r) => r.package === "BIDA").length,
      },
      SORSOGON: {
        fiberXCount: sorsogonRows.filter((r) => r.package === "FIBERX").length,
        smeMRC: sorsogonRows
          .filter((r) => r.package === "SME")
          .reduce((sum, r) => sum + (r.mrc || 0), 0),
        bidaCount: sorsogonRows.filter((r) => r.package === "BIDA").length,
      },
    };
  }, [mtdRows]);

  /*
    6. FIBERX RUNNING VS TARGET CHART
  */
  const fiberChart = useMemo(() => {
    const [year, monthNumber] = filters.month.split("-").map(Number);
    const totalDays = new Date(year, monthNumber, 0).getDate();

    const fiberRows = monthRows.filter(
      (r) =>
        r.package === "FIBERX" &&
        matchesProvince(r, filters.province) &&
        matchesSLI(r, filters.sliType)
    );

    const counts = new Map<string, number>();
    for (const r of fiberRows) {
      const key = dateKey(r.closingDate);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const result: any[] = [];
    let running = 0;

    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, monthNumber - 1, day);
      const key = dateKey(date);
      running += counts.get(key) || 0;

      const runningTarget = activeTargets.fiberX * (day / totalDays);
      const isoDate = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      result.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        fullDate: isoDate,
        day,
        fiberXRunning: running,
        target: Number(runningTarget.toFixed(2)),
        isCutoff: isoDate === reportDate,
      });
    }

    return result;
  }, [monthRows, filters.province, filters.sliType, filters.month, activeTargets.fiberX, reportDate]);

  const selectedDayChartItem = useMemo(() => {
    return fiberChart.find((item) => item.isCutoff) || fiberChart[fiberChart.length - 1];
  }, [fiberChart]);

  const selectedDateFiberXRunning = selectedDayChartItem?.fiberXRunning ?? 0;
  const selectedDateTarget = selectedDayChartItem?.target ?? 0;
  const selectedDateProgress = calculatePercentage(
    selectedDateFiberXRunning,
    selectedDateTarget
  );

  const fiberXChartAchievement = calculatePercentage(
    packageMetrics.fiberX,
    activeTargets.fiberX
  );

  /* =======================================================
     EXCEL IMPORT HANDLER
  ======================================================= */
  async function loadExcel(file: File) {
    setExcelLoading(true);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

      const joSheet = workbook.Sheets["JO ACTIVATED"];
      if (!joSheet) {
        throw new Error("JO ACTIVATED sheet was not found in workbook.");
      }

      const rawRows = XLSX.utils.sheet_to_json<RawRow>(joSheet, { defval: "" });

      let summaryRawRows: RawRow[] = [];
      const summarySheet = workbook.Sheets["SUMMARY"];
      if (summarySheet) {
        const matrix = XLSX.utils.sheet_to_json<any[][]>(summarySheet, {
          header: 1,
          defval: "",
        });

        summaryRawRows = matrix.map((row) => ({
          B: row[1] ?? "",
          C: row[2] ?? "",
          D: row[3] ?? "",
          E: row[4] ?? "",
          F: row[5] ?? "",
          PROVINCE: row[1] ?? "",
          SLI: row[2] ?? "",
          FIBERX: row[3] ?? "",
          SME: row[4] ?? "",
          BIDA: row[5] ?? "",
        }));
      }

      setManualExcel(rawRows, summaryRawRows, file.name);
    } catch (err: any) {
      console.error("Excel load failed:", err);
      alert(err?.message || "Excel file load failed.");
    } finally {
      setExcelLoading(false);
    }
  }

  /* =======================================================
     LAYOUT RENDERING (STRICT DASHBOARD ORDER)
  ======================================================= */
  return (
    <div className="min-h-screen bg-[#f7faf9] text-[#123b31]">
      <div className="max-w-[1500px] mx-auto px-6 py-6">
        {/* ================================================
            1. HEADER
            Month | Date | Refresh | Download
        ================================================= */}
        <header className="mb-6" id="dashboard-header">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[#123b31] uppercase">
                SALES PERFORMANCE
              </h1>
              <p className="text-xs md:text-sm text-gray-500 mt-0.5">
                Albay | Masbate | Sorsogon
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Month */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="month-select" className="text-xs font-bold text-gray-500 uppercase">Month:</label>
                <select
                  id="month-select"
                  aria-label="Month"
                  className="bg-white border border-[#dcece6] rounded-xl px-3 py-1.5 text-xs md:text-sm font-semibold text-gray-800 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0aa37a]"
                  value={filters.month}
                  onChange={(e) => handleMonthChange(e.target.value)}
                >
                  {monthOptions.map((month) => (
                    <option key={month} value={month}>
                      {formatMonth(month)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div className="flex items-center gap-1.5">
                <label htmlFor="date-select" className="text-xs font-bold text-gray-500 uppercase">Date:</label>
                <select
                  id="date-select"
                  aria-label="Report Date"
                  className="bg-white border border-[#dcece6] rounded-xl px-3 py-1.5 text-xs md:text-sm font-semibold text-gray-800 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0aa37a]"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                >
                  {dateOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh */}
              <button
                id="refresh-button"
                onClick={() => refresh()}
                disabled={syncing}
                className="px-3.5 py-1.5 rounded-xl bg-[#dff7ec] border border-[#b5e6d0] text-[#0b684e] text-xs md:text-sm font-bold disabled:opacity-50 cursor-pointer hover:bg-[#cbf1e0] transition-colors shadow-xs"
              >
                {syncing ? "Updating..." : "Refresh"}
              </button>

              {/* Download */}
              <div className="relative" ref={downloadMenuRef}>
                <button
                  id="download-data-button"
                  type="button"
                  onClick={() => setDownloadDropdownOpen((prev) => !prev)}
                  className="px-3.5 py-1.5 rounded-xl bg-white border border-[#cfe4da] text-[#0b684e] text-xs md:text-sm font-bold flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 transition-colors shadow-xs"
                  aria-expanded={downloadDropdownOpen}
                >
                  <Download className="w-3.5 h-3.5 text-[#0b684e]" />
                  <span>Download</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#0b684e]" />
                </button>

                {downloadDropdownOpen && (
                  <div className="absolute right-0 mt-1.5 w-44 bg-white border border-[#dcece6] rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 border-b border-[#f0f5f2]">
                      Download Format
                    </div>
                    <button
                      type="button"
                      id="download-excel-option"
                      onClick={exportToExcel}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-[#f2f8f5] hover:text-[#0b684e] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      <span>Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      id="download-csv-option"
                      onClick={exportToCSV}
                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-[#f2f8f5] hover:text-[#0b684e] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span>CSV (.csv)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Load Excel */}
              <button
                id="load-excel-button"
                onClick={() => fileRef.current?.click()}
                disabled={excelLoading}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white border border-[#cfe4da] px-3 py-1.5 rounded-lg shadow-xs hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
                title="Upload an offline .xlsx or .csv workbook"
              >
                {excelLoading ? "Loading..." : "Load Excel"}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    loadExcel(file);
                  }
                }}
              />
            </div>
          </div>
        </header>

        {/* ================================================
            2. LIVE STATUS
            Last synced | Report date | Unique JOs
        ================================================= */}
        <section className="bg-white border border-[#c9ebdd] rounded-2xl p-4 md:p-5 mb-6 shadow-sm" id="live-status-section">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    syncing
                      ? "bg-yellow-500 animate-pulse"
                      : error && monthRows.length === 0
                      ? "bg-red-500"
                      : "bg-[#0aa37a] shadow-[0_0_8px_#0aa37a]"
                  }`}
                />
                <span className="text-xs font-black uppercase tracking-wider text-[#0a684d]">
                  LIVE STATUS
                </span>
              </div>
              <span className="text-gray-300">|</span>
              <span className="text-xs font-semibold text-gray-700">
                {syncing
                  ? "Updating live data..."
                  : error && monthRows.length === 0
                  ? "Live update issue"
                  : sourceName}
              </span>
            </div>

            <div className="flex items-center gap-4 md:gap-6 text-xs md:text-sm flex-wrap">
              {/* Last synced */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Last synced:</span>
                <strong className="text-gray-800 font-semibold">
                  {lastSynced
                    ? lastSynced.toLocaleTimeString("en-PH", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "Pending"}
                </strong>
              </div>

              <span className="text-gray-300 hidden sm:inline">|</span>

              {/* Report date */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Report date:</span>
                <strong className="text-[#0a684d] font-bold">
                  {formatDisplayDate(reportDate)}
                </strong>
              </div>

              <span className="text-gray-300 hidden sm:inline">|</span>

              {/* Unique JOs */}
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400 font-medium">Unique JOs:</span>
                <strong className="text-[#123b31] font-bold">
                  {formatCount(mtdRows.length)} MTD
                </strong>
                <span className="text-gray-400 text-xs">
                  ({formatCount(monthRows.length)} total in {formatMonth(filters.month)})
                </span>
              </div>
            </div>
          </div>

          {error && monthRows.length === 0 && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
              <div>
                Unable to load live data: {error}.
              </div>
              <button
                onClick={() => refresh()}
                className="px-3 py-1 bg-white border border-red-300 rounded-lg text-xs font-semibold text-red-800 hover:bg-red-100 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </section>

        {/* ================================================
            SHEET MAPPING REFERENCE
            JO ACTIVATED → raw operational dashboard
            SUMMARY → targets
            DAILY REPORT ALMASOR → official Daily SLI Report
            SLI ACTIVATION - SEPTEMBER 2026 → official Top Performing SLI
        ================================================= */}
        <div className="bg-white border border-[#dcece6] rounded-2xl p-3 md:p-3.5 mb-6 shadow-xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#0a684d]">
              SHEET SOURCES:
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <a
              href="#operational-dashboard"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f0f7f4] border border-[#d4ebe0] text-[#0b684e] font-semibold hover:bg-[#e4f3ec] transition-colors"
            >
              <span className="font-mono text-[11px] font-bold">JO ACTIVATED</span>
              <span className="text-gray-400">→</span>
              <span>Raw Operational Dashboard</span>
            </a>
            <a
              href="#target-summary-cards"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f8faf9] border border-[#dcece6] text-gray-700 font-semibold hover:bg-[#f0f4f2] transition-colors"
            >
              <span className="font-mono text-[11px] font-bold">SUMMARY</span>
              <span className="text-gray-400">→</span>
              <span>Targets</span>
            </a>
            <a
              href="#daily-sli-section"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f8faf9] border border-[#dcece6] text-gray-700 font-semibold hover:bg-[#f0f4f2] transition-colors"
            >
              <span className="font-mono text-[11px] font-bold">DAILY REPORT ALMASOR</span>
              <span className="text-gray-400">→</span>
              <span>Official Daily SLI Report</span>
            </a>
            <a
              href="#top-performing-sli"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f8faf9] border border-[#dcece6] text-gray-700 font-semibold hover:bg-[#f0f4f2] transition-colors"
            >
              <span className="font-mono text-[11px] font-bold">SLI ACTIVATION - SEPTEMBER 2026</span>
              <span className="text-gray-400">→</span>
              <span>Official Top Performing SLI</span>
            </a>
          </div>
        </div>

        {/* ================================================
            3. FILTERS
            Province | SLI Type | Package | Reset filters
        ================================================= */}
        <section className="bg-white border border-[#dcece6] rounded-2xl p-3.5 mb-6 shadow-sm flex items-center gap-3 flex-wrap" id="filters-section">
          {/* Province */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="province-select" className="text-xs font-bold text-gray-500 uppercase">Province:</label>
            <select
              id="province-select"
              aria-label="Province"
              className="bg-[#f8faf9] border border-[#dcece6] rounded-xl px-3 py-1.5 text-xs md:text-sm font-semibold text-gray-800 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0aa37a]"
              value={filters.province}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, province: e.target.value }))
              }
            >
              {PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>

          <span className="text-gray-200 hidden sm:inline">|</span>

          {/* SLI Type */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="sli-type-select" className="text-xs font-bold text-gray-500 uppercase">SLI Type:</label>
            <select
              id="sli-type-select"
              aria-label="SLI Type"
              className="bg-[#f8faf9] border border-[#dcece6] rounded-xl px-3 py-1.5 text-xs md:text-sm font-semibold text-gray-800 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0aa37a]"
              value={filters.sliType}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, sliType: e.target.value }))
              }
            >
              {SLI_TYPES.map((sli) => (
                <option key={sli} value={sli}>
                  {sli}
                </option>
              ))}
            </select>
          </div>

          <span className="text-gray-200 hidden sm:inline">|</span>

          {/* Package */}
          <div className="flex items-center gap-1.5">
            <label htmlFor="package-select" className="text-xs font-bold text-gray-500 uppercase">Package:</label>
            <select
              id="package-select"
              aria-label="Package"
              className="bg-[#f8faf9] border border-[#dcece6] rounded-xl px-3 py-1.5 text-xs md:text-sm font-semibold text-gray-800 cursor-pointer shadow-xs focus:outline-none focus:ring-2 focus:ring-[#0aa37a]"
              value={filters.package}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, package: e.target.value }))
              }
            >
              {PACKAGES.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto">
            <button
              id="reset-filters-button"
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              onClick={() => {
                setFilters({
                  month: DEFAULT_MONTH,
                  province: "All districts",
                  sliType: "All SLI Types",
                  package: "All Packages",
                });
                setReportDate("2026-09-19");
              }}
            >
              Reset filters
            </button>
          </div>
        </section>

        {/* ================================================
            3. MAIN KPI CARDS (ACTIVATED JOs & TOTAL MRC)
            Source: JO ACTIVATED → raw operational dashboard
        ================================================= */}
        <div className="flex items-center justify-between mb-3" id="operational-dashboard">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">
                OPERATIONAL DASHBOARD
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f0f7f4] text-[#0b684e] border border-[#d4ebe0]">
                JO ACTIVATED
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Raw operational dashboard • Unique activated job orders &amp; revenue consolidation
            </p>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7" id="main-kpi-cards">
          {/* ACTIVATED JOs */}
          <div className="bg-[#15553f] text-white rounded-3xl p-7 shadow-sm flex flex-col justify-between" id="kpi-activated-jo">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-85">
                ACTIVATED JOs
              </div>
              <div className="text-6xl font-black mt-4 tracking-tight">
                {formatCount(mainKpis.activatedJO)}
              </div>
            </div>
            <div className="text-sm opacity-80 mt-4">
              Total unique activated job orders up to {formatDisplayDate(reportDate)}
            </div>
          </div>

          {/* TOTAL MRC */}
          <div className="bg-white border border-[#dcece6] rounded-3xl p-7 shadow-sm flex flex-col justify-between" id="kpi-total-mrc">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                TOTAL MRC
              </div>
              <div className="text-5xl font-extrabold mt-4 text-[#073d2d] tracking-tight">
                {formatPeso(mainKpis.totalMRC)}
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-4">
              Consolidated recurring revenue up to {formatDisplayDate(reportDate)}
            </div>
          </div>
        </section>

        {/* ================================================
            4. DAILY SLI REPORT (FULL WIDTH)
        ================================================= */}
        <section className="mb-7" id="daily-sli-section">
          <DailySLIReport
            reportDate={reportDate}
            monthKey={filters.month}
            allMonthRows={monthRows}
            overallTargets={almasorTargets}
            dailyReport={dailyReport}
            dailyReportError={dailyReportError}
            latestDataDate={latestAvailableDate}
          />
        </section>

        {/* ================================================
            5. PACKAGE PERFORMANCE (FiberX | SME | BIDA)
        ================================================= */}
        <div className="mb-3">
          <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">
            PACKAGE PERFORMANCE
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            FiberX | SME | BIDA • Running metrics respecting active province and SLI filters
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5" id="package-breakdown">
          {/* FIBERX */}
          <PackageCard
            title="FIBERX"
            label="Core Fiber"
            running={packageMetrics.fiberX}
            target={activeTargets.fiberX}
            percentage={calculatePercentage(
              packageMetrics.fiberX,
              activeTargets.fiberX
            )}
            footerLabel="Total MRC:"
            footerValue={formatPeso(packageMetrics.fiberXMRC)}
          />

          {/* SME */}
          <PackageCard
            title="SME"
            label="Enterprise"
            running={packageMetrics.smeMRC}
            target={activeTargets.sme}
            percentage={calculatePercentage(
              packageMetrics.smeMRC,
              activeTargets.sme
            )}
            money
            runningLabel="Running MRC"
            footerLabel="Activated JOs:"
            footerValue={formatCount(packageMetrics.sme)}
          />

          {/* BIDA */}
          <PackageCard
            title="BIDA"
            label="Affordable"
            running={packageMetrics.bida}
            target={activeTargets.bida}
            percentage={calculatePercentage(
              packageMetrics.bida,
              activeTargets.bida
            )}
            footerLabel="Total MRC:"
            footerValue={formatPeso(packageMetrics.bidaMRC)}
          />
        </section>

        {/* ================================================
            5. TARGETS & MTD VS TARGET
            Source: SUMMARY → targets
        ================================================= */}
        <div className="flex items-center justify-between mb-3" id="target-summary-cards">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">
                MONTHLY TARGETS
              </h2>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#f8faf9] text-gray-700 border border-[#dcece6]">
                SUMMARY
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Official target allocations from SUMMARY sheet (Rows 11, 17, 23, 29)
            </p>
          </div>
        </div>

        {/* Target summary cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">
          <TargetCard title="FiberX Target" value={formatCount(activeTargets.fiberX)} />
          <TargetCard title="SME Target" value={formatPeso(activeTargets.sme)} />
          <TargetCard title="BIDA Target" value={formatCount(activeTargets.bida)} />
        </section>

        {/* ================================================
            6. MTD VS TARGET — BY PROVINCE (ALBAY, MASBATE, SORSOGON)
        ================================================= */}
        <MtdVsTargetProvince
          provinceMetrics={provincialRunning}
          targetsByProvince={provincialTargets}
        />

        {/* ================================================
            7. SLI CHANNEL (INHOUSE | MSA)
        ================================================= */}
        <div className="mb-3">
          <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">
            SLI CHANNEL
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            INHOUSE | MSA • Channel distribution for activated JOs
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8" id="sli-breakdown">
          <ChannelCard title="INHOUSE" value={sliMetrics.inhouse} />
          <ChannelCard title="MSA" value={sliMetrics.msa} />
        </section>

        {/* ================================================
            8. TOP PERFORMING SLI (Ranking + bars)
        ================================================= */}
        <TopPerformingSliSection
          rows={filteredRows}
          totalScopeJOs={filteredRows.length}
          pivotRows={sliPivotRows}
          pivotAvailable={sliPivotAvailable}
          pivotSource={sliPivotSource}
          monthName={formatMonth(filters.month)}
          filterProvince={filters.province}
          filterSliType={filters.sliType}
          filterPackage={filters.package}
        />

        {/* ================================================
            9. FIBERX RUNNING VS TARGET (Large line chart)
        ================================================= */}
        <section className="bg-white border border-[#dcece6] rounded-2xl p-6 shadow-sm mb-8" id="fiberx-chart">
          <div className="flex justify-between items-start gap-5 mb-5 flex-wrap">
            <div>
              <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">
                FIBERX RUNNING VS TARGET
              </h2>
              <p className="text-sm text-gray-500 mt-0.5 font-medium">
                Large line chart • Monthly cumulative FiberX activations compared with running target trajectory
              </p>
            </div>

            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">Monthly Target</div>
                <div className="text-xl font-bold text-[#0a684d]">
                  {formatCount(activeTargets.fiberX)}
                </div>
              </div>

              <div className="text-right pl-4 border-l border-[#e2ece7]">
                <div className="text-xs text-gray-500 font-medium">As-of-Date Target</div>
                <div className="text-xl font-bold text-gray-700">
                  {formatCount(Math.round(selectedDateTarget))}
                </div>
              </div>

              <div className="text-right pl-4 border-l border-[#e2ece7]">
                <div className="text-xs text-gray-500 font-medium">MTD Progress</div>
                <div className="text-xl font-extrabold text-[#0a8a64]">
                  {formatPercent(fiberXChartAchievement)}
                </div>
              </div>
            </div>
          </div>

          <div className="h-[410px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={fiberChart}
                margin={{ top: 15, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  label={{
                    value: "Activated JOs",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 12,
                    fill: "#4b5563",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderColor: "#dcece6",
                    borderRadius: "0.75rem",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any, name: string) => [
                    Number(value).toLocaleString("en-PH"),
                    name === "fiberXRunning" ? "FiberX Running" : "Target",
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="fiberXRunning"
                  name="FiberX Running"
                  stroke="#0a8a64"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  name="Target"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* ================================================
            10. TOTAL CLOSED (Compact tables)
        ================================================= */}
        <TotalClosedTables
          rows={filteredRows}
          monthName={formatMonth(filters.month)}
        />

        {/* ================================================
            11. SLA PERFORMANCE (Distribution + cumulative %)
        ================================================= */}
        <SlaPerformanceSection rows={filteredRows} />

        {/* ================================================
            12. FOOTER (Last synced | Data source | Verify counts)
        ================================================= */}
        <footer className="mt-12 pt-8 border-t border-[#dcece6] pb-10" id="dashboard-footer">
          <div className="bg-white border border-[#dcece6] rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-[#edf3f0]">
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-[#0a684d]">
                  FOOTER
                </div>
                <div className="text-lg font-bold text-[#123b31] mt-0.5">
                  Almasor Territory Operational Performance Hub
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Synchronized with Converge Almasor SLI daily tracking workbook.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => refresh()}
                  disabled={syncing}
                  className="px-4 py-2 rounded-xl bg-[#dff7ec] border border-[#b5e6d0] text-[#0b684e] text-xs font-bold hover:bg-[#cbf1e0] transition-colors cursor-pointer"
                >
                  {syncing ? "Syncing..." : "Sync Fresh Data"}
                </button>
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 rounded-xl bg-white border border-[#cfe4da] text-[#0b684e] text-xs font-bold hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Export Workbook
                </button>
              </div>
            </div>

            {/* THREE COLUMNS: Last synced | Data source | Verify counts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              {/* 1. LAST SYNCED */}
              <div className="bg-[#f8faf9] rounded-xl p-4 border border-[#e8f0ed]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  LAST SYNCED
                </div>
                <div className="text-base font-bold text-[#123b31]">
                  {lastSynced
                    ? lastSynced.toLocaleDateString("en-PH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }) +
                      " " +
                      lastSynced.toLocaleTimeString("en-PH", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })
                    : "Awaiting sync"}
                </div>
                <div className="text-xs text-gray-500 mt-1.5 flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      syncing ? "bg-yellow-500 animate-ping" : "bg-[#0aa37a]"
                    }`}
                  />
                  <span>{syncing ? "Active sync in progress" : "Live synchronization active"}</span>
                </div>
              </div>

              {/* 2. DATA SOURCE */}
              <div className="bg-[#f8faf9] rounded-xl p-4 border border-[#e8f0ed]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  DATA SOURCE
                </div>
                <div className="text-base font-bold text-[#0a684d]">
                  {sourceName}
                </div>
                <div className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  Google Sheet SLI Tracker • Tab: <span className="font-semibold text-gray-700">DAILY REPORT ALMASOR</span>
                </div>
              </div>

              {/* 3. VERIFY COUNTS */}
              <div className="bg-[#f8faf9] rounded-xl p-4 border border-[#e8f0ed]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                  VERIFY COUNTS
                </div>
                <div className="text-base font-bold text-[#123b31]">
                  {formatCount(mtdRows.length)} MTD / {formatCount(monthRows.length)} Total
                </div>
                <div className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                  FiberX: <strong className="text-gray-700">{formatCount(packageMetrics.fiberX)}</strong> • SME: <strong className="text-gray-700">{formatCount(packageMetrics.sme)}</strong> • BIDA: <strong className="text-gray-700">{formatCount(packageMetrics.bida)}</strong>
                </div>
                <div className="text-[11px] text-[#0a684d] font-semibold mt-1 flex items-center gap-1">
                  <span>✓</span> Unique JO verification complete
                </div>
              </div>
            </div>
          </div>
        </footer>

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-[#123b31] text-white px-4 py-3 rounded-xl shadow-xl text-sm font-medium border border-[#215a4c] animate-in slide-in-from-bottom-3 duration-200">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   SUB-COMPONENTS FOR PACKAGE & CHANNELS
========================================================= */

function PackageCard({
  title,
  label,
  running,
  target,
  percentage,
  footerLabel,
  footerValue,
  money = false,
  runningLabel = "Running",
}: {
  title: string;
  label: string;
  running: number;
  target: number;
  percentage: number;
  footerLabel: string;
  footerValue: string;
  money?: boolean;
  runningLabel?: string;
}) {
  return (
    <div className="bg-white border border-[#dcece6] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-[#005e47] text-lg">{title}</h3>
          <span className="text-xs px-3 py-1 rounded-full border border-[#8bdcbb] bg-[#f1faf6] text-[#087553] font-medium">
            {label}
          </span>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-5">
          {runningLabel}
        </div>
        <div className="text-3xl font-bold mt-1 text-[#123b31]">
          {money ? formatPeso(running) : formatCount(running)}
        </div>

        <div className="flex justify-between mt-5 text-sm">
          <span className="text-gray-500 font-medium">Target:</span>
          <strong className="text-gray-700">
            {money ? formatPeso(target) : formatCount(target)}
          </strong>
        </div>

        <ProgressBar value={percentage} />

        <div className="flex justify-between mt-2 text-sm">
          <span className="text-gray-500 font-medium">Achievement:</span>
          <strong className="text-[#0a684d]">{formatPercent(percentage)}</strong>
        </div>
      </div>

      <div className="flex justify-between mt-5 pt-4 border-t border-[#f0f5f2] text-sm">
        <span className="text-gray-500 font-medium">{footerLabel}</span>
        <strong className="text-gray-800">{footerValue}</strong>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));

  return (
    <div className="mt-3 h-2 bg-[#edf2f0] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#0aa37a] rounded-full transition-all duration-300"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function TargetCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-[#f1faf6] border border-[#dcece6] rounded-2xl p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </div>
      <div className="text-2xl font-bold mt-2 text-[#07563f]">{value}</div>
    </div>
  );
}

function ChannelCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-white border border-[#dcece6] rounded-2xl p-6 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </div>
      <div className="text-4xl font-bold mt-2 text-[#07563f]">
        {formatCount(value)}
      </div>
    </div>
  );
}
