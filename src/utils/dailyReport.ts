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
  const cells = await Promise.all([
    fetchDailyReportCell('AJ9', signal),

    fetchDailyReportCell('AK11', signal),
    fetchDailyReportCell('AK12', signal),
    fetchDailyReportCell('AK14', signal),
    fetchDailyReportCell('AK17', signal),
    fetchDailyReportCell('AK18', signal),

    fetchDailyReportCell('AK21', signal),
    fetchDailyReportCell('AK22', signal),
    fetchDailyReportCell('AK23', signal),
    fetchDailyReportCell('AK24', signal),
    fetchDailyReportCell('AK25', signal),

    fetchDailyReportCell('AK29', signal),
    fetchDailyReportCell('AK30', signal),
    fetchDailyReportCell('AK31', signal),
    fetchDailyReportCell('AK32', signal),
    fetchDailyReportCell('AK33', signal),
  ]);

  return {
    reportLabel: cells[0].formatted,
    fiberYesterday: cells[1].formatted,
    fiberToday: cells[2].formatted,
    fsoi: cells[3].formatted,
    forCloseout: cells[4].formatted,
    forActivation: cells[5].formatted,
    fiberMTD: cells[6].formatted,
    smeVatIncMTD: cells[7].formatted,
    smeVatExMTD: cells[8].formatted,
    bidaMTD: cells[9].formatted,
    s2sMTD: cells[10].formatted,
    fiberRunrate: cells[11].formatted,
    smeVatIncRunrate: cells[12].formatted,
    smeVatExRunrate: cells[13].formatted,
    bidaRunrate: cells[14].formatted,
    s2sRunrate: cells[15].formatted,
  };
}
