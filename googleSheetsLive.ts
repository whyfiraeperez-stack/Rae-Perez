const GOOGLE_SHEET_ID = '17Vpc9LKVa2sD8FIUefqEQaM937dbTFIKnBeQ-5XCSNg';
const BASE_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq`;

export async function fetchSheetGViz(sheetName: string, query?: string, range?: string) {
  let url = `${BASE_URL}?sheet=${encodeURIComponent(sheetName)}&tqx=out:json&_=${Date.now()}`;
  if (query) url += `&tq=${encodeURIComponent(query)}`;
  if (range) url += `&range=${encodeURIComponent(range)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${sheetName}`);
  
  const text = await res.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?\s*$/);
  if (!match) throw new Error(`Invalid GViz format for ${sheetName}`);

  const json = JSON.parse(match[1]);
  if (json.status === 'error') throw new Error(json.errors?.[0]?.message || 'GViz error');

  const { cols, rows } = json.table;
  const headers = cols.map((c: any, i: number) => c.label || c.id || `Col${i}`);

  return rows.map((r: any) => {
    const obj: Record<string, any> = {};
    headers.forEach((h: string, idx: number) => {
      obj[h] = r.c?.[idx]?.v ?? '';
    });
    return obj;
  });
}
