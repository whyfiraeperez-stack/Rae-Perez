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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MtdVsTargetAlmasor } from "./components/MtdVsTargetAlmasor";
import { MtdVsTargetProvince } from "./components/MtdVsTargetProvince";
import { TotalClosedTables } from "./components/TotalClosedTables";
import { SlaPerformanceSection } from "./components/SlaPerformanceSection";
import { ParsedJO, Targets } from "./types";

/* =========================================================
   CONFIGURATION
========================================================= */

const GOOGLE_SHEET_ID =
  "17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg";

const GOOGLE_SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`;

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

  return valueText;
}

/*
  SLI TYPE is the primary source.
  VENDOR TYPE is used as fallback when SLI TYPE is blank.
*/
function normalizeSLI(row: RawRow): string {
  const sli = normalizeText(getRowValue(row, "SLI TYPE", "S", "SLI"));

  if (sli === "INHOUSE") return "INHOUSE";
  if (sli === "MSA") return "MSA";

  const vendor = normalizeText(getRowValue(row, "VENDOR TYPE", "U", "VENDOR"));

  if (vendor === "INHOUSE") return "INHOUSE";
  if (vendor === "MSA") return "MSA";

  return "";
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
  S  = SLI TYPE
  U  = VENDOR TYPE
  Y  = SLA
  AC = PACKAGE
  AE = MRC
  AF = CLOSING DATE
*/
async function fetchJOActivated(): Promise<RawRow[]> {
  return fetchGoogleSheet(
    "JO ACTIVATED",
    `select A,G,S,U,Y,AC,AE,AF where A is not null`
  );
}

/*
  Fetch SUMMARY rows for general matrix parsing and fallback.
*/
async function fetchSummary(): Promise<RawRow[]> {
  return fetchGoogleSheet("SUMMARY", `select B,C,D,E,F`);
}

/*
  Fetch single SUMMARY target row via exact range query.
  Row 11 = Albay
  Row 17 = Sorsogon
  Row 23 = Masbate
  Row 29 = Almasor / Overall
  Columns: D = FIBERX, E = SME, F = BIDA
*/
async function fetchSummaryTargetRow(rowNumber: number): Promise<Targets> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=SUMMARY` +
    `&range=D${rowNumber}:F${rowNumber}` +
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
        };
      }
    }

    return { fiberX: 0, sme: 0, bida: 0 };
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

