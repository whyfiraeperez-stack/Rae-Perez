import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import {
  fetchSliActivationPivot,
  parseSliActivationPivotTable,
  getSliPivotTabName,
} from './src/services/sliPivotService';

const PORT = 3000;
const DATA_FILE = path.join(process.cwd(), 'data', 'saved_records.json');
const CACHE_FILE = path.join(process.cwd(), 'data', 'live_sheets_cache.json');

const GOOGLE_SHEET_ID = '17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg';
const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`;

// Ensure data directory exists
try {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create data directory:', e);
}

// In-memory cache
let savedData: {
  records: any[];
  syncSourceInfo: any;
  summaryTargets?: any;
  updatedAt: string;
} | null = null;

// Live Google Sheets cache
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

let liveCache: {
  joRows: any[];
  summaryRows: any[];
  targetsMap: Record<string, { fiberX: number; sme: number; bida: number; s2s?: number }>;
  dailyReport?: typeof DEFAULT_DAILY_REPORT;
  operationalStatus?: {
    asOfText: string;
    fsoi: number;
    forCloseout: number;
    forActivation: number;
  };
  sliPivotRows?: any[];
  sliPivotSource?: string;
  sliPivotAvailable?: boolean;
  lastSynced: string;
  sourceName: string;
} | null = null;

const DEFAULT_TARGETS_MAP: Record<string, { fiberX: number; sme: number; bida: number; s2s: number }> = {
  Albay: { fiberX: 467, sme: 71993, bida: 82, s2s: 572 },
  Sorsogon: { fiberX: 189, sme: 59354, bida: 21, s2s: 169 },
  Masbate: { fiberX: 203, sme: 5161, bida: 10, s2s: 41 },
  'All districts': { fiberX: 859, sme: 136508, bida: 113, s2s: 782 },
  ALBAY: { fiberX: 467, sme: 71993, bida: 82, s2s: 572 },
  SORSOGON: { fiberX: 189, sme: 59354, bida: 21, s2s: 169 },
  MASBATE: { fiberX: 203, sme: 5161, bida: 10, s2s: 41 },
  ALMASOR: { fiberX: 859, sme: 136508, bida: 113, s2s: 782 },
};

// Attempt to load live cache from disk on boot
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.joRows) && parsed.joRows.length > 0) {
      liveCache = {
        joRows: parsed.joRows,
        summaryRows: parsed.summaryRows || [],
        targetsMap: parsed.targetsMap || DEFAULT_TARGETS_MAP,
        operationalStatus: parsed.operationalStatus || {
          asOfText: '18 Sep 2026 10:28 am',
          fsoi: 14,
          forCloseout: 2,
          forActivation: 1,
        },
        sliPivotRows: parsed.sliPivotRows || [],
        sliPivotSource: parsed.sliPivotSource || 'SLI ACTIVATION - SEPTEMBER 2026',
        sliPivotAvailable: parsed.sliPivotAvailable ?? true,
        lastSynced: parsed.updatedAt || new Date().toISOString(),
        sourceName: 'Live Google Sheet',
      };
      console.log(`Loaded ${liveCache.joRows.length} live records and ${liveCache.sliPivotRows?.length || 0} pivot records from disk cache.`);
    }
  }
} catch (e) {
  console.error('Failed to read live cache file on startup:', e);
}

// Helper: fetch Google Sheet GViz
async function fetchGoogleSheetGViz(sheetName: string, query?: string, range?: string): Promise<any[]> {
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
      record['U'] = record['U'] || getVal(4);
      record['VENDOR TYPE'] = record['VENDOR TYPE'] || getVal(4);
      record['Y'] = record['Y'] || getVal(5);
      record['SLA'] = record['SLA'] || getVal(5);
      record['AC'] = record['AC'] || getVal(6);
      record['PACKAGE'] = record['PACKAGE'] || getVal(6);
      record['AE'] = record['AE'] || getVal(7);
      record['MRC'] = record['MRC'] || getVal(7);
      record['AF'] = record['AF'] || getVal(8);
      record['CLOSING DATE'] = record['CLOSING DATE'] || getVal(8);
      record['AU'] = record['AU'] || getVal(9);
      record['VAT EX MRC'] = record['VAT EX MRC'] || getVal(9);
    }
    return record;
  });
}

// Helper: fetch target row with S2S (D:G)
async function fetchSummaryTargetRow(rowNumber: number): Promise<{ fiberX: number; sme: number; bida: number; s2s: number }> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=SUMMARY` +
    `&range=D${rowNumber}:G${rowNumber}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, { headers: { Accept: 'text/plain' } });
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

// Helper: fetch single cell from DAILY REPORT ALMASOR
async function fetchDailyReportCell(cell: string): Promise<{ value: any; formatted: string }> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=${encodeURIComponent('DAILY REPORT ALMASOR')}` +
    `&range=${encodeURIComponent(cell)}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `DAILY REPORT ALMASOR ${cell} failed: HTTP ${response.status}`
    );
  }

  const text = await response.text();

  const match = text.match(
    /google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/
  );

  if (!match) {
    throw new Error(
      `Could not parse DAILY REPORT ALMASOR ${cell}`
    );
  }

  const json = JSON.parse(match[1]);

  if (json.status === 'error') {
    throw new Error(
      json.errors?.[0]?.detailed_message ||
      json.errors?.[0]?.message ||
      `Google Sheet error at ${cell}`
    );
  }

  const cellData = json.table?.rows?.[0]?.c?.[0];

  return {
    value: cellData?.v ?? '',
    formatted: cellData?.f ?? (cellData?.v !== undefined && cellData?.v !== null ? String(cellData.v) : ''),
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
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`DAILY REPORT ALMASOR fetch failed: HTTP ${response.status}`);
  }

  const text = await response.text();
  const match = text.match(
    /google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/
  );

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

function getCurrentManilaDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getCurrentManilaMonthKey(): string {
  return getCurrentManilaDateKey().slice(0, 7);
}

let syncInProgress: Promise<any> | null = null;

async function syncLiveGoogleSheets(): Promise<any> {
  if (syncInProgress) return syncInProgress;

  syncInProgress = (async () => {
    try {
      console.log('Syncing live data from Google Sheets...');
      const currentMonthKey = getCurrentManilaMonthKey();
      const currentPivotTab = getSliPivotTabName(currentMonthKey);

      const [joRows, summaryRows, albay, sorsogon, masbate, overall, draReport, sliPivot] = await Promise.all([
        fetchGoogleSheetGViz('JO ACTIVATED', 'select A,G,Q,S,U,Y,AC,AE,AF,AU where A is not null'),
        fetchGoogleSheetGViz('SUMMARY', 'select B,C,D,E,F,G').catch(() => []),
        fetchSummaryTargetRow(11).catch(() => DEFAULT_TARGETS_MAP.Albay),
        fetchSummaryTargetRow(17).catch(() => DEFAULT_TARGETS_MAP.Sorsogon),
        fetchSummaryTargetRow(23).catch(() => DEFAULT_TARGETS_MAP.Masbate),
        fetchSummaryTargetRow(29).catch(() => DEFAULT_TARGETS_MAP['All districts']),
        fetchDailyReportAlmasor().catch((err) => {
          console.warn('DAILY REPORT ALMASOR live sync warning:', err.message);
          return liveCache?.dailyReport || DEFAULT_DAILY_REPORT;
        }),
        fetchSliActivationPivot(currentPivotTab)
          .then((res) => ({
            found: res.found,
            sheetSource: res.sheetSource,
            rows: res.found ? parseSliActivationPivotTable(res.table) : [],
          }))
          .catch((err) => {
            console.warn('SLI ACTIVATION pivot sync warning:', err.message);
            return {
              found: false,
              sheetSource: currentPivotTab,
              rows: [],
            };
          }),
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

      const dailyReport = draReport || DEFAULT_DAILY_REPORT;

      const operationalStatus = {
        asOfText: dailyReport.reportLabel || '19 Sep 2026',
        fsoi: Number(dailyReport.fsoi) || 16,
        forCloseout: Number(dailyReport.forCloseout) || 1,
        forActivation: Number(dailyReport.forActivation) || 2,
      };

      const now = new Date().toISOString();
      liveCache = {
        joRows,
        summaryRows,
        targetsMap,
        dailyReport,
        operationalStatus,
        sliPivotRows: sliPivot.rows,
        sliPivotSource: sliPivot.sheetSource,
        sliPivotAvailable: sliPivot.found,
        lastSynced: now,
        sourceName: 'Live Google Sheet',
      };

      // Persist to disk
      fs.writeFile(CACHE_FILE, JSON.stringify({
        joRows,
        summaryRows,
        targetsMap,
        dailyReport,
        operationalStatus,
        sliPivotRows: sliPivot.rows,
        sliPivotSource: sliPivot.sheetSource,
        sliPivotAvailable: sliPivot.found,
        updatedAt: now,
      }, null, 2), (err) => {
        if (err) console.error('Error writing live cache file:', err);
      });

      console.log(`Successfully synced ${joRows.length} rows from Google Sheets.`);
      return liveCache;
    } catch (err) {
      console.error('Failed to sync live Google Sheets:', err);
      if (liveCache) {
        console.log('Serving existing liveCache despite sync error.');
        return liveCache;
      }
      throw err;
    } finally {
      syncInProgress = null;
    }
  })();

  return syncInProgress;
}

// Initial sync on startup
syncLiveGoogleSheets().catch((e) => console.warn('Startup live sync warning:', e.message));

// Periodically sync every 15 seconds
setInterval(() => {
  syncLiveGoogleSheets().catch((e) => console.warn('Interval live sync warning:', e.message));
}, 15_000);

// Attempt to load from disk on boot
try {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    savedData = JSON.parse(raw);
    console.log(`Loaded ${savedData?.records?.length || 0} records from persistent storage.`);
  }
} catch (e) {
  console.error('Failed to read data file on startup:', e);
}

async function startServer() {
  const app = express();

  // Parse JSON payloads up to 50MB (supporting full raw spreadsheets)
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get live data from Google Sheets (cached, automatic proxy)
  app.get('/api/live-data', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
      const force = req.query.force === '1' || req.query.force === 'true';
      const month = typeof req.query.month === 'string' ? req.query.month : '';

      if (force || !liveCache) {
        await syncLiveGoogleSheets();
      }
      if (!liveCache) {
        return res.status(503).json({ success: false, error: 'Live data not yet ready' });
      }

      const currentMonthKey = getCurrentManilaMonthKey();
      const targetMonth = month || currentMonthKey;
      const expectedTabName = getSliPivotTabName(targetMonth);

      let sliPivotRows = liveCache.sliPivotRows || [];
      let sliPivotSource = liveCache.sliPivotSource || expectedTabName;
      let sliPivotAvailable = liveCache.sliPivotAvailable ?? true;

      // Dynamic month selection
      if (expectedTabName !== liveCache.sliPivotSource) {
        try {
          const pivotRes = await fetchSliActivationPivot(expectedTabName);
          if (pivotRes.found && pivotRes.table) {
            sliPivotRows = parseSliActivationPivotTable(pivotRes.table);
            sliPivotSource = pivotRes.sheetSource;
            sliPivotAvailable = true;
          } else {
            sliPivotRows = [];
            sliPivotSource = expectedTabName;
            sliPivotAvailable = false;
          }
        } catch (err: any) {
          sliPivotRows = [];
          sliPivotSource = expectedTabName;
          sliPivotAvailable = false;
        }
      }

      res.json({
        success: true,
        sourceName: liveCache.sourceName,
        joRows: liveCache.joRows,
        summaryRows: liveCache.summaryRows,
        targetsMap: liveCache.targetsMap,
        dailyReport: liveCache.dailyReport,
        operationalStatus: liveCache.operationalStatus,
        sliPivotRows,
        sliPivotSource,
        sliPivotAvailable,
        lastSynced: liveCache.lastSynced,
      });
    } catch (err: any) {
      if (liveCache) {
        return res.json({
          success: true,
          sourceName: liveCache.sourceName,
          joRows: liveCache.joRows,
          summaryRows: liveCache.summaryRows,
          targetsMap: liveCache.targetsMap,
          dailyReport: liveCache.dailyReport,
          operationalStatus: liveCache.operationalStatus,
          sliPivotRows: liveCache.sliPivotRows || [],
          sliPivotSource: liveCache.sliPivotSource || 'SLI ACTIVATION - SEPTEMBER 2026',
          sliPivotAvailable: liveCache.sliPivotAvailable ?? true,
          lastSynced: liveCache.lastSynced,
          warning: err.message,
        });
      }
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Force refresh live data from Google Sheets
  app.post('/api/live-data/refresh', async (req, res) => {
    try {
      const data = await syncLiveGoogleSheets();
      res.json({
        success: true,
        sourceName: data.sourceName,
        joRows: data.joRows,
        summaryRows: data.summaryRows,
        targetsMap: data.targetsMap,
        dailyReport: data.dailyReport,
        operationalStatus: data.operationalStatus,
        sliPivotRows: data.sliPivotRows,
        sliPivotSource: data.sliPivotSource,
        sliPivotAvailable: data.sliPivotAvailable,
        lastSynced: data.lastSynced,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Get current shared records across all users
  app.get('/api/records', (req, res) => {
    res.json({
      success: true,
      hasCustomData: Boolean(savedData && savedData.records && savedData.records.length > 0),
      records: savedData?.records || null,
      syncSourceInfo: savedData?.syncSourceInfo || null,
      summaryTargets: savedData?.summaryTargets || null,
      updatedAt: savedData?.updatedAt || null,
    });
  });

  // Save updated records (from Excel import, Google Sheet sync, or manual edits)
  app.post('/api/records', (req, res) => {
    try {
      const { records, syncSourceInfo, summaryTargets } = req.body;
      if (!Array.isArray(records)) {
        return res.status(400).json({ success: false, error: 'Invalid records array' });
      }

      const updatedAt = new Date().toISOString();
      savedData = {
        records,
        syncSourceInfo: syncSourceInfo || {
          fileName: 'Shared JO ACTIVATED',
          sheetName: 'JO ACTIVATED',
          isScreenshotSample: false,
          lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          rowCount: records.length,
        },
        summaryTargets: summaryTargets || savedData?.summaryTargets || null,
        updatedAt,
      };

      // Persist to disk asynchronously
      fs.writeFile(DATA_FILE, JSON.stringify(savedData), 'utf-8', (err) => {
        if (err) console.error('Error saving data to disk:', err);
      });

      res.json({
        success: true,
        count: records.length,
        updatedAt,
      });
    } catch (e: any) {
      console.error('Error saving records:', e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Reset to default
  app.post('/api/records/reset', (req, res) => {
    try {
      savedData = null;
      if (fs.existsSync(DATA_FILE)) {
        fs.unlinkSync(DATA_FILE);
      }
      res.json({ success: true, message: 'Reset to default seed data' });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
