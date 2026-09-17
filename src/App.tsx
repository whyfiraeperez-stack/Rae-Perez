import React, { useMemo, useRef, useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const GOOGLE_SHEET_ID =
  "17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg";

const GOOGLE_SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`;

const MONTH_OPTIONS = [
  "2026-09",
];

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
  SUMMARY target rows from the workbook.

  D = FIBERX
  E = SME
  F = BIDA
*/
const TARGET_ROWS = {
  "All districts": 29,
  Albay: 11,
  Sorsogon: 17,
  Masbate: 23,
} as const;

type Row = Record<string, any>;

type Filters = {
  month: string;
  province: string;
  sliType: string;
  package: string;
};

type Targets = {
  fiberX: number;
  sme: number;
  bida: number;
};

type ParsedJo = {
  joNumber: string;
  province: string;
  sliType: string;
  package: string;
  mrc: number;
  closingDate: Date;
};

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
  return normalizeText(value);
}

function normalizePackage(value: any): string {
  const v = compactText(value);

  if (v === "FIBERX" || v.startsWith("FIBERX")) {
    return "FIBERX";
  }

  if (v === "SME" || v.startsWith("SME")) {
    return "SME";
  }

  if (v === "BIDA" || v.startsWith("BIDA")) {
    return "BIDA";
  }

  if (v === "S2S" || v.startsWith("S2S")) {
    return "S2S";
  }

  return v;
}

function normalizeSli(row: Row): string {
  const sli = normalizeText(row["SLI TYPE"]);

  if (sli === "INHOUSE") return "INHOUSE";
  if (sli === "MSA") return "MSA";

  // Fallback used when SLI TYPE is blank/unavailable in Excel.
  const vendor = normalizeText(row["VENDOR TYPE"]);

  if (vendor === "INHOUSE") return "INHOUSE";
  if (vendor === "MSA") return "MSA";

  return "";
}

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

  const n = Number(cleaned);

  return Number.isFinite(n) ? n : 0;
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

  // Google Visualization API:
  // Date(2026,8,17)
  const googleDate = raw.match(
    /^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)$/
  );

  if (googleDate) {
    return new Date(
      Number(googleDate[1]),
      Number(googleDate[2]),
      Number(googleDate[3])
    );
  }

  // Excel serial date
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {
    const serial = Number(raw);

    if (serial > 20000 && serial < 80000) {
      const excelEpoch = new Date(
        Date.UTC(1899, 11, 30)
      );

      const date = new Date(
        excelEpoch.getTime() +
          serial * 24 * 60 * 60 * 1000
      );

      return new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      );
    }
  }

  const formats = [
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  ];

  const dmyMonth = raw.match(formats[0]);

  if (dmyMonth) {
    const parsed = new Date(
      `${dmyMonth[2]} ${dmyMonth[1]}, ${dmyMonth[3]}`
    );

    if (!isNaN(parsed.getTime())) {
      return new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate()
      );
    }
  }

  const slashDate = raw.match(formats[1]);

  if (slashDate) {
    return new Date(
      Number(slashDate[3]),
      Number(slashDate[1]) - 1,
      Number(slashDate[2])
    );
  }

  const isoDate = raw.match(formats[2]);

  if (isoDate) {
    return new Date(
      Number(isoDate[1]),
      Number(isoDate[2]) - 1,
      Number(isoDate[3])
    );
  }

  const generic = new Date(raw);

  if (!isNaN(generic.getTime())) {
    return new Date(
      generic.getFullYear(),
      generic.getMonth(),
      generic.getDate()
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

export function daysInSelectedMonth(month: string): number {
  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  return new Date(
    year,
    monthNumber,
    0
  ).getDate();
}

function monthDisplay(month: string): string {
  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  return new Date(
    year,
    monthNumber - 1,
    1
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function shortMonthDisplay(month: string): string {
  const [year, monthNumber] = month
    .split("-")
    .map(Number);

  return new Date(
    year,
    monthNumber - 1,
    1
  ).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-PH");
}

function formatPeso(value: number): string {
  return `₱${numberValue(value).toLocaleString("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function achievement(
  actual: number,
  target: number
): number {
  if (!Number.isFinite(target) || target <= 0) {
    return 0;
  }

  if (!Number.isFinite(actual)) {
    return 0;
  }

  return (actual / target) * 100;
}

function filterMatches(
  row: ParsedJo,
  filters: Filters
): boolean {
  if (
    filters.province !== "All districts" &&
    row.province !== normalizeProvince(filters.province)
  ) {
    return false;
  }

  if (
    filters.sliType !== "All SLI Types" &&
    row.sliType !== normalizeText(filters.sliType)
  ) {
    return false;
  }

  return true;
}

function packageFilterMatches(
  row: ParsedJo,
  filters: Filters
): boolean {
  if (
    filters.package !== "All Packages" &&
    row.package !== normalizePackage(filters.package)
  ) {
    return false;
  }

  return true;
}

/*
  Convert raw spreadsheet records to clean JO records.
*/
function buildParsedRows(
  rawRows: Row[]
): ParsedJo[] {
  const clean: ParsedJo[] = [];

  for (const row of rawRows) {
    const joNumber = String(
      row["JO NUMBER"] ?? ""
    ).trim();

    if (!joNumber || joNumber === "JO NUMBER") continue;

    const closingDate = parseDate(
      row["CLOSING DATE"]
    );

    if (!closingDate) continue;

    const packageName = normalizePackage(
      row["PACKAGE"]
    );

    if (
      packageName !== "FIBERX" &&
      packageName !== "SME" &&
      packageName !== "BIDA"
    ) {
      continue;
    }

    clean.push({
      joNumber,
      province: normalizeProvince(
        row["STATEORPROVINCE"]
      ),
      sliType: normalizeSli(row),
      package: packageName,
      mrc: numberValue(row["MRC"]),
      closingDate,
    });
  }

  /*
    Remove duplicate JO numbers.

    This is important because the dashboard should not
    double count a JO if the source contains duplicate rows.
  */
  const unique = new Map<string, ParsedJo>();

  for (const row of clean) {
    if (!unique.has(row.joNumber)) {
      unique.set(row.joNumber, row);
    }
  }

  return Array.from(unique.values());
}

/*
  Google Visualization API parser.
*/
async function fetchGviz(
  sheetName: string,
  query: string
): Promise<any> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq?` +
    `tqx=out:json` +
    `&sheet=${encodeURIComponent(sheetName)}` +
    `&tq=${encodeURIComponent(query)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Unable to read ${sheetName}: HTTP ${response.status}`
    );
  }

  const text = await response.text();

  const match = text.match(
    /google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/
  );

  if (!match) {
    throw new Error(
      `${sheetName} returned an unreadable Google Visualization response.`
    );
  }

  const json = JSON.parse(match[1]);

  if (json.status === "error") {
    throw new Error(
      json.errors?.[0]?.detailed_message ||
      json.errors?.[0]?.message ||
      `Google Sheet query failed for ${sheetName}.`
    );
  }

  return json.table;
}

/*
  Read only the columns actually required from JO ACTIVATED.

  G  = Province
  S  = SLI TYPE
  U  = VENDOR TYPE fallback
  AC = PACKAGE
  AE = MRC
  AF = CLOSING DATE
  A  = JO NUMBER
*/
async function fetchJoActivatedFromGoogle(): Promise<Row[]> {
  const table = await fetchGviz(
    "JO ACTIVATED",
    `
      select A,G,S,U,AC,AE,AF
      where AF is not null
    `
  );

  return table.rows.map((row: any) => {
    const values = row.c || [];

    return {
      "JO NUMBER": values[0]?.v ?? "",
      "STATEORPROVINCE": values[1]?.v ?? "",
      "SLI TYPE": values[2]?.v ?? "",
      "VENDOR TYPE": values[3]?.v ?? "",
      "PACKAGE": values[4]?.v ?? "",
      "MRC": values[5]?.v ?? "",
      "CLOSING DATE": values[6]?.v ?? "",
    };
  });
}

/*
  SUMMARY is read directly from the target cells.

  Row numbers:
  11 = Albay
  17 = Sorsogon
  23 = Masbate
  29 = Overall

  Columns:
  D = FiberX
  E = SME
  F = BIDA

  No target values are hard-coded here.
*/
async function fetchTargetRow(
  rowNumber: number
): Promise<Targets> {
  const table = await fetchGviz(
    "SUMMARY",
    `select C,D,E,F`
  );

  /*
    Gviz "select C,D,E,F" returns the SUMMARY table.
    We look in the rowNumber area for the row where Column C is "Target",
    falling back to Math.abs of the row values to guarantee positive targets.
  */
  let targetRow = table.rows[rowNumber - 1];

  // If the indexed row isn't explicitly "Target", search nearby rows
  if (targetRow) {
    const cLabel = String(targetRow.c?.[0]?.v || "").trim().toUpperCase();
    if (cLabel !== "TARGET") {
      for (let offset = -3; offset <= 3; offset++) {
        const candidate = table.rows[rowNumber - 1 + offset];
        if (
          candidate &&
          String(candidate.c?.[0]?.v || "").trim().toUpperCase() === "TARGET"
        ) {
          targetRow = candidate;
          break;
        }
      }
    }
  }

  if (!targetRow) {
    throw new Error(
      `SUMMARY target row ${rowNumber} could not be found.`
    );
  }

  const cells = targetRow.c || [];

  return {
    fiberX: Math.abs(numberValue(cells[1]?.v)),
    sme: Math.abs(numberValue(cells[2]?.v)),
    bida: Math.abs(numberValue(cells[3]?.v)),
  };
}

async function fetchAllTargets(): Promise<
  Record<string, Targets>
> {
  const [
    overall,
    albay,
    sorsogon,
    masbate,
  ] = await Promise.all([
    fetchTargetRow(29),
    fetchTargetRow(11),
    fetchTargetRow(17),
    fetchTargetRow(23),
  ]);

  return {
    "All districts": overall,
    Albay: albay,
    Sorsogon: sorsogon,
    Masbate: masbate,
  };
}

export default function App() {
  const [rows, setRows] = useState<ParsedJo[]>([]);
  const [targetsByProvince, setTargetsByProvince] =
    useState<Record<string, Targets>>({});

  const [source, setSource] = useState(
    "No source loaded"
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement | null>(null);

  const [filters, setFilters] = useState<Filters>({
    month: "2026-09",
    province: "All districts",
    sliType: "All SLI Types",
    package: "All Packages",
  });

  /*
    Sync Google Sheet.
  */
  async function syncGoogleSheet() {
    setLoading(true);
    setError("");

    try {
      const [
        rawRows,
        targetRows,
      ] = await Promise.all([
        fetchJoActivatedFromGoogle(),
        fetchAllTargets(),
      ]);

      setRows(buildParsedRows(rawRows));
      setTargetsByProvince(targetRows);
      setSource("Google Sheet");
    } catch (err: any) {
      setError(
        err?.message ||
        "Google Sheet synchronization failed."
      );
    } finally {
      setLoading(false);
    }
  }

  // Auto-sync Google Sheet on initial page mount
  useEffect(() => {
    syncGoogleSheet();
  }, []);

  /*
    Excel sync.
  */
  async function syncExcel(file: File) {
    setLoading(true);
    setError("");

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: true,
      });

      const joSheet =
        workbook.Sheets["JO ACTIVATED"];

      if (!joSheet) {
        throw new Error(
          "JO ACTIVATED sheet was not found."
        );
      }

      const summarySheet =
        workbook.Sheets["SUMMARY"];

      const rawRows =
        XLSX.utils.sheet_to_json<Row>(
          joSheet,
          { defval: "" }
        );

      /*
        For Excel import we also try SUMMARY.

        If SUMMARY is empty in an exported workbook
        containing Google-only formulas, we do not invent
        target values.
      */
      let targetRows: Record<string, Targets> =
        {};

      if (summarySheet) {
        const summaryMatrix =
          XLSX.utils.sheet_to_json<any[][]>(
            summarySheet,
            {
              header: 1,
              defval: "",
            }
          );

        function readSummaryRow(
          rowNumber: number
        ): Targets | null {
          let row =
            summaryMatrix[rowNumber - 1];

          // Check if row has "Target" in column C (index 2)
          if (row && String(row[2] || "").trim().toUpperCase() !== "TARGET") {
            for (let offset = -3; offset <= 3; offset++) {
              const candidate = summaryMatrix[rowNumber - 1 + offset];
              if (
                candidate &&
                String(candidate[2] || "").trim().toUpperCase() === "TARGET"
              ) {
                row = candidate;
                break;
              }
            }
          }

          if (!row) return null;

          return {
            fiberX: Math.abs(numberValue(row[3])),
            sme: Math.abs(numberValue(row[4])),
            bida: Math.abs(numberValue(row[5])),
          };
        }

        const overall = readSummaryRow(29);
        const albay = readSummaryRow(11);
        const sorsogon = readSummaryRow(17);
        const masbate = readSummaryRow(23);

        if (overall) {
          targetRows["All districts"] = overall;
        }

        if (albay) {
          targetRows["Albay"] = albay;
        }

        if (sorsogon) {
          targetRows["Sorsogon"] = sorsogon;
        }

        if (masbate) {
          targetRows["Masbate"] = masbate;
        }
      }

      setRows(buildParsedRows(rawRows));
      setTargetsByProvince(targetRows);
      setSource(file.name);

      if (
        Object.keys(targetRows).length === 0
      ) {
        setError(
          "The JO ACTIVATED data loaded correctly, but SUMMARY target cells were not readable in this Excel export. Google Sheet sync should be used for live targets."
        );
      }
    } catch (err: any) {
      setError(
        err?.message ||
        "Excel synchronization failed."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
    Selected month.
  */
  const monthRows = useMemo(() => {
    return rows.filter(
      (row) =>
        monthKey(row.closingDate) ===
        filters.month
    );
  }, [rows, filters.month]);

  /*
    Main dashboard scope:
      month + province + SLI + package
  */
  const mainScopeRows = useMemo(() => {
    return monthRows.filter((row) => {
      if (
        !filterMatches(row, filters)
      ) {
        return false;
      }

      if (
        !packageFilterMatches(row, filters)
      ) {
        return false;
      }

      return true;
    });
  }, [monthRows, filters]);

  /*
    Package cards:
      month + province + SLI

    Package selector is intentionally excluded,
    so FiberX / SME / BIDA remain visible together.
  */
  const packageScopeRows = useMemo(() => {
    return monthRows.filter((row) =>
      filterMatches(row, filters)
    );
  }, [monthRows, filters]);

  /*
    Active province target.
  */
  const targets: Targets =
    targetsByProvince[filters.province] || {
      fiberX: 0,
      sme: 0,
      bida: 0,
    };

  /*
    Main KPI calculations.
  */
  const kpis = useMemo(() => {
    let totalMRC = 0;

    let fiberXCount = 0;
    let fiberXMRC = 0;

    let smeCount = 0;
    let smeMRC = 0;

    let bidaCount = 0;
    let bidaMRC = 0;

    for (const row of mainScopeRows) {
      totalMRC += row.mrc;

      if (row.package === "FIBERX") {
        fiberXCount++;
        fiberXMRC += row.mrc;
      }

      if (row.package === "SME") {
        smeCount++;
        smeMRC += row.mrc;
      }

      if (row.package === "BIDA") {
        bidaCount++;
        bidaMRC += row.mrc;
      }
    }

    return {
      activatedJoCount:
        mainScopeRows.length,

      totalMRC,

      fiberXCount,
      fiberXMRC,

      smeCount,
      smeMRC,

      bidaCount,
      bidaMRC,
    };
  }, [mainScopeRows]);

  /*
    Package metrics ignore Package filter.
  */
  const packageMetrics = useMemo(() => {
    let fiberX = 0;
    let fiberXMRC = 0;

    let sme = 0;
    let smeMRC = 0;

    let bida = 0;
    let bidaMRC = 0;

    for (const row of packageScopeRows) {
      if (row.package === "FIBERX") {
        fiberX++;
        fiberXMRC += row.mrc;
      }

      if (row.package === "SME") {
        sme++;
        smeMRC += row.mrc;
      }

      if (row.package === "BIDA") {
        bida++;
        bidaMRC += row.mrc;
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
  }, [packageScopeRows]);

  /*
    SLI metrics respect package selector.
  */
  const sliMetrics = useMemo(() => {
    let inhouse = 0;
    let msa = 0;

    for (const row of mainScopeRows) {
      if (row.sliType === "INHOUSE") {
        inhouse++;
      }

      if (row.sliType === "MSA") {
        msa++;
      }
    }

    return {
      inhouse,
      msa,
    };
  }, [mainScopeRows]);

  /*
    FiberX running chart.

    The chart respects:
      - month
      - province
      - SLI type

    Package filter is ignored because the chart is
    specifically FiberX.
  */
  const fiberChart = useMemo(() => {
    const [year, monthNumber] =
      filters.month.split("-").map(Number);

    const totalDays = new Date(
      year,
      monthNumber,
      0
    ).getDate();

    const fiberRows = monthRows.filter(
      (row) =>
        row.package === "FIBERX" &&
        filterMatches(row, filters)
    );

    const countByDate =
      new Map<string, number>();

    for (const row of fiberRows) {
      const key = dateKey(row.closingDate);

      countByDate.set(
        key,
        (countByDate.get(key) || 0) + 1
      );
    }

    const chart = [];

    let running = 0;

    for (
      let day = 1;
      day <= totalDays;
      day++
    ) {
      const date = new Date(
        year,
        monthNumber - 1,
        day
      );

      const key = dateKey(date);

      running +=
        countByDate.get(key) || 0;

      const runningTarget =
        targets.fiberX *
        (day / totalDays);

      chart.push({
        date: date.toLocaleDateString(
          "en-US",
          {
            month: "short",
            day: "numeric",
          }
        ),

        fiberXRunning: running,

        target:
          Number(
            runningTarget.toFixed(2)
          ),
      });
    }

    return chart;
  }, [
    monthRows,
    filters,
    targets.fiberX,
  ]);

  const fiberAchievement =
    achievement(
      packageMetrics.fiberX,
      targets.fiberX
    );

  const smeAchievement =
    achievement(
      packageMetrics.smeMRC,
      targets.sme
    );

  const bidaAchievement =
    achievement(
      packageMetrics.bida,
      targets.bida
    );

  return (
    <div className="min-h-screen bg-[#f7faf9] text-[#123b31]">
      <div className="max-w-[1500px] mx-auto px-6 py-6">

        {/* HEADER */}
        <header className="mb-5">
          <div className="flex items-start justify-between gap-5 flex-wrap">

            <div>
              <h1 className="text-3xl font-bold">
                Sales performance
              </h1>

              <p className="text-sm text-gray-500 mt-1">
                Monthly view of MTD progress
                against target across the
                Almasor territory.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">

              <select
                className="bg-white border border-[#cfe4da] rounded-xl px-4 py-2"
                value={filters.month}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    month: e.target.value,
                  })
                }
              >
                {MONTH_OPTIONS.map(
                  (month) => (
                    <option
                      key={month}
                      value={month}
                    >
                      {monthDisplay(month)}
                    </option>
                  )
                )}
              </select>

              <button
                onClick={syncGoogleSheet}
                className="px-4 py-2 rounded-xl bg-[#dff7ec] border border-[#b5e6d0] text-[#0b684e] font-semibold cursor-pointer hover:bg-[#c9f0df] transition-colors"
              >
                {loading
                  ? "Syncing..."
                  : "Sync Google Sheet"}
              </button>

              <button
                onClick={() =>
                  fileRef.current?.click()
                }
                className="px-4 py-2 rounded-xl bg-[#dff7ec] border border-[#b5e6d0] text-[#0b684e] font-semibold cursor-pointer hover:bg-[#c9f0df] transition-colors"
              >
                Sync Excel
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file =
                    e.target.files?.[0];

                  if (file) {
                    syncExcel(file);
                  }
                }}
              />
            </div>
          </div>

          {/* SOURCE STATUS */}
          <div className="mt-5 rounded-xl border border-[#c9ebdd] bg-[#e8f8f0] px-4 py-3 flex justify-between items-center gap-3 flex-wrap">

            <div className="text-sm">
              <span className="font-semibold">
                Dynamic Sheet Sync
              </span>

              <span className="mx-2 text-gray-400">
                •
              </span>

              Source:
              <strong className="ml-1">
                {source}
              </strong>

              <span className="mx-2 text-gray-400">
                •
              </span>

              {formatCount(
                monthRows.length
              )}{" "}
              JOs in selected month
            </div>

            <div className="text-sm font-semibold">
              {monthDisplay(filters.month)}
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl border border-yellow-300 bg-yellow-50 text-yellow-800 text-sm">
              {error}
            </div>
          )}
        </header>

        {/* FILTERS */}
        <section className="bg-white rounded-2xl border border-[#dcece6] p-4 mb-5">

          <div className="flex items-center gap-3 flex-wrap">

            <label className="font-medium text-sm">
              Province:
            </label>

            <select
              className="rounded-xl border border-[#dcece6] px-4 py-2 bg-white"
              value={filters.province}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  province:
                    e.target.value,
                })
              }
            >
              {PROVINCES.map(
                (province) => (
                  <option
                    key={province}
                  >
                    {province}
                  </option>
                )
              )}
            </select>

            <label className="font-medium text-sm ml-2">
              SLI Type:
            </label>

            <select
              className="rounded-xl border border-[#dcece6] px-4 py-2 bg-white"
              value={filters.sliType}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  sliType:
                    e.target.value,
                })
              }
            >
              {SLI_TYPES.map((sli) => (
                <option key={sli}>
                  {sli}
                </option>
              ))}
            </select>

            <label className="font-medium text-sm ml-2">
              Package:
            </label>

            <select
              className="rounded-xl border border-[#dcece6] px-4 py-2 bg-white"
              value={filters.package}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  package:
                    e.target.value,
                })
              }
            >
              {PACKAGES.map((pkg) => (
                <option key={pkg}>
                  {pkg}
                </option>
              ))}
            </select>

            <button
              className="ml-auto bg-gray-100 px-4 py-2 rounded-xl text-gray-600 cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={() =>
                setFilters({
                  month: "2026-09",
                  province: "All districts",
                  sliType:
                    "All SLI Types",
                  package:
                    "All Packages",
                })
              }
            >
              Reset
            </button>
          </div>
        </section>

        {/* KPI CARDS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

          <div className="bg-[#15553f] text-white rounded-3xl p-7">

            <div className="text-sm font-semibold uppercase opacity-80">
              Activated JO Count
            </div>

            <div className="text-6xl font-bold mt-5">
              {formatCount(
                kpis.activatedJoCount
              )}
            </div>

            <div className="text-sm opacity-80 mt-3">
              Total activated job orders
              for {monthDisplay(
                filters.month
              )}
            </div>
          </div>

          <div className="bg-white border border-[#dcece6] rounded-3xl p-7">

            <div className="text-sm uppercase text-gray-600">
              Total MRC
            </div>

            <div className="text-5xl font-bold mt-5 text-[#073d2d]">
              {formatPeso(
                kpis.totalMRC
              )}
            </div>

            <div className="text-sm text-gray-500 mt-3">
              Consolidated recurring revenue
              from activated subscriptions
              in scope.
            </div>
          </div>
        </section>

        {/* PACKAGE BREAKDOWN */}
        <h2 className="text-xl font-bold mb-3">
          Package breakdown
          <span className="font-normal text-sm text-gray-500 ml-2">
            Respecting province and SLI filters
          </span>
        </h2>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">

          <PackageCard
            title="FIBERX"
            label="Core Fiber"
            running={
              packageMetrics.fiberX
            }
            target={
              targets.fiberX
            }
            percentage={
              fiberAchievement
            }
            footerLabel="Total MRC:"
            footerValue={formatPeso(
              packageMetrics.fiberXMRC
            )}
          />

          <PackageCard
            title="SME"
            label="Enterprise"
            running={
              packageMetrics.smeMRC
            }
            runningLabel="Running MRC"
            target={
              targets.sme
            }
            percentage={
              smeAchievement
            }
            money
            footerLabel="Activated JOs:"
            footerValue={formatCount(
              packageMetrics.sme
            )}
          />

          <PackageCard
            title="BIDA"
            label="Affordable"
            running={
              packageMetrics.bida
            }
            target={
              targets.bida
            }
            percentage={
              bidaAchievement
            }
            footerLabel="Total MRC:"
            footerValue={formatPeso(
              packageMetrics.bidaMRC
            )}
          />

        </section>

        {/* TARGET SUMMARY */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">

          <TargetMini
            title="FiberX Target"
            value={formatCount(
              targets.fiberX
            )}
            type="count"
          />

          <TargetMini
            title="SME Target"
            value={formatPeso(
              targets.sme
            )}
            type="money"
          />

          <TargetMini
            title="BIDA Target"
            value={formatCount(
              targets.bida
            )}
            type="count"
          />

        </section>

        {/* SLI BREAKDOWN */}
        <h2 className="text-xl font-bold mb-3">
          SLI channel breakdown
          <span className="font-normal text-sm text-gray-500 ml-2">
            Respecting active province and package filters
          </span>
        </h2>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7">

          <ChannelCard
            title="INHOUSE"
            value={sliMetrics.inhouse}
          />

          <ChannelCard
            title="MSA"
            value={sliMetrics.msa}
          />

        </section>

        {/* FIBERX GRAPH */}
        <section className="bg-white border border-[#dcece6] rounded-2xl p-6">

          <div className="flex justify-between items-start gap-4 mb-5">

            <div>
              <h2 className="text-xl font-bold">
                FiberX Running vs Target
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                Monthly cumulative FiberX
                activations compared with
                the running target.
              </p>
            </div>

            <div className="text-right">
              <div className="text-xs text-gray-500">
                Monthly FiberX target
              </div>

              <div className="text-lg font-bold text-[#0a684d]">
                {formatCount(
                  targets.fiberX
                )}
              </div>
            </div>

          </div>

          <div className="h-[410px]">

            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={fiberChart}
                margin={{
                  top: 15,
                  right: 20,
                  left: 10,
                  bottom: 5,
                }}
              >

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  tick={{
                    fontSize: 11,
                  }}
                />

                <YAxis
                  allowDecimals={false}
                  label={{
                    value: "Activated JOs",
                    angle: -90,
                    position:
                      "insideLeft",
                  }}
                />

                <Tooltip
                  formatter={(
                    value: any,
                    name: string
                  ) => [
                    Number(value).toLocaleString(),
                    name ===
                    "fiberXRunning"
                      ? "FiberX Running"
                      : "Target",
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
                  activeDot={{
                    r: 5,
                  }}
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

      </div>
    </div>
  );
}

/* ---------------------------------------------
   COMPONENTS
---------------------------------------------- */

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
    <div className="bg-white border border-[#dcece6] rounded-2xl p-5">

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-[#005e47]">
          {title}
        </h3>

        <span className="text-xs px-3 py-1 rounded border border-[#8bdcbb] text-[#087553]">
          {label}
        </span>
      </div>

      <div className="text-sm text-gray-500 mt-5">
        {runningLabel}
      </div>

      <div className="text-3xl font-bold mt-1">
        {money
          ? formatPeso(running)
          : formatCount(running)}
      </div>

      <div className="flex justify-between mt-5 text-sm">
        <span>Target:</span>

        <strong>
          {money
            ? formatPeso(target)
            : formatCount(target)}
        </strong>
      </div>

      <ProgressBar value={percentage} />

      <div className="flex justify-between mt-2 text-sm">
        <span>Achievement:</span>

        <strong>
          {percentage.toFixed(1)}%
        </strong>
      </div>

      <div className="flex justify-between mt-5 pt-4 border-t border-[#f0f5f2] text-sm">
        <span>{footerLabel}</span>

        <strong>
          {footerValue}
        </strong>
      </div>

    </div>
  );
}

function ProgressBar({
  value,
}: {
  value: number;
}) {
  return (
    <div className="mt-3 h-2 bg-[#edf2f0] rounded-full overflow-hidden">
      <div
        className="h-full bg-[#0aa37a] rounded-full transition-all duration-300"
        style={{
          width: `${Math.max(
            0,
            Math.min(100, value)
          )}%`,
        }}
      />
    </div>
  );
}

function ChannelCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="bg-white border border-[#dcece6] rounded-2xl p-6">

      <div className="text-sm text-gray-500">
        {title}
      </div>

      <div className="text-4xl font-bold mt-2 text-[#07563f]">
        {formatCount(value)}
      </div>

    </div>
  );
}

function TargetMini({
  title,
  value,
}: {
  title: string;
  value: string;
  type: "count" | "money";
}) {
  return (
    <div className="bg-[#f1faf6] border border-[#dcece6] rounded-2xl p-5">

      <div className="text-sm text-gray-500">
        {title}
      </div>

      <div className="text-2xl font-bold mt-2 text-[#07563f]">
        {value}
      </div>

    </div>
  );
}
