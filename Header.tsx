import React from 'react';
import { Calendar, RotateCw, UploadCloud, Plus, ChevronDown, CheckCircle2, FileSpreadsheet, Layers } from 'lucide-react';
import { SyncSourceInfo } from '../types';
import { DateFilterMode, getDatesInMonth, formatDateDisplay, formatMonthDisplay } from '../utils/dateCountingEngine';

interface HeaderProps {
  dateMode: DateFilterMode;
  onChangeDateMode: (mode: DateFilterMode) => void;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  selectedYear: number;
  selectedMonth: number;
  onChangeMonth: (year: number, month: number) => void;
  availableMonths: { year: number; month: number; label: string }[];
  onRefresh: () => void;
  onOpenImport: () => void;
  onOpenAddRecord: () => void;
  onOpenLiveSync?: () => void;
  recordCount: number;
  vendorCount: number;
  isRefreshing?: boolean;
  syncSourceInfo?: SyncSourceInfo | null;
  fiberXCount?: number;
  smeCount?: number;
  bidaCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  dateMode,
  onChangeDateMode,
  selectedDate,
  onChangeDate,
  selectedYear,
  selectedMonth,
  onChangeMonth,
  availableMonths,
  onRefresh,
  onOpenImport,
  onOpenAddRecord,
  onOpenLiveSync,
  recordCount,
  vendorCount,
  isRefreshing = false,
  syncSourceInfo,
  fiberXCount,
  smeCount,
  bidaCount,
}) => {
  // Generate every calendar day for the currently selected month & year (e.g. September 01, 2026 ... September 30, 2026)
  // Calendar-generated, NOT from spreadsheet rows. Zero-count days are preserved.
  const calendarDays = getDatesInMonth(selectedYear, selectedMonth).map((d) => formatDateDisplay(d));

  return (
    <header id="app-header" className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title area */}
        <div>
          <div className="text-[11px] font-bold tracking-widest text-[#4d7363] uppercase mb-1">
            BICOL REGION / DAILY REPORT
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0f2e22]">
            Sales performance
          </h1>
          <p className="text-sm text-[#547366] mt-0.5 font-normal">
            A clear view of MTD progress against target across the Almasor territory.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Filter Mode Selector */}
          <div className="flex items-center bg-white border border-[#d6e3dc] hover:border-[#b0c8bd] px-3 py-1.5 rounded-xl text-xs shadow-xs transition-colors">
            <span className="text-[#547366] font-medium mr-1.5 whitespace-nowrap">Date Mode:</span>
            <div className="relative flex items-center">
              <select
                id="header-date-mode-select"
                value={dateMode}
                onChange={(e) => onChangeDateMode(e.target.value as DateFilterMode)}
                aria-label="Select Date Filter Mode"
                className="appearance-none bg-transparent font-bold text-[#0f2e22] pr-5 focus:outline-hidden cursor-pointer"
              >
                <option value="specific_date">Specific Date</option>
                <option value="entire_month">Entire Month</option>
              </select>
              <ChevronDown className="w-3 h-3 text-[#547366] absolute right-0 pointer-events-none" />
            </div>
          </div>

          {/* Date / Month Selector */}
          {dateMode === 'specific_date' ? (
            <div className="flex items-center bg-white border border-[#d6e3dc] hover:border-[#b0c8bd] px-3 py-1.5 rounded-xl text-xs shadow-xs transition-colors">
              <Calendar className="w-3.5 h-3.5 text-[#3b6d58] mr-1.5 shrink-0" />
              <span className="text-[#547366] font-medium mr-1.5 whitespace-nowrap">Date:</span>
              <div className="relative flex items-center">
                <select
                  id="header-specific-date-select"
                  value={selectedDate}
                  onChange={(e) => onChangeDate(e.target.value)}
                  aria-label="Select Specific Date"
                  className="appearance-none bg-transparent font-bold text-[#0f2e22] pr-5 focus:outline-hidden cursor-pointer min-w-[150px]"
                >
                  {calendarDays.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#547366] absolute right-0 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="flex items-center bg-white border border-[#d6e3dc] hover:border-[#b0c8bd] px-3 py-1.5 rounded-xl text-xs shadow-xs transition-colors">
              <Calendar className="w-3.5 h-3.5 text-[#3b6d58] mr-1.5 shrink-0" />
              <span className="text-[#547366] font-medium mr-1.5 whitespace-nowrap">Month:</span>
              <div className="relative flex items-center">
                <select
                  id="header-month-select"
                  value={`${selectedYear}-${selectedMonth}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    onChangeMonth(y, m);
                  }}
                  aria-label="Select Entire Month"
                  className="appearance-none bg-transparent font-bold text-[#0f2e22] pr-5 focus:outline-hidden cursor-pointer min-w-[140px]"
                >
                  {availableMonths.map((m) => (
                    <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-[#547366] absolute right-0 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Refresh button */}
          <button
            id="refresh-btn"
            title="Refresh calculations and data"
            onClick={onRefresh}
            className="w-9 h-9 flex items-center justify-center bg-white border border-[#d6e3dc] hover:border-[#b0c8bd] text-[#244b3c] rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {/* Google Sheet Live Sync button */}
          {onOpenLiveSync && (
            <button
              id="header-sync-gsheet-btn"
              onClick={onOpenLiveSync}
              className="flex items-center gap-2 bg-[#e8f7ee] hover:bg-[#d6f0df] border border-[#a8ddbe] text-[#0d3f2c] px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Sync Google Sheet</span>
            </button>
          )}

          {/* Import Excel button */}
          <button
            id="import-excel-btn"
            onClick={onOpenImport}
            className="flex items-center gap-2 bg-white border border-[#b8dec8] hover:border-[#8ec5a5] hover:bg-[#f2faf5] text-[#0f3f2d] px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <UploadCloud className="w-3.5 h-3.5 text-emerald-700" />
            <span>Sync Excel</span>
          </button>

          {/* Add Record button */}
          <button
            id="add-record-btn"
            onClick={onOpenAddRecord}
            className="flex items-center gap-1.5 bg-[#144c38] hover:bg-[#0f3d2c] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add record</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div
        id="import-status-banner"
        className="bg-[#e4f6ec] border border-[#bfe6d0] text-[#134431] px-4 py-2.5 rounded-2xl text-xs font-medium flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-600/15 flex items-center justify-center text-emerald-700 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              Synced source: <strong className="font-bold text-[#0d2f21]">{syncSourceInfo?.fileName || 'JO_ACTIVATED_ALMASOR.xlsx'}</strong>
              {syncSourceInfo?.sheetName && (
                <span className="text-[#3b6b57]"> (Sheet: <strong className="font-semibold text-[#0d2f21]">{syncSourceInfo.sheetName}</strong>)</span>
              )}
            </span>
            <span className="text-gray-400 hidden sm:inline">•</span>
            <span className="text-[11px] text-[#2c5b48]">
              <strong className="font-bold text-[#0d2f21]">{recordCount}</strong> total JOs
              {fiberXCount !== undefined && (
                <> (<strong className="font-semibold text-[#0d2f21]">{fiberXCount}</strong> FiberX, <strong className="font-semibold text-[#0d2f21]">{smeCount || 0}</strong> SME{bidaCount ? `, ${bidaCount} BIDA` : ''})</>
              )}
            </span>
            <span className="text-gray-400 hidden sm:inline">•</span>
            <span className="text-[11px] bg-emerald-700/10 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
              Mode: {dateMode === 'specific_date' ? `Specific Date (${selectedDate})` : `Entire Month (${formatMonthDisplay(selectedYear, selectedMonth)})`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <button
            onClick={onOpenImport}
            className="text-[11px] font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
            <span>Verify Live Counts</span>
          </button>
        </div>
      </div>
    </header>
  );
};
