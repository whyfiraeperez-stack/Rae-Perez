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

/* =========================================================
   CONFIGURATION
========================================================= */

const GOOGLE_SHEET_ID =
  "17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg";

const GOOGLE_SHEET_URL =
  `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`;

/*
  Live refresh interval.

  60 seconds = dashboard checks Google Sheet once per minute.
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
  Current workbook target-row mapping.

  SUMMARY:
    row 11 = ALBAY
    row 17 = SORSOGON
    row 23 = MASBATE
    row 29 = OVERALL

  D = FIBERX
  E = SME
  F = BIDA
*/
const TARGET_ROWS: Record<string, number> = {
  "All districts": 29,
  Albay: 11,
  Sorsogon: 17,
  Masbate: 23,
};

/* =========================================================
   TYPES
========================================================= */

type RawRow = Record<string, any>;

type ParsedJO = {
  joNumber: string;
  province: string;
  sliType: string;
  package: string;
  mrc: number;
  closingDate: Date;
};

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

type LiveState = {
  sourceName: string;
  joRows: RawRow[];
  summaryRows: RawRow[];
  lastSynced: Date | null;
  syncing: boolean;
  error: string;
};

/* =========================================================
   TEXT NORMALIZATION
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
  return normalizeText(value);
}

function normalizePackage(value: any): string {
  const valueText = compactText(value);

  if (
    valueText === "FIBERX" ||
    valueText.startsWith("FIBERX")
  ) {
    return "FIBERX";
  }

  if (
    valueText === "SME" ||
    valueText.startsWith("SME")
  ) {
    return "SME";
  }

  if (
    valueText === "BIDA" ||
    valueText.startsWith("BIDA")
  ) {
    return "BIDA";
  }

  if (
    valueText === "S2S" ||
    valueText.startsWith("S2S")
  ) {
    return "S2S";
  }

  return valueText;
}

/*
  SLI TYPE is the primary source.

  VENDOR TYPE is used as fallback when SLI TYPE
  is blank/unavailable in an Excel export.
*/
function normalizeSLI(row: RawRow): string {
  const sli = normalizeText(
    row["SLI TYPE"] ?? row["S"]
  );

  if (sli === "INHOUSE") {
    return "INHOUSE";
  }

  if (sli === "MSA") {
    return "MSA";
  }

  const vendor = normalizeText(
    row["VENDOR TYPE"] ?? row["U"]
  );

  if (vendor === "INHOUSE") {
    return "INHOUSE";
  }

  if (vendor === "MSA") {
    return "MSA";
  }

  return "";
}

/* =========================================================
   NUMBER NORMALIZATION
========================================================= */

function numberValue(value: any): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const cleaned = String(value)
    .replace(/₱/g, "")
    .replace(/,/g, "")
    .replace(/\s/g, "")
    .trim();

  const result = Number(cleaned);

  return Number.isFinite(result)
    ? result
    : 0;
}

/* =========================================================
   DATE PARSING
========================================================= */

function parseDate(
  value: any
): Date | null {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    value instanceof Date &&
    !isNaN(value.getTime())
  ) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  const raw = String(value).trim();

  /*
    Google Visualization API date:

    Date(2026,8,17)
  */
  const googleDate =
    raw.match(
      /^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)$/
    );

  if (googleDate) {
    return new Date(
      Number(googleDate[1]),
      Number(googleDate[2]),
      Number(googleDate[3])
    );
  }

  /*
    Excel serial number.
  */
  if (/^-?\d+(?:\.\d+)?$/.test(raw)) {

    const serial = Number(raw);

    if (
      serial > 20000 &&
      serial < 80000
    ) {

      const excelEpoch =
        new Date(
          Date.UTC(
            1899,
            11,
            30
          )
        );

      const milliseconds =
        serial *
        24 *
        60 *
        60 *
        1000;

      const date =
        new Date(
          excelEpoch.getTime() +
          milliseconds
        );

      return new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
      );
    }
  }

  /*
    DD-MMM-YYYY
  */
  const dmyMonth = raw.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/
  );

  if (dmyMonth) {

    const date = new Date(
      `${dmyMonth[2]} ${dmyMonth[1]}, ${dmyMonth[3]}`
    );

    if (!isNaN(date.getTime())) {
      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );
    }
  }

  /*
    MM/DD/YYYY
  */
  const slashDate = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (slashDate) {
    return new Date(
      Number(slashDate[3]),
      Number(slashDate[1]) - 1,
      Number(slashDate[2])
    );
  }

  /*
    YYYY-MM-DD
  */
  const isoDate = raw.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (isoDate) {
    return new Date(
      Number(isoDate[1]),
      Number(isoDate[2]) - 1,
      Number(isoDate[3])
    );
  }

  /*
    Last fallback.
  */
  const genericDate =
    new Date(raw);

  if (
    !isNaN(
      genericDate.getTime()
    )
  ) {
    return new Date(
      genericDate.getFullYear(),
      genericDate.getMonth(),
      genericDate.getDate()
    );
  }

  return null;
}

