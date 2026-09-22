import { DailyReportAlmasor } from '../types';

export const GOOGLE_SHEET_ID = '17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg';
export const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}`;

export const DEFAULT_DAILY_REPORT: DailyReportAlmasor = {
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

export async function fetchDailyReportCell(cell: string, signal?: AbortSignal): Promise<{ value: any; formatted: string }> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=${encodeURIComponent('DAILY REPORT ALMASOR')}` +
    `&range=${encodeURIComponent(cell)}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    cache: 'no-store',
    signal,
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

export async function fetchDailyReportAlmasor(signal?: AbortSignal): Promise<DailyReportAlmasor> {
  const url =
    `${GOOGLE_SHEET_URL}/gviz/tq` +
    `?sheet=${encodeURIComponent('DAILY REPORT ALMASOR')}` +
    `&range=${encodeURIComponent('AJ1:AK45')}` +
    `&tqx=out:json` +
    `&_=${Date.now()}`;

  const response = await fetch(url, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `DAILY REPORT ALMASOR fetch failed: HTTP ${response.status}`
    );
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
  const result: DailyReportAlmasor = { ...DEFAULT_DAILY_REPORT };

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
