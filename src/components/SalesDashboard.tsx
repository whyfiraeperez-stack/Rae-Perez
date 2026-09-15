import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import {
  FileSpreadsheet,
  RotateCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
  Sparkles,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { JORecord, SyncSourceInfo } from '../types';
import { mapCsvRowsToJORecords } from '../utils/csvMapper';

// Default Google Sheet CSV URL (can be pasted in the UI or set here)
const GOOGLE_SHEET_CSV_URL = "";

interface SalesDashboardProps {
  onSyncToDashboard?: (records: JORecord[], sourceInfo: SyncSourceInfo) => void;
  initialUrl?: string;
}

export function SalesDashboard({ onSyncToDashboard, initialUrl = "" }: SalesDashboardProps) {
  const [sheetUrl, setSheetUrl] = useState<string>(() => {
    const saved = localStorage.getItem('almasor_google_sheet_csv_url');
    return saved || initialUrl || GOOGLE_SHEET_CSV_URL;
  });
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [copiedGuide, setCopiedGuide] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);

  // Sync / fetch Google Sheet data using PapaParse
  const fetchSheetData = (overrideUrl?: string) => {
    const activeUrl = (overrideUrl !== undefined ? overrideUrl : sheetUrl).trim();

    if (!activeUrl) {
      setLoading(false);
      setErrorMessage('Please enter or configure a published Google Sheet CSV URL.');
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setAppliedSuccess(false);

    Papa.parse(activeUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log("Parsed Data:", results.data);
        const data = results.data as any[];
        setSalesData(data);
        setLoading(false);
        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastSyncTime(timeNow);

        // Auto-save active URL
        localStorage.setItem('almasor_google_sheet_csv_url', activeUrl);

        // If callback provided, auto-map and sync to the main dashboard
        if (onSyncToDashboard && data.length > 0) {
          const mapped = mapCsvRowsToJORecords(data);
          if (mapped.length > 0) {
            onSyncToDashboard(mapped, {
              fileName: 'Live Google Sheet',
              sheetName: 'JO ACTIVATED (Live CSV)',
              sourceUrl: activeUrl,
              isGoogleSheet: true,
              lastSyncTime: timeNow,
              rowCount: mapped.length,
              totalRecords: mapped.length,
            });
            setAppliedSuccess(true);
          }
        }
      },
      error: (error) => {
        console.error("Error fetching Google Sheet:", error);
        setErrorMessage(error.message || 'Failed to download or parse Google Sheet CSV.');
        setLoading(false);
      }
    });
  };

  useEffect(() => {
    // If URL is configured, fetch immediately on mount as requested
    const targetUrl = sheetUrl.trim() || GOOGLE_SHEET_CSV_URL;
    if (targetUrl) {
      fetchSheetData(targetUrl);
    } else {
      setLoading(false);
    }
  }, []);

  const handleApplyToDashboard = () => {
    if (!onSyncToDashboard || salesData.length === 0) return;
    const mapped = mapCsvRowsToJORecords(salesData);
    onSyncToDashboard(mapped, {
      fileName: 'Live Google Sheet',
      sheetName: 'JO ACTIVATED (Live CSV)',
      sourceUrl: sheetUrl,
      isGoogleSheet: true,
      lastSyncTime: lastSyncTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rowCount: mapped.length,
      totalRecords: mapped.length,
    });
    setAppliedSuccess(true);
    setTimeout(() => setAppliedSuccess(false), 3500);
  };

  // Preview headers from parsed rows
  const previewHeaders = salesData.length > 0 ? Object.keys(salesData[0]).slice(0, 8) : [];

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#d6e3dc] shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 shadow-xs">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-[11px] font-bold tracking-widest text-[#4d7363] uppercase mb-1">
                Real-Time Data Integration
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#0f2e22]">
                Google Sheet Live Sync (PapaParse)
              </h2>
              <p className="text-sm text-[#547366] mt-0.5">
                Directly parses live comma-separated values (CSV) from your published Google Sheet into the Almasor Dashboard.
              </p>
            </div>
          </div>

          {/* Sync Button as requested in snippet */}
          <div className="flex items-center gap-3">
            <button
              id="sync-google-sheet-btn"
              onClick={() => fetchSheetData()}
              disabled={loading}
              className="flex items-center gap-2 bg-[#144c38] hover:bg-[#0f3d2c] disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Google Sheet</span>
            </button>
          </div>
        </div>

        {/* URL Configuration Bar */}
        <div className="mt-6 space-y-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-[#244b3c]">
            Published Google Sheet CSV Link:
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <input
              type="text"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv"
              className="flex-1 w-full bg-[#f9fbf9] border border-[#cfdfd6] focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl px-4 py-2.5 text-xs text-[#0f2e22] font-mono shadow-2xs"
            />
            <button
              onClick={() => fetchSheetData(sheetUrl)}
              className="w-full sm:w-auto bg-[#e5f5ed] hover:bg-[#d5eedf] text-[#0f3d2c] border border-[#bfe6d0] px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Fetch & Parse
            </button>
          </div>

          {errorMessage && (
            <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Publishing instructions */}
          <div className="bg-[#f4f9f6] border border-[#d6e9df] p-4 rounded-2xl text-xs text-[#2a5443] space-y-2">
            <div className="font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#144231]">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                How to publish your Google Sheet as CSV:
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('File > Share > Publish to web > Select Sheet > Choose CSV (.csv) > Publish');
                  setCopiedGuide(true);
                  setTimeout(() => setCopiedGuide(false), 2000);
                }}
                className="text-[11px] text-emerald-800 hover:text-emerald-950 font-semibold flex items-center gap-1 cursor-pointer"
              >
                {copiedGuide ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedGuide ? 'Copied' : 'Copy instructions'}</span>
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[#3b6653] font-medium leading-relaxed pl-1">
              <li>In Google Sheets, click <strong className="text-[#0d2a21]">File</strong> &gt; <strong className="text-[#0d2a21]">Share</strong> &gt; <strong className="text-[#0d2a21]">Publish to web</strong>.</li>
              <li>Under <strong className="text-[#0d2a21]">Link</strong>, choose the tab (e.g. <strong className="text-[#0d2a21]">JO ACTIVATED</strong>).</li>
              <li>Change &ldquo;Web page&rdquo; to <strong className="text-[#0d2a21]">Comma-separated values (.csv)</strong>.</li>
              <li>Click <strong className="text-[#0d2a21]">Publish</strong>, copy the generated link, and paste it into the field above.</li>
            </ol>
          </div>
        </div>

        {/* Live Status and Total Records Indicator */}
        <div className="mt-6 pt-5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-emerald-800 font-semibold">
                <RotateCw className="w-4 h-4 animate-spin text-emerald-600" />
                <p>Loading live data...</p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-sm font-bold text-[#0d2a21] bg-emerald-100/70 border border-emerald-300/80 px-3.5 py-1.5 rounded-xl">
                  Total Records: {salesData.length}
                </div>
                {lastSyncTime && (
                  <span className="text-xs text-[#527a68]">
                    Last synced at <strong>{lastSyncTime}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Apply to Dashboard Action */}
          {salesData.length > 0 && onSyncToDashboard && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleApplyToDashboard}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  appliedSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#0e3b2c] hover:bg-[#092a1f] text-white shadow-xs'
                }`}
              >
                {appliedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Applied to Almasor Dashboard!</span>
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    <span>Push to Almasor Dashboard</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Data Preview Table */}
      {salesData.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-[#d6e3dc] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0f2e22] flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Parsed CSV Rows Preview (First 15 Rows)</span>
            </h3>
            <span className="text-xs text-[#547366] font-medium">
              Showing {Math.min(15, salesData.length)} of {salesData.length} rows
            </span>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#144232] text-white">
                  <th className="py-2.5 px-3 font-semibold w-12 text-center">#</th>
                  {previewHeaders.map((h) => (
                    <th key={h} className="py-2.5 px-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesData.slice(0, 15).map((row, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#fbfdfc]'}>
                    <td className="py-2 px-3 text-center font-mono text-gray-400">{idx + 1}</td>
                    {previewHeaders.map((h) => (
                      <td key={h} className="py-2 px-3 text-[#1f4032] whitespace-nowrap font-medium">
                        {String(row[h] || '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