/* =========================================================
   DATE HELPERS
========================================================= */

function monthKey(
  date: Date
): string {

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
  ].join("-");
}

function dateKey(
  date: Date
): string {

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0"),
  ].join("-");
}

export function monthDays(
  month: string
): number {

  const [
    year,
    monthNumber,
  ] =
    month
      .split("-")
      .map(Number);

  return new Date(
    year,
    monthNumber,
    0
  ).getDate();
}

function formatMonth(
  month: string
): string {

  const [
    year,
    monthNumber,
  ] =
    month
      .split("-")
      .map(Number);

  return new Date(
    year,
    monthNumber - 1,
    1
  ).toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  );
}

function formatCount(
  value: number
): string {

  return Math.round(
    numberValue(value)
  ).toLocaleString(
    "en-PH"
  );
}

function formatPeso(
  value: number
): string {

  return `₱${numberValue(
    value
  ).toLocaleString(
    "en-PH",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  )}`;
}

/* =========================================================
   PERCENTAGE
========================================================= */

function calculatePercentage(
  actual: number,
  target: number
): number {

  if (
    !Number.isFinite(target) ||
    target <= 0
  ) {
    return 0;
  }

  if (
    !Number.isFinite(actual)
  ) {
    return 0;
  }

  return (
    actual /
    target
  ) *
  100;
}

/* =========================================================
   GOOGLE SHEETS GVIZ
========================================================= */

async function fetchGoogleSheet(
  sheetName: string,
  query: string
): Promise<RawRow[]> {

  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=${encodeURIComponent(
      sheetName
    )}` +
    `&tq=${encodeURIComponent(
      query
    )}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response =
    await fetch(
      url,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept:
            "text/plain",
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `Unable to read ${sheetName}: HTTP ${response.status}`
    );
  }

  const text =
    await response.text();

  const match =
    text.match(
      /google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/
    );

  if (!match) {
    throw new Error(
      `Could not parse ${sheetName} from Google Sheets.`
    );
  }

  const json =
    JSON.parse(match[1]);

  if (
    json.status ===
    "error"
  ) {

    throw new Error(
      json.errors?.[0]
        ?.detailed_message ||
      json.errors?.[0]
        ?.message ||
      `Google Sheets error: ${sheetName}`
    );
  }

  const table =
    json.table;

  const headers =
    table.cols.map(
      (
        column: any,
        index: number
      ) =>
        column.label ||
        column.id ||
        `Column${index + 1}`
    );

  return table.rows.map(
    (row: any) => {

      const record: RawRow =
        {};

      headers.forEach(
        (
          header: string,
          index: number
        ) => {

          record[header] =
            row.c?.[index]?.v ??
            "";
        }
      );

      return record;
    }
  );
}

/* =========================================================
   LIVE JO ACTIVATED
========================================================= */

async function fetchJOActivated(): Promise<RawRow[]> {

  /*
    Actual sheet columns:

    A  = JO NUMBER
    G  = STATEORPROVINCE
    S  = SLI TYPE
    U  = VENDOR TYPE
    AC = PACKAGE
    AE = MRC
    AF = CLOSING DATE
  */

  return fetchGoogleSheet(
    "JO ACTIVATED",
    `
      select A,G,S,U,AC,AE,AF
      where A is not null
    `
  );
}

