import {
  fetchSliActivationPivot,
  parseSliActivationPivotTable,
  getSliPivotTabName,
} from './sliPivotService';

export interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const GOOGLE_SHEET_ID = '17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg';
const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`;

const DEFAULT_DAILY_REPORT = {
  reportLabel: '19 Sep 2026',
  fiberYesterday: '23',
  fiberToday: '3',
  fsoi: '16',
  forCloseout: '1',
  forActivation: '2',
  fiberMTD: '456 (53%)',
  smeVatIncMTD: '79,135 (58%)',
  smeVatExMTD: '69,639 (51%)',
  bidaMTD: '3 (2%)',
  s2sMTD: '0 (0%)',
  fiberRunrate: '700 / 859 (81%)',
  smeVatIncRunrate: '121,436 / 136,508 (89%)',
  smeVatExRunrate: '69,639 / 136,508 (51%)',
  bidaRunrate: '5 / 113 (4%)',
  s2sRunrate: '0 / 782 (0%)',
};

const DEFAULT_TARGETS_MAP: Record<
  string,
  { fiberX: number; sme: number; bida: number; s2s: number }
> = {
  Albay: { fiberX: 467, sme: 71993, bida: 82, s2s: 572 },
  Sorsogon: { fiberX: 189, sme: 59354, bida: 21, s2s: 169 },
  Masbate: { fiberX: 203, sme: 5161, bida: 10, s2s: 41 },
  'All districts': { fiberX: 859, sme: 136508, bida: 113, s2s: 782 },
  ALBAY: { fiberX: 467, sme: 71993, bida: 82, s2s: 572 },
  SORSOGON: { fiberX: 189, sme: 59354, bida: 21, s2s: 169 },
  MASBATE: { fiberX: 203, sme: 5161, bida: 10, s2s: 41 },
  ALMASOR: { fiberX: 859, sme: 136508, bida: 113, s2s: 782 },
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

async function fetchGoogleSheetGViz(
  sheetName: string,
  query?: string,
  range?: string
): Promise<any[]> {
  let url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=${encodeURIComponent(sheetName)}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  if (query) url += `&tq=${encodeURIComponent(query)}`;
  if (range) url += `&range=${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/plain' },
    cf: { cacheTtl: 0, cacheEverything: false },
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
  if (json.status === 'error') {
    throw new Error(
      json.errors?.[0]?.detailed_message ||
        json.errors?.[0]?.message ||
        `Google Sheets error: ${sheetName}`
    );
  }

  const table = json.table;
  const headers = table.cols.map(
    (col: any, idx: number) => col.label || col.id || `Column${idx + 1}`
  );

  return table.rows.map((row: any) => {
    const record: Record<string, any> = {};
    headers.forEach((header: string, index: number) => {
      record[header] = row.c?.[index]?.v ?? '';
    });
    if (sheetName === 'JO ACTIVATED' && row.c) {
      const getVal = (idx: number) => row.c?.[idx]?.v ?? '';
      record['A'] = record['A'] || getVal(0);
      record['JO NUMBER'] = record['JO NUMBER'] || getVal(0);
      record['G'] = record['G'] || getVal(1);
      record['STATEORPROVINCE'] = record['STATEORPROVINCE'] || getVal(1);
      record['PROVINCE'] = record['PROVINCE'] || getVal(1);
      record['Q'] = record['Q'] || getVal(2);
      record['SLI'] = record['SLI'] || getVal(2);
      record['S'] = record['S'] || getVal(3);
      record['SLI TYPE'] = record['SLI TYPE'] || getVal(3);
      record['T'] = record['T'] || getVal(4);
      record['VENDOR'] = record['VENDOR'] || getVal(4);
      record['U'] = record['U'] || getVal(5);
      record['VENDOR TYPE'] = record['VENDOR TYPE'] || getVal(5);
      record['Y'] = record['Y'] || getVal(6);
      record['SLA'] = record['SLA'] || getVal(6);
      record['AC'] = record['AC'] || getVal(7);
      record['PACKAGE'] = record['PACKAGE'] || getVal(7);
      record['AE'] = record['AE'] || getVal(8);
      record['MRC'] = record['MRC'] || getVal(8);
      record['AF'] = record['AF'] || getVal(9);
      record['CLOSING DATE'] = record['CLOSING DATE'] || getVal(9);
      record['AU'] = record['AU'] || getVal(10);
      record['VAT EX MRC'] = record['VAT EX MRC'] || getVal(10);
    }
    return record;
  });
}