function parseJORows(rawRows: RawRow[]): ParsedJO[] {
  const parsed: ParsedJO[] = [];

  for (const row of rawRows) {
    const joNumber = String(
      getRowValue(row, "JO NUMBER", "A", "JO NO", "JONUMBER")
    ).trim();

    if (!joNumber || joNumber === "JO NUMBER") {
      continue;
    }

    const closingDate = parseDate(
      getRowValue(row, "CLOSING DATE", "AF", "ACTIVATION DATE")
    );

    if (!closingDate) {
      continue;
    }

    const packageName = normalizePackage(
      getRowValue(row, "PACKAGE", "AC", "PACKAGE NAME")
    );

    if (packageName !== "FIBERX" && packageName !== "SME" && packageName !== "BIDA") {
      continue;
    }

    parsed.push({
      joNumber,
      province: normalizeProvince(
        getRowValue(row, "STATEORPROVINCE", "G", "PROVINCE")
      ),
      sliType: normalizeSLI(row),
      package: packageName,
      mrc: numberValue(getRowValue(row, "MRC", "AE", "AMOUNT")),
      closingDate,
      sla: normalizeSLA(getRowValue(row, "SLA", "Y", "Ageing", "Aging")),
    });
  }

  // De-duplicate using UNIQUE JO NUMBER
  const unique = new Map<string, ParsedJO>();
  for (const item of parsed) {
    if (!unique.has(item.joNumber)) {
      unique.set(item.joNumber, item);
    }
  }

  return Array.from(unique.values());
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

function useLiveGoogleSheet() {
  const [state, setState] = useState<LiveState>({
    sourceName: "Live Google Sheet",
    joRows: [],
    summaryRows: [],
    targetsMap: {
      Albay: { fiberX: 0, sme: 0, bida: 0 },
      Sorsogon: { fiberX: 0, sme: 0, bida: 0 },
      Masbate: { fiberX: 0, sme: 0, bida: 0 },
      "All districts": { fiberX: 0, sme: 0, bida: 0 },
      ALBAY: { fiberX: 0, sme: 0, bida: 0 },
      SORSOGON: { fiberX: 0, sme: 0, bida: 0 },
      MASBATE: { fiberX: 0, sme: 0, bida: 0 },
      ALMASOR: { fiberX: 0, sme: 0, bida: 0 },
    },
    lastSynced: null,
    syncing: false,
    error: "",
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
      // Fetch JO ACTIVATED and targets concurrently
      const [joRows, summaryRows, liveTargets] = await Promise.all([
        fetchJOActivated(),
        fetchSummary().catch(() => []),
        fetchAllTargets().catch((err) => {
          console.warn("Direct range targets fallback:", err);
          return null;
        }),
      ]);

      if (!mountedRef.current) return;

      const finalTargets =
        liveTargets || parseTargetsFromSummaryRows(summaryRows);

      setState({
        sourceName: "Live Google Sheet",
        joRows,
        summaryRows,
        targetsMap: finalTargets,
        lastSynced: new Date(),
        syncing: false,
        error: "",
      });
    } catch (err: any) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        syncing: false,
        error: err?.message || "Unable to refresh Google Sheet.",
      }));
    }
  }, []);

  const setManualExcel = useCallback(
    (excelJo: RawRow[], excelSummary: RawRow[], fileName: string) => {
      const parsedTargets = parseTargetsFromSummaryRows(excelSummary);
      setState({
        sourceName: fileName,
        joRows: excelJo,
        summaryRows: excelSummary,
        targetsMap: parsedTargets,
        lastSynced: new Date(),
        syncing: false,
        error: "",
      });
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

export default function App() {
  const {
    sourceName,
    joRows,
    targetsMap,
    lastSynced,
    syncing,
    error,
    refresh,
    setManualExcel,
  } = useLiveGoogleSheet();

  const [filters, setFilters] = useState<Filters>({
    month: DEFAULT_MONTH,
    province: "All districts",
    sliType: "All SLI Types",
    package: "All Packages",
  });

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);

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

  // All unique records in selected month (unfiltered territory scope)
  const monthRows = useMemo(
    () => rows.filter((r) => monthKey(r.closingDate) === filters.month),
    [rows, filters.month]
  );

  // Filtered records respecting all dropdown filters
  const filteredRows = useMemo(
    () =>
      monthRows.filter(
        (r) =>
          matchesProvince(r, filters.province) &&
          matchesSLI(r, filters.sliType) &&
          matchesPackage(r, filters.package)
      ),
    [monthRows, filters.province, filters.sliType, filters.package]
  );

  // Package section scope: respects province and SLI filters
  const packageRows = useMemo(
    () =>
      monthRows.filter(
        (r) =>
          matchesProvince(r, filters.province) && matchesSLI(r, filters.sliType)
      ),
    [monthRows, filters.province, filters.sliType]
  );

  // Active target for current province filter
  const activeTargets: Targets = useMemo(() => {
    return (
      targetsMap[filters.province] ||
      targetsMap["All districts"] || { fiberX: 0, sme: 0, bida: 0 }
    );
  }, [targetsMap, filters.province]);

  // Overall Almasor targets from Row 29
  const almasorTargets: Targets = useMemo(() => {
    return (
      targetsMap["All districts"] ||
      targetsMap["ALMASOR"] || { fiberX: 0, sme: 0, bida: 0 }
    );
  }, [targetsMap]);

  // Provincial targets mapping
  const provincialTargets = useMemo(
    () => ({
      ALBAY: targetsMap["ALBAY"] || targetsMap["Albay"] || { fiberX: 0, sme: 0, bida: 0 },
      MASBATE: targetsMap["MASBATE"] || targetsMap["Masbate"] || { fiberX: 0, sme: 0, bida: 0 },
      SORSOGON: targetsMap["SORSOGON"] || targetsMap["Sorsogon"] || { fiberX: 0, sme: 0, bida: 0 },
    }),
    [targetsMap]
  );

  /*
    1. MAIN KPI METRICS
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
    2. PACKAGE BREAKDOWN METRICS
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
    3. SLI CHANNEL METRICS
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
    4. MTD VS TARGET — ALMASOR SCOPE (Full month territory scope)
  */
  const almasorRunning = useMemo(() => {
    let fiberX = 0;
    let smeMRC = 0;
    let bida = 0;

    for (const r of monthRows) {
      if (r.package === "FIBERX") fiberX++;
      if (r.package === "SME") smeMRC += r.mrc || 0;
      if (r.package === "BIDA") bida++;
    }

    return { fiberX, smeMRC, bida };
  }, [monthRows]);

  /*
    5. MTD VS TARGET — PROVINCIAL SCOPE
  */
  const provincialRunning = useMemo(() => {
    const albayRows = monthRows.filter((r) => r.province === "ALBAY");
    const masbateRows = monthRows.filter((r) => r.province === "MASBATE");
    const sorsogonRows = monthRows.filter((r) => r.province === "SORSOGON");

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
  }, [monthRows]);

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

      result.push({
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        fiberXRunning: running,
        target: Number(runningTarget.toFixed(2)),
      });
    }

    return result;
  }, [monthRows, filters.province, filters.sliType, filters.month, activeTargets.fiberX]);

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
            1. HEADER & LIVE STATUS
        ================================================= */}
        <header className="mb-5" id="dashboard-header">
          <div className="flex items-start justify-between gap-5 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#123b31]">
                Sales performance
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Monthly view of MTD progress against target across the Almasor territory.
              </p>
            </div>

            <div className="flex gap-2.5 flex-wrap">
              <select
                className="bg-white border border-[#cfe4da] rounded-xl px-4 py-2 font-medium text-gray-700 cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0aa37a]"
                value={filters.month}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, month: e.target.value }))
                }
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {formatMonth(month)}
                  </option>
                ))}
              </select>

              <button
                onClick={() => refresh()}
                disabled={syncing}
                className="px-4 py-2 rounded-xl bg-[#dff7ec] border border-[#b5e6d0] text-[#0b684e] font-semibold disabled:opacity-50 cursor-pointer hover:bg-[#cbf1e0] transition-colors shadow-sm"
              >
                {syncing ? "Updating..." : "Refresh now"}
              </button>

              <button
                onClick={() => fileRef.current?.click()}
                disabled={excelLoading}
                className="px-4 py-2 rounded-xl bg-white border border-[#cfe4da] text-[#0b684e] font-semibold disabled:opacity-50 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm"
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

          {/* LIVE STATUS BAR */}
          <div className="mt-5 rounded-xl border border-[#c9ebdd] bg-[#e8f8f0] px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 text-sm">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  syncing
                    ? "bg-yellow-500 animate-pulse"
                    : error
                    ? "bg-red-500"
                    : "bg-[#0aa37a]"
                }`}
              />

              <span className="font-semibold text-gray-800">
                {syncing
                  ? "Updating live data..."
                  : error
                  ? "Live update issue"
                  : sourceName}
              </span>

              {lastSynced && (
                <span className="text-gray-500">
                  • Last updated{" "}
                  {lastSynced.toLocaleTimeString("en-PH", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              )}
            </div>

            <div className="text-sm font-semibold text-[#0a684d]">
              {formatCount(monthRows.length)} unique JOs in {formatMonth(filters.month)}
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Unable to refresh live data. Displaying the most recent cached records.
            </div>
          )}
        </header>

        {/* ================================================
            2. FILTERS
        ================================================= */}
        <section className="bg-white rounded-2xl border border-[#dcece6] p-4 mb-6 shadow-sm" id="dashboard-filters">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="font-semibold text-sm text-gray-600">Province:</label>
            <select
              className="rounded-xl border border-[#dcece6] px-3.5 py-2 bg-white text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0aa37a]"
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

            <label className="font-semibold text-sm text-gray-600 ml-2">SLI Type:</label>
            <select
              className="rounded-xl border border-[#dcece6] px-3.5 py-2 bg-white text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0aa37a]"
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

            <label className="font-semibold text-sm text-gray-600 ml-2">Package:</label>
            <select
              className="rounded-xl border border-[#dcece6] px-3.5 py-2 bg-white text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-[#0aa37a]"
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

            <button
              className="ml-auto bg-gray-100 px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
              onClick={() =>
                setFilters({
                  month: DEFAULT_MONTH,
                  province: "All districts",
                  sliType: "All SLI Types",
                  package: "All Packages",
                })
              }
            >
              Reset filters
            </button>
          </div>
        </section>

        {/* ================================================
            3. ACTIVATED JO COUNT & TOTAL MRC
        ================================================= */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7" id="main-kpi-cards">
          {/* Activated JO Count */}
          <div className="bg-[#15553f] text-white rounded-3xl p-7 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">
                Activated JO Count
              </div>
              <div className="text-6xl font-black mt-4 tracking-tight">
                {formatCount(mainKpis.activatedJO)}
              </div>
            </div>
            <div className="text-sm opacity-80 mt-4">
              Total unique activated job orders for {formatMonth(filters.month)}
            </div>
          </div>

          {/* Total MRC */}
          <div className="bg-white border border-[#dcece6] rounded-3xl p-7 shadow-sm flex flex-col justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Total MRC
              </div>
              <div className="text-5xl font-extrabold mt-4 text-[#073d2d] tracking-tight">
                {formatPeso(mainKpis.totalMRC)}
              </div>
            </div>
            <div className="text-sm text-gray-500 mt-4">
              Consolidated recurring revenue from activated subscriptions in scope.
            </div>
          </div>
        </section>

        {/* ================================================
            4. PACKAGE BREAKDOWN (FIBERX, SME, BIDA)
        ================================================= */}
        <div className="mb-3">
          <h2 className="text-xl font-bold text-[#123b31]">
            Package breakdown
            <span className="font-normal text-sm text-gray-500 ml-2">
              (Respecting province and SLI filters)
            </span>
          </h2>
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

        {/* Target summary cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7" id="target-summary-cards">
          <TargetCard title="FiberX Target" value={formatCount(activeTargets.fiberX)} />
          <TargetCard title="SME Target" value={formatPeso(activeTargets.sme)} />
          <TargetCard title="BIDA Target" value={formatCount(activeTargets.bida)} />
        </section>

        {/* ================================================
            5. SLI CHANNEL BREAKDOWN (INHOUSE, MSA)
        ================================================= */}
        <div className="mb-3">
          <h2 className="text-xl font-bold text-[#123b31]">
            SLI channel breakdown
            <span className="font-normal text-sm text-gray-500 ml-2">
              (Respecting active package and province filters)
            </span>
          </h2>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8" id="sli-breakdown">
          <ChannelCard title="INHOUSE" value={sliMetrics.inhouse} />
          <ChannelCard title="MSA" value={sliMetrics.msa} />
        </section>

        {/* ================================================
            6. MTD VS TARGET — ALMASOR (FIBERX, SME, BIDA)
        ================================================= */}
        <MtdVsTargetAlmasor
          runningFiberX={almasorRunning.fiberX}
          runningSmeMRC={almasorRunning.smeMRC}
          runningBida={almasorRunning.bida}
          targets={almasorTargets}
        />

        {/* ================================================
            7. MTD VS TARGET — BY PROVINCE (ALBAY, MASBATE, SORSOGON)
        ================================================= */}
        <MtdVsTargetProvince
          provinceMetrics={provincialRunning}
          targetsByProvince={provincialTargets}
        />

        {/* ================================================
            8. FIBERX RUNNING VS TARGET CHART
        ================================================= */}
        <section className="bg-white border border-[#dcece6] rounded-2xl p-6 shadow-sm mb-8" id="fiberx-chart">
          <div className="flex justify-between items-start gap-5 mb-5 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-[#123b31]">
                FiberX Running vs Target
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Monthly cumulative FiberX activations compared with the running target trajectory.
              </p>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">Monthly FiberX Target</div>
                <div className="text-xl font-bold text-[#0a684d]">
                  {formatCount(activeTargets.fiberX)}
                </div>
              </div>

              <div className="text-right pl-4 border-l border-[#e2ece7]">
                <div className="text-xs text-gray-500 font-medium">Progress</div>
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
            9. TOTAL CLOSED (TABLES 1, 2, 3)
        ================================================= */}
        <TotalClosedTables
          rows={filteredRows}
          monthName={formatMonth(filters.month)}
        />

        {/* ================================================
            10. SLA PERFORMANCE (TABLE & PROGRESS VISUALIZATION)
        ================================================= */}
        <SlaPerformanceSection rows={filteredRows} />
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