/* =========================================================
   LIVE SUMMARY
========================================================= */

async function fetchSummary(): Promise<RawRow[]> {

  /*
    We retrieve:
      B = PROVINCE
      C = SLI
      D = FIBERX
      E = SME
      F = BIDA

    This allows target values to be read directly
    from SUMMARY.
  */

  return fetchGoogleSheet(
    "SUMMARY",
    `
      select B,C,D,E,F
    `
  );
}

/* =========================================================
   PARSE JO RECORDS
========================================================= */

function getRowValue(row: RawRow, ...keys: string[]): any {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return row[key];
    }
  }
  return "";
}

function parseJORows(
  rawRows: RawRow[]
): ParsedJO[] {

  const parsed: ParsedJO[] =
    [];

  for (
    const row of rawRows
  ) {

    const joNumber =
      String(
        getRowValue(row, "JO NUMBER", "A")
      ).trim();

    if (!joNumber || joNumber === "JO NUMBER") {
      continue;
    }

    const closingDate =
      parseDate(
        getRowValue(row, "CLOSING DATE", "AF")
      );

    if (!closingDate) {
      continue;
    }

    const packageName =
      normalizePackage(
        getRowValue(row, "PACKAGE", "AC")
      );

    /*
      Only the three dashboard
      packages are included.
    */
    if (
      packageName !==
        "FIBERX" &&
      packageName !==
        "SME" &&
      packageName !==
        "BIDA"
    ) {
      continue;
    }

    parsed.push({
      joNumber,
      province:
        normalizeProvince(
          getRowValue(row, "STATEORPROVINCE", "G")
        ),

      sliType:
        normalizeSLI(row),

      package:
        packageName,

      mrc:
        numberValue(
          getRowValue(row, "MRC", "AE")
        ),

      closingDate,
    });
  }

  /*
    IMPORTANT:
    De-duplicate using JO NUMBER.

    This prevents counting the same JO twice
    if duplicate records exist in the source.
  */
  const unique =
    new Map<
      string,
      ParsedJO
    >();

  for (
    const row of parsed
  ) {

    if (
      !unique.has(
        row.joNumber
      )
    ) {
      unique.set(
        row.joNumber,
        row
      );
    }
  }

  return Array.from(
    unique.values()
  );
}

/* =========================================================
   FILTER HELPERS
========================================================= */

function matchesProvince(
  row: ParsedJO,
  province: string
): boolean {

  if (
    province ===
    "All districts"
  ) {
    return true;
  }

  return (
    row.province ===
    normalizeProvince(
      province
    )
  );
}

function matchesSLI(
  row: ParsedJO,
  sliType: string
): boolean {

  if (
    sliType ===
    "All SLI Types"
  ) {
    return true;
  }

  return (
    row.sliType ===
    normalizeText(
      sliType
    )
  );
}

function matchesPackage(
  row: ParsedJO,
  packageName: string
): boolean {

  if (
    packageName ===
    "All Packages"
  ) {
    return true;
  }

  return (
    row.package ===
    normalizePackage(
      packageName
    )
  );
}

/* =========================================================
   LIVE GOOGLE SHEET HOOK
========================================================= */