async function fetchSummaryTargetRow(
  rowNumber: number
): Promise<{ fiberX: number; sme: number; bida: number; s2s: number }> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=SUMMARY` +
    `&range=D${rowNumber}:G${rowNumber}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    headers: { Accept: 'text/plain' },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error(`Could not parse target row ${rowNumber}`);

  const json = JSON.parse(match[1]);
  const firstRow = json.table?.rows?.[0]?.c || [];
  return {
    fiberX: Math.abs(Number(firstRow[0]?.v) || 0),
    sme: Math.abs(Number(firstRow[1]?.v) || 0),
    bida: Math.abs(Number(firstRow[2]?.v) || 0),
    s2s: Math.abs(Number(firstRow[3]?.v) || 0),
  };
}

async function fetchDailyReportAlmasor(): Promise<typeof DEFAULT_DAILY_REPORT> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=${encodeURIComponent('DAILY REPORT ALMASOR')}` +
    `&range=${encodeURIComponent('AJ1:AK45')}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    cf: { cacheTtl: 0, cacheEverything: false },
  });

  if (!response.ok) {
    throw new Error(`DAILY REPORT ALMASOR fetch failed: HTTP ${response.status}`);
  }

  const text = await response.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) {
    throw new Error('Could not parse DAILY REPORT ALMASOR table response');
  }

  const json = JSON.parse(match[1]);
  if (json.status === 'error') {
    throw new Error(
      json.errors?.[0]?.detailed_message ||
        json.errors?.[0]?.message ||
        'Google Sheet error in DAILY REPORT ALMASOR'
    );
  }

  const rows = json.table?.rows || [];
  let section = '';
  const result = { ...DEFAULT_DAILY_REPORT };

  for (const r of rows) {
    if (!r || !r.c) continue;
    const aj = (r.c[0]?.f ?? r.c[0]?.v ?? '').toString().trim();
    const ak = (r.c[1]?.f ?? r.c[1]?.v ?? '').toString().trim();
    if (!aj) continue;

    const ajLower = aj.toLowerCase();

    if (ajLower.includes('daily sli report as of') || ajLower.startsWith('*daily sli report')) {
      result.reportLabel = aj;
    } else if (ajLower.includes('runrate vs target')) {
      section = 'runrate';
    } else if (ajLower.includes('mtd activations vs target')) {
      section = 'mtd';
    } else if (ajLower.includes('open jos for closing')) {
      section = 'closing';
    } else if (ajLower.includes('daily activations and fsoi')) {
      section = 'daily';
    } else if (section === 'daily') {
      if (ajLower.includes('yesterday')) result.fiberYesterday = ak;
      else if (ajLower.includes('today')) result.fiberToday = ak;
      else if (ajLower.includes('fsoi')) result.fsoi = ak;
    } else if (section === 'closing') {
      if (ajLower.includes('closeout')) result.forCloseout = ak;
      else if (ajLower.includes('activation')) result.forActivation = ak;
    } else if (section === 'mtd') {
      if (ajLower.startsWith('fiberx')) result.fiberMTD = ak;
      else if (ajLower.includes('vat inc')) result.smeVatIncMTD = ak;
      else if (ajLower.includes('vat ex')) result.smeVatExMTD = ak;
      else if (ajLower.startsWith('bida')) result.bidaMTD = ak;
      else if (ajLower.startsWith('s2s')) result.s2sMTD = ak;
    } else if (section === 'runrate') {
      if (ajLower.startsWith('fiberx')) result.fiberRunrate = ak;
      else if (ajLower.includes('vat inc')) result.smeVatIncRunrate = ak;
      else if (ajLower.includes('vat ex')) result.smeVatExRunrate = ak;
      else if (ajLower.startsWith('bida')) result.bidaRunrate = ak;
      else if (ajLower.startsWith('s2s')) result.s2sRunrate = ak;
    }
  }

  return result;
}

function getCurrentManilaMonthKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);
}

async function buildLiveDataPayload(requestedMonth?: string) {
  const currentMonthKey = getCurrentManilaMonthKey();
  const targetMonth = requestedMonth || currentMonthKey;
  const expectedTabName = getSliPivotTabName(targetMonth);

  const [joRows, summaryRows, albay, sorsogon, masbate, overall, dailyReport, sliPivot] =
    await Promise.all([
      fetchGoogleSheetGViz('JO ACTIVATED', 'select A,G,Q,S,T,U,Y,AC,AE,AF,AU where A is not null'),
      fetchGoogleSheetGViz('SUMMARY', 'select B,C,D,E,F,G').catch(() => []),
      fetchSummaryTargetRow(11).catch(() => DEFAULT_TARGETS_MAP.Albay),
      fetchSummaryTargetRow(17).catch(() => DEFAULT_TARGETS_MAP.Sorsogon),
      fetchSummaryTargetRow(23).catch(() => DEFAULT_TARGETS_MAP.Masbate),
      fetchSummaryTargetRow(29).catch(() => DEFAULT_TARGETS_MAP['All districts']),
      fetchDailyReportAlmasor().catch(() => DEFAULT_DAILY_REPORT),
      fetchSliActivationPivot(expectedTabName)
        .then((res) => ({
          found: res.found,
          sheetSource: res.sheetSource,
          rows: res.found ? parseSliActivationPivotTable(res.table) : [],
        }))
        .catch(() => ({
          found: false,
          sheetSource: expectedTabName,
          rows: [],
        })),
    ]);

  const targetsMap = {
    Albay: albay,
    Sorsogon: sorsogon,
    Masbate: masbate,
    'All districts': overall,
    ALBAY: albay,
    SORSOGON: sorsogon,
    MASBATE: masbate,
    ALMASOR: overall,
  };

  const operationalStatus = {
    asOfText: dailyReport.reportLabel || '19 Sep 2026',
    fsoi: Number(dailyReport.fsoi) || 16,
    forCloseout: Number(dailyReport.forCloseout) || 1,
    forActivation: Number(dailyReport.forActivation) || 2,
  };

  return {
    success: true,
    sourceName: 'Live Google Sheet',
    joRows,
    summaryRows,
    targetsMap,
    dailyReport,
    operationalStatus,
    sliPivotRows: sliPivot.rows,
    sliPivotSource: sliPivot.sheetSource,
    sliPivotAvailable: sliPivot.found,
    lastSynced: new Date().toISOString(),
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    if (pathname === '/api/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    if (
      (pathname === '/api/live-data' && request.method === 'GET') ||
      (pathname === '/api/live-data/refresh' && request.method === 'POST')
    ) {
      try {
        const month = searchParams.get('month') || '';
        const payload = await buildLiveDataPayload(month);
        return jsonResponse(payload, 200);
      } catch (err: any) {
        return jsonResponse(
          { success: false, error: err?.message || 'Failed to sync live Google Sheet' },
          500
        );
      }
    }

    if (pathname === '/api/records') {
      return jsonResponse({
        success: true,
        hasCustomData: false,
        records: null,
        syncSourceInfo: null,
        summaryTargets: null,
        updatedAt: null,
      });
    }

    if (pathname === '/api/records/reset' && request.method === 'POST') {
      return jsonResponse({ success: true, message: 'Reset to default seed data' });
    }

    // Serve Vite SPA static assets for all non-API routes
    return env.ASSETS.fetch(request);
  },
};