function useLiveGoogleSheet() {

  const [state, setState] =
    useState<LiveState>({
      sourceName: "Live Google Sheet",
      joRows: [],
      summaryRows: [],
      lastSynced: null,
      syncing: false,
      error: "",
    });

  const mountedRef =
    useRef(true);

  const syncNow =
    useCallback(
      async (
        silent = false
      ) => {

        if (
          !mountedRef.current
        ) {
          return;
        }

        setState(
          previous => ({
            ...previous,
            syncing: true,
            error:
              silent
                ? previous.error
                : "",
          })
        );

        try {

          /*
            Read both sheets at the same time.
          */

          const [
            joRows,
            summaryRows,
          ] =
            await Promise.all([
              fetchJOActivated(),
              fetchSummary(),
            ]);

          if (
            !mountedRef.current
          ) {
            return;
          }

          setState({
            sourceName: "Live Google Sheet",
            joRows,
            summaryRows,
            lastSynced:
              new Date(),
            syncing: false,
            error: "",
          });

        } catch (
          error: any
        ) {

          if (
            !mountedRef.current
          ) {
            return;
          }

          /*
            Keep previous good data.
          */

          setState(
            previous => ({
              ...previous,

              syncing: false,

              error:
                error?.message ||
                "Unable to refresh Google Sheet.",
            })
          );
        }
      },
      []
    );

  const setManualExcel = useCallback((excelJo: RawRow[], excelSummary: RawRow[], fileName: string) => {
    setState({
      sourceName: fileName,
      joRows: excelJo,
      summaryRows: excelSummary,
      lastSynced: new Date(),
      syncing: false,
      error: "",
    });
  }, []);

  useEffect(
    () => {

      mountedRef.current =
        true;

      /*
        Initial load.
      */

      syncNow();

      /*
        Auto-refresh.
      */

      const interval =
        window.setInterval(
          () => {

            if (
              document.visibilityState ===
              "visible"
            ) {
              syncNow(true);
            }

          },
          LIVE_REFRESH_MS
        );

      /*
        Refresh immediately
        when returning to tab.
      */

      const handleVisibility =
        () => {

          if (
            document.visibilityState ===
            "visible"
          ) {
            syncNow(true);
          }
        };

      document.addEventListener(
        "visibilitychange",
        handleVisibility
      );

      return () => {

        mountedRef.current =
          false;

        window.clearInterval(
          interval
        );

        document.removeEventListener(
          "visibilitychange",
          handleVisibility
        );
      };

    },
    [syncNow]
  );

  return {
    ...state,

    refresh:
      () => syncNow(false),

    setManualExcel,
  };
}

/* =========================================================
   TARGETS FROM SUMMARY
========================================================= */

function getTargets(
  summaryRows: RawRow[],
  province: string
): Targets {

  const targetProvince =
    province ===
    "All districts"
      ? "OVERALL"
      : normalizeProvince(
          province
        );

  /*
    Walk through SUMMARY rows tracking the active province section.
    This handles merged / grouped Google Sheets structures where
    the province label appears once at the section header and subsequent
    rows (such as "Target") have Column B empty or labeled differently.
  */
  let currentProvince = "";

  for (let i = 0; i < summaryRows.length; i++) {
    const row = summaryRows[i];

    const provLabel = normalizeProvince(
      getRowValue(row, "PROVINCE", "B")
    );

    if (provLabel) {
      currentProvince = provLabel;
    }

    const sliLabel = normalizeText(
      getRowValue(row, "SLI", "C")
    );

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

  /*
    Fallback to workbook target-row index position if header
    labels were shifted or parsed differently.
  */
  const rowNumber = TARGET_ROWS[province];
  if (rowNumber && summaryRows.length > 0) {
    let candidate = summaryRows[rowNumber - 1];

    if (candidate) {
      const cLabel = normalizeText(getRowValue(candidate, "SLI", "C"));
      if (cLabel !== "TARGET") {
        for (let offset = -3; offset <= 3; offset++) {
          const check = summaryRows[rowNumber - 1 + offset];
          if (check && normalizeText(getRowValue(check, "SLI", "C")) === "TARGET") {
            candidate = check;
            break;
          }
        }
      }

      if (candidate) {
        return {
          fiberX: Math.abs(numberValue(getRowValue(candidate, "FIBERX", "D"))),
          sme: Math.abs(numberValue(getRowValue(candidate, "SME", "E"))),
          bida: Math.abs(numberValue(getRowValue(candidate, "BIDA", "F"))),
        };
      }
    }
  }

  return {
    fiberX: 0,
    sme: 0,
    bida: 0,
  };
}

/* =========================================================
   MAIN APP
========================================================= */

export default function App() {

  const {
    sourceName,
    joRows,
    summaryRows,
    lastSynced,
    syncing,
    error,
    refresh,
    setManualExcel,
  } =
    useLiveGoogleSheet();

  const [
    filters,
    setFilters,
  ] =
    useState<Filters>({
      month:
        DEFAULT_MONTH,

      province:
        "All districts",

      sliType:
        "All SLI Types",

      package:
        "All Packages",
    });

  const fileRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    excelLoading,
    setExcelLoading,
  ] =
    useState(false);

  /*
    Parse live Google Sheet records.
  */

  const rows =
    useMemo(
      () =>
        parseJORows(
          joRows
        ),
      [joRows]
    );

  /*
    Month options available from data, defaulting with DEFAULT_MONTH.
  */
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(DEFAULT_MONTH);
    for (const r of rows) {
      set.add(monthKey(r.closingDate));
    }
    return Array.from(set).sort().reverse();
  }, [rows]);

  /*
    Selected month.
  */

  const monthRows =
    useMemo(
      () =>
        rows.filter(
          row =>
            monthKey(
              row.closingDate
            ) ===
            filters.month
        ),
      [
        rows,
        filters.month,
      ]
    );

  /*
    Main dashboard scope:
      Month
      Province
      SLI
      Package
  */

  const filteredRows =
    useMemo(
      () =>
        monthRows.filter(
          row =>
            matchesProvince(
              row,
              filters.province
            ) &&
            matchesSLI(
              row,
              filters.sliType
            ) &&
            matchesPackage(
              row,
              filters.package
            )
        ),
      [
        monthRows,
        filters.province,
        filters.sliType,
        filters.package,
      ]
    );

  /*
    Package scope:

    Month + Province + SLI

    Package selector intentionally does
    NOT hide the other package cards.
  */

  const packageRows =
    useMemo(
      () =>
        monthRows.filter(
          row =>
            matchesProvince(
              row,
              filters.province
            ) &&
            matchesSLI(
              row,
              filters.sliType
            )
        ),
      [
        monthRows,
        filters.province,
        filters.sliType,
      ]
    );

  /*
    Targets.
  */

  const targets =
    useMemo(
      () =>
        getTargets(
          summaryRows,
          filters.province
        ),
      [
        summaryRows,
        filters.province,
      ]
    );

  /*
    Main dashboard metrics.
  */

  const metrics =
    useMemo(() => {

      let activatedJO = 0;

      let totalMRC = 0;

      let fiberX = 0;
      let fiberXMRC = 0;

      let sme = 0;
      let smeMRC = 0;

      let bida = 0;
      let bidaMRC = 0;

      for (
        const row of filteredRows
      ) {

        activatedJO++;

        totalMRC +=
          row.mrc;

        if (
          row.package ===
          "FIBERX"
        ) {
          fiberX++;
          fiberXMRC +=
            row.mrc;
        }

        if (
          row.package ===
          "SME"
        ) {
          sme++;
          smeMRC +=
            row.mrc;
        }

        if (
          row.package ===
          "BIDA"
        ) {
          bida++;
          bidaMRC +=
            row.mrc;
        }
      }

      return {
        activatedJO,
        totalMRC,

        fiberX,
        fiberXMRC,

        sme,
        smeMRC,

        bida,
        bidaMRC,
      };

    }, [filteredRows]);

  /*
    Package metrics.

    These remain visible regardless
    of Package dropdown selection.
  */

  const packageMetrics =
    useMemo(() => {

      let fiberX = 0;
      let fiberXMRC = 0;

      let sme = 0;
      let smeMRC = 0;

      let bida = 0;
      let bidaMRC = 0;

      for (
        const row of packageRows
      ) {

        if (
          row.package ===
          "FIBERX"
        ) {
          fiberX++;
          fiberXMRC +=
            row.mrc;
        }

        if (
          row.package ===
          "SME"
        ) {
          sme++;
          smeMRC +=
            row.mrc;
        }

        if (
          row.package ===
          "BIDA"
        ) {
          bida++;
          bidaMRC +=
            row.mrc;
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
    SLI metrics respect Package filter.
  */

  const sliMetrics =
    useMemo(() => {

      let inhouse = 0;
      let msa = 0;

      for (
        const row of filteredRows
      ) {

        if (
          row.sliType ===
          "INHOUSE"
        ) {
          inhouse++;
        }

        if (
          row.sliType ===
          "MSA"
        ) {
          msa++;
        }
      }

      return {
        inhouse,
        msa,
      };

    }, [filteredRows]);

  /*
    ACHIEVEMENT %

    FiberX = JO count / FiberX target
    SME = MRC / SME target
    BIDA = JO count / BIDA target
  */

  const fiberXAchievement =
    calculatePercentage(
      packageMetrics.fiberX,
      targets.fiberX
    );

  const smeAchievement =
    calculatePercentage(
      packageMetrics.smeMRC,
      targets.sme
    );

  const bidaAchievement =
    calculatePercentage(
      packageMetrics.bida,
      targets.bida
    );

  /*
    FIBERX RUNNING VS TARGET
  */

  const fiberChart =
    useMemo(() => {

      const [
        year,
        monthNumber,
      ] =
        filters.month
          .split("-")
          .map(Number);

      const totalDays =
        new Date(
          year,
          monthNumber,
          0
        ).getDate();

      /*
        FiberX records only.
      */

      const fiberRows =
        monthRows.filter(
          row =>
            row.package ===
              "FIBERX" &&
            matchesProvince(
              row,
              filters.province
            ) &&
            matchesSLI(
              row,
              filters.sliType
            )
        );

      const counts =
        new Map<
          string,
          number
        >();

      for (
        const row of fiberRows
      ) {

        const key =
          dateKey(
            row.closingDate
          );

        counts.set(
          key,
          (counts.get(key) ||
            0) + 1
        );
      }

      const result: any[] =
        [];

      let running = 0;

      for (
        let day = 1;
        day <= totalDays;
        day++
      ) {

        const date =
          new Date(
            year,
            monthNumber - 1,
            day
          );

        const key =
          dateKey(date);

        running +=
          counts.get(key) ||
          0;

        const runningTarget =
          targets.fiberX *
          (day / totalDays);

        result.push({
          date:
            date.toLocaleDateString(
              "en-US",
              {
                month: "short",
                day: "numeric",
              }
            ),

          fiberXRunning:
            running,

          target:
            Number(
              runningTarget.toFixed(
                2
              )
            ),
        });
      }

      return result;

    }, [
      monthRows,
      filters.province,
      filters.sliType,
      filters.month,
      targets.fiberX,
    ]);

  /* =======================================================
     EXCEL BACKUP
  ======================================================= */

  async function loadExcel(
    file: File
  ) {

    setExcelLoading(true);

    try {

      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array",
            cellDates: true,
          }
        );

      const joSheet =
        workbook.Sheets[
          "JO ACTIVATED"
        ];

      if (!joSheet) {
        throw new Error(
          "JO ACTIVATED sheet was not found."
        );
      }

      const rawRows =
        XLSX.utils.sheet_to_json<
          RawRow
        >(
          joSheet,
          {
            defval: "",
          }
        );

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

    } catch (
      error: any
    ) {

      console.error(
        "Excel load failed:",
        error
      );

      alert(error?.message || "Excel load failed.");

    } finally {

      setExcelLoading(false);
    }
  }

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#f7faf9] text-[#123b31]">

      <div className="max-w-[1500px] mx-auto px-6 py-6">

        {/* ================================================
            HEADER
        ================================================= */}

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
                value={
                  filters.month
                }
                onChange={
                  event =>
                    setFilters(
                      previous => ({
                        ...previous,
                        month:
                          event
                            .target
                            .value,
                      })
                    )
                }
              >

                {monthOptions.map(
                  month => (
                    <option
                      key={month}
                      value={month}
                    >
                      {formatMonth(
                        month
                      )}
                    </option>
                  )
                )}

              </select>

              <button
                onClick={() =>
                  refresh()
                }
                disabled={
                  syncing
                }
                className="px-4 py-2 rounded-xl bg-[#dff7ec] border border-[#b5e6d0] text-[#0b684e] font-semibold disabled:opacity-50 cursor-pointer hover:bg-[#cbf1e0] transition-colors"
              >
                {syncing
                  ? "Updating..."
                  : "Refresh now"}
              </button>

              <button
                onClick={() =>
                  fileRef.current?.click()
                }
                disabled={
                  excelLoading
                }
                className="px-4 py-2 rounded-xl bg-white border border-[#cfe4da] text-[#0b684e] font-semibold disabled:opacity-50 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                {excelLoading
                  ? "Loading..."
                  : "Load Excel"}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={
                  event => {

                    const file =
                      event
                        .target
                        .files?.[0];

                    if (file) {
                      loadExcel(
                        file
                      );
                    }
                  }
                }
              />

            </div>

          </div>

          {/* LIVE STATUS */}

          <div className="mt-5 rounded-xl border border-[#c9ebdd] bg-[#e8f8f0] px-4 py-3 flex items-center justify-between gap-4 flex-wrap">

            <div className="flex items-center gap-2 text-sm">

              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  syncing
                    ? "bg-yellow-500 animate-pulse"
                    : error
                    ? "bg-red-500"
                    : "bg-green-500"
                }`}
              />

              <span className="font-semibold">

                {syncing
                  ? "Updating live data..."
                  : error
                  ? "Live update issue"
                  : sourceName}

              </span>

              {lastSynced && (

                <span className="text-gray-500">

                  • Last updated{" "}

                  {lastSynced.toLocaleTimeString(
                    "en-PH",
                    {
                      hour:
                        "2-digit",
                      minute:
                        "2-digit",
                      second:
                        "2-digit",
                    }
                  )}

                </span>

              )}

            </div>

            <div className="text-sm font-semibold">

              {formatCount(
                monthRows.length
              )}{" "}
              JOs in{" "}
              {formatMonth(
                filters.month
              )}

            </div>

          </div>

          {/* ERROR */}

          {error && (

            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

              Unable to refresh live
              data. Showing the last
              successful data.

            </div>

          )}

        </header>

        {/* ================================================
            FILTERS
        ================================================= */}

        <section className="bg-white rounded-2xl border border-[#dcece6] p-4 mb-5">

          <div className="flex items-center gap-3 flex-wrap">

            <label className="font-medium text-sm">
              Province:
            </label>

            <select
              className="rounded-xl border border-[#dcece6] px-4 py-2 bg-white"
              value={
                filters.province
              }
              onChange={
                event =>
                  setFilters(
                    previous => ({
                      ...previous,
                      province:
                        event
                          .target
                          .value,
                    })
                  )
              }
            >

              {PROVINCES.map(
                province => (
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
              value={
                filters.sliType
              }
              onChange={
                event =>
                  setFilters(
                    previous => ({
                      ...previous,
                      sliType:
                        event
                          .target
                          .value,
                    })
                  )
              }
            >

              {SLI_TYPES.map(
                sli => (
                  <option
                    key={sli}
                  >
                    {sli}
                  </option>
                )
              )}

            </select>

            <label className="font-medium text-sm ml-2">
              Package:
            </label>

            <select
              className="rounded-xl border border-[#dcece6] px-4 py-2 bg-white"
              value={
                filters.package
              }
              onChange={
                event =>
                  setFilters(
                    previous => ({
                      ...previous,
                      package:
                        event
                          .target
                          .value,
                    })
                  )
              }
            >

              {PACKAGES.map(
                packageName => (
                  <option
                    key={packageName}
                  >
                    {packageName}
                  </option>
                )
              )}

            </select>

            <button
              className="ml-auto bg-gray-100 px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-200 transition-colors cursor-pointer"
              onClick={() =>
                setFilters({
                  month:
                    DEFAULT_MONTH,

                  province:
                    "All districts",

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

        {/* ================================================
            MAIN KPI
        ================================================= */}

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">

          <div className="bg-[#15553f] text-white rounded-3xl p-7">

            <div className="text-sm font-semibold uppercase opacity-80">
              Activated JO Count
            </div>

            <div className="text-6xl font-bold mt-5">

              {formatCount(
                metrics.activatedJO
              )}

            </div>

            <div className="text-sm opacity-80 mt-3">

              Total activated job orders
              for{" "}
              {formatMonth(
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
                metrics.totalMRC
              )}

            </div>

            <div className="text-sm text-gray-500 mt-3">

              Consolidated recurring revenue
              from activated subscriptions
              in scope.

            </div>

          </div>

        </section>

        {/* ================================================
            PACKAGE BREAKDOWN
        ================================================= */}

        <h2 className="text-xl font-bold mb-3">

          Package breakdown

          <span className="font-normal text-sm text-gray-500 ml-2">

            Respecting province and SLI
            filters

          </span>

        </h2>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-7">

          {/* FIBERX */}

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
              fiberXAchievement
            }
            footerLabel="Total MRC:"
            footerValue={
              formatPeso(
                packageMetrics.fiberXMRC
              )
            }
          />

          {/* SME */}

          <PackageCard
            title="SME"
            label="Enterprise"
            running={
              packageMetrics.smeMRC
            }
            target={
              targets.sme
            }
            percentage={
              smeAchievement
            }
            money
            runningLabel="Running MRC"
            footerLabel="Activated JOs:"
            footerValue={
              formatCount(
                packageMetrics.sme
              )
            }
          />

          {/* BIDA */}

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
            footerValue={
              formatPeso(
                packageMetrics.bidaMRC
              )
            }
          />

        </section>

        {/* ================================================
            TARGET SUMMARY
        ================================================= */}

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-7">

          <TargetCard
            title="FiberX Target"
            value={
              formatCount(
                targets.fiberX
              )
            }
          />

          <TargetCard
            title="SME Target"
            value={
              formatPeso(
                targets.sme
              )
            }
          />

          <TargetCard
            title="BIDA Target"
            value={
              formatCount(
                targets.bida
              )
            }
          />

        </section>

        {/* ================================================
            SLI
        ================================================= */}

        <h2 className="text-xl font-bold mb-3">

          SLI channel breakdown

          <span className="font-normal text-sm text-gray-500 ml-2">

            Respecting active package filter

          </span>

        </h2>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-7">

          <ChannelCard
            title="INHOUSE"
            value={
              sliMetrics.inhouse
            }
          />

          <ChannelCard
            title="MSA"
            value={
              sliMetrics.msa
            }
          />

        </section>

        {/* ================================================
            FIBERX CHART
        ================================================= */}

        <section className="bg-white border border-[#dcece6] rounded-2xl p-6 shadow-sm">

          <div className="flex justify-between items-start gap-5 mb-5">

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

              <div className="text-xl font-bold text-[#0a684d]">

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
                data={
                  fiberChart
                }
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
                    value:
                      "Activated JOs",
                    angle:
                      -90,
                    position:
                      "insideLeft",
                  }}
                />

                <Tooltip
                  formatter={
                    (
                      value: any,
                      name: string
                    ) => [

                      Number(
                        value
                      ).toLocaleString(
                        "en-PH"
                      ),

                      name ===
                        "fiberXRunning"
                        ? "FiberX Running"
                        : "Target",

                    ]
                  }
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

/* =========================================================
   PACKAGE CARD
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
          ? formatPeso(
              running
            )
          : formatCount(
              running
            )}

      </div>

      <div className="flex justify-between mt-5 text-sm">

        <span>
          Target:
        </span>

        <strong>

          {money
            ? formatPeso(
                target
              )
            : formatCount(
                target
              )}

        </strong>

      </div>

      <ProgressBar
        value={
          percentage
        }
      />

      <div className="flex justify-between mt-2 text-sm">

        <span>
          Achievement:
        </span>

        <strong>
          {percentage.toFixed(
            1
          )}%
        </strong>

      </div>

      <div className="flex justify-between mt-5 pt-4 border-t border-[#f0f5f2] text-sm">

        <span>
          {footerLabel}
        </span>

        <strong>
          {footerValue}
        </strong>

      </div>

    </div>
  );
}

/* =========================================================
   PROGRESS BAR
========================================================= */

function ProgressBar({
  value,
}: {
  value: number;
}) {

  /*
    Visual bar is capped at 100%.

    The actual displayed percentage
    can still exceed 100%.
  */

  const width =
    Math.max(
      0,
      Math.min(
        100,
        value
      )
    );

  return (

    <div className="mt-3 h-2 bg-[#edf2f0] rounded-full overflow-hidden">

      <div
        className="h-full bg-[#0aa37a] rounded-full transition-all duration-300"
        style={{
          width:
            `${width}%`,
        }}
      />

    </div>
  );
}

/* =========================================================
   TARGET CARD
========================================================= */

function TargetCard({
  title,
  value,
}: {
  title: string;
  value: string;
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

/* =========================================================
   SLI CARD
========================================================= */

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

        {formatCount(
          value
        )}

      </div>

    </div>
  );
}
