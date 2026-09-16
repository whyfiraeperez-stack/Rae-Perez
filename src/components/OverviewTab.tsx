import React, { useState, useMemo } from 'react';
import {
  Wifi,
  Target,
  TrendingUp,
  ArrowUpRight,
  ChevronDown,
  Layers,
  Calendar,
  CheckCircle2,
  Table as TableIcon,
  Filter,
} from 'lucide-react';
import { DashboardMetrics, JORecord, Province, SliType } from '../types';
import {
  DateFilterMode,
  formatDateDisplay,
  formatMonthDisplay,
  getDatesInMonth,
  countActivatedForDate,
  countActivatedForMonth,
  filterRecordsForDate,
  filterRecordsForMonth,
  sumAmountForDate,
  sumAmountForMonth,
} from '../utils/dateCountingEngine';
import { GroupingMatrixView } from './GroupingMatrixView';

interface OverviewTabProps {
  metrics: DashboardMetrics;
  records: JORecord[];
  dateMode: DateFilterMode;
  onChangeDateMode: (mode: DateFilterMode) => void;
  selectedDate: string;
  onChangeDate: (date: string) => void;
  selectedYear: number;
  selectedMonth: number;
  onChangeMonth: (year: number, month: number) => void;
  availableMonths: { year: number; month: number; label: string }[];
  onNavigateToVendors?: () => void;
  onNavigateToRawData?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  metrics,
  records,
  dateMode,
  onChangeDateMode,
  selectedDate,
  onChangeDate,
  selectedYear,
  selectedMonth,
  onChangeMonth,
  availableMonths,
  onNavigateToVendors,
  onNavigateToRawData,
}) => {
  // Dashboard filters
  const [selectedTerritory, setSelectedTerritory] = useState<string>('All districts');
  const [selectedSliType, setSelectedSliType] = useState<string>('All');
  const [selectedMeasure, setSelectedMeasure] = useState<string>('FiberX');
  const [showRecordDrawer, setShowRecordDrawer] = useState<boolean>(false);

  // Generate calendar days dynamically for the selected month (e.g. September 01, 2026 ... September 30, 2026)
  const calendarDays = useMemo(() => {
    return getDatesInMonth(selectedYear, selectedMonth).map((d) => formatDateDisplay(d));
  }, [selectedYear, selectedMonth]);

  // Current month display label
  const monthDisplayLabel = useMemo(() => {
    return formatMonthDisplay(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Dynamic calculation using raw JO ACTIVATED data and authoritative Column AF (CLOSING DATE)
  const activatedCount = useMemo(() => {
    if (dateMode === 'specific_date') {
      return countActivatedForDate(
        records,
        selectedDate,
        selectedTerritory === 'All districts' ? 'All' : selectedTerritory,
        selectedSliType === 'All SLI Types' ? 'All' : selectedSliType,
        selectedMeasure === 'All Packages' ? 'All' : selectedMeasure
      );
    } else {
      return countActivatedForMonth(
        records,
        selectedYear,
        selectedMonth,
        selectedTerritory === 'All districts' ? 'All' : selectedTerritory,
        selectedSliType === 'All SLI Types' ? 'All' : selectedSliType,
        selectedMeasure === 'All Packages' ? 'All' : selectedMeasure
      );
    }
  }, [records, dateMode, selectedDate, selectedYear, selectedMonth, selectedTerritory, selectedSliType, selectedMeasure]);

  // Filtered matching records for inspection
  const matchingRecords = useMemo(() => {
    if (dateMode === 'specific_date') {
      return filterRecordsForDate(
        records,
        selectedDate,
        selectedTerritory === 'All districts' ? 'All' : selectedTerritory,
        selectedSliType === 'All SLI Types' ? 'All' : selectedSliType,
        selectedMeasure === 'All Packages' ? 'All' : selectedMeasure
      );
    } else {
      return filterRecordsForMonth(
        records,
        selectedYear,
        selectedMonth,
        selectedTerritory === 'All districts' ? 'All' : selectedTerritory,
        selectedSliType === 'All SLI Types' ? 'All' : selectedSliType,
        selectedMeasure === 'All Packages' ? 'All' : selectedMeasure
      );
    }
  }, [records, dateMode, selectedDate, selectedYear, selectedMonth, selectedTerritory, selectedSliType, selectedMeasure]);

  // SME MRC Amount calculation if SME is chosen
  const activatedSmeAmount = useMemo(() => {
    if (dateMode === 'specific_date') {
      return sumAmountForDate(
        records,
        selectedDate,
        selectedTerritory === 'All districts' ? 'All' : selectedTerritory,
        selectedSliType === 'All SLI Types' ? 'All' : selectedSliType,
        selectedMeasure === 'All Packages' ? 'All' : selectedMeasure
      );
    } else {
      return sumAmountForMonth(
        records,
        selectedYear,
        selectedMonth,
        selectedTerritory === 'All districts' ? 'All' : selectedTerritory,
        selectedSliType === 'All SLI Types' ? 'All' : selectedSliType,
        selectedMeasure === 'All Packages' ? 'All' : selectedMeasure
      );
    }
  }, [records, dateMode, selectedDate, selectedYear, selectedMonth, selectedTerritory, selectedSliType, selectedMeasure]);

  // Territory targets mapping based on photo baseline
  const monthlyTarget = useMemo(() => {
    if (selectedMeasure === 'FiberX') {
      if (selectedTerritory === 'Albay') return 300;
      if (selectedTerritory === 'Sorsogon') return 120;
      if (selectedTerritory === 'Masbate') return 140;
      return 560; // All districts
    }
    if (selectedMeasure === 'SME') {
      if (selectedTerritory === 'Albay') return 100000;
      if (selectedTerritory === 'Sorsogon') return 40000;
      if (selectedTerritory === 'Masbate') return 60000;
      return 200000; // All districts
    }
    if (selectedMeasure === 'BIDA') {
      return selectedTerritory === 'All districts' ? 60 : 20;
    }
    if (selectedMeasure === 'S2S') {
      return selectedTerritory === 'All districts' ? 40 : 15;
    }
    return 660; // All Packages total
  }, [selectedMeasure, selectedTerritory]);

  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Target and Progress calculation depending on Date Mode
  const effectiveTarget = dateMode === 'specific_date' ? Math.max(1, Math.round(monthlyTarget / daysInMonth)) : monthlyTarget;
  const targetActualValue = selectedMeasure === 'SME' ? activatedSmeAmount : activatedCount;
  const progressPct = effectiveTarget > 0 ? (targetActualValue / effectiveTarget) * 100 : 0;
  const runningUnit = selectedMeasure === 'SME' ? '₱' : '';

  // Channel Mix numbers calculated directly from matching records
  const inhouseCount = useMemo(() => {
    return matchingRecords.filter((r) => (r.sliType || '').toUpperCase() === 'INHOUSE').length;
  }, [matchingRecords]);

  const msaCount = useMemo(() => {
    return matchingRecords.filter((r) => (r.sliType || '').toUpperCase() === 'MSA').length;
  }, [matchingRecords]);

  const channelTotal = inhouseCount + msaCount;
  const inhousePct = channelTotal > 0 ? Math.round((inhouseCount / channelTotal) * 100) : 0;
  const msaPct = channelTotal > 0 ? 100 - inhousePct : 0;

  // Donut SVG parameters
  const strokeWidth = 14;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const inhouseDash = (circumference * inhousePct) / 100;
  const msaDash = circumference - inhouseDash;

  // Province breakdowns for district cards
  const provinceCounts = useMemo(() => {
    const albay = (dateMode === 'specific_date'
      ? filterRecordsForDate(records, selectedDate, 'ALBAY', selectedSliType === 'All SLI Types' ? 'All' : selectedSliType, selectedMeasure === 'All Packages' ? 'All' : selectedMeasure)
      : filterRecordsForMonth(records, selectedYear, selectedMonth, 'ALBAY', selectedSliType === 'All SLI Types' ? 'All' : selectedSliType, selectedMeasure === 'All Packages' ? 'All' : selectedMeasure)
    ).length;

    const sorsogon = (dateMode === 'specific_date'
      ? filterRecordsForDate(records, selectedDate, 'SORSOGON', selectedSliType === 'All SLI Types' ? 'All' : selectedSliType, selectedMeasure === 'All Packages' ? 'All' : selectedMeasure)
      : filterRecordsForMonth(records, selectedYear, selectedMonth, 'SORSOGON', selectedSliType === 'All SLI Types' ? 'All' : selectedSliType, selectedMeasure === 'All Packages' ? 'All' : selectedMeasure)
    ).length;

    const masbate = (dateMode === 'specific_date'
      ? filterRecordsForDate(records, selectedDate, 'MASBATE', selectedSliType === 'All SLI Types' ? 'All' : selectedSliType, selectedMeasure === 'All Packages' ? 'All' : selectedMeasure)
      : filterRecordsForMonth(records, selectedYear, selectedMonth, 'MASBATE', selectedSliType === 'All SLI Types' ? 'All' : selectedSliType, selectedMeasure === 'All Packages' ? 'All' : selectedMeasure)
    ).length;

    return { albay, sorsogon, masbate };
  }, [records, dateMode, selectedDate, selectedYear, selectedMonth, selectedSliType, selectedMeasure]);

  return (
    <div id="overview-view" className="space-y-6">
      {/* Dynamic Filter / Date Control Bar */}
      <div
        id="filter-bar"
        className="bg-white border border-[#dce7e1] rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs"
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Live indicator */}
          <div className="flex items-center gap-2 mr-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-[#144937]">Live Data</span>
          </div>

          {/* Date Mode Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#587a6d]">Date Mode</span>
            <div className="relative">
              <select
                id="filter-date-mode"
                value={dateMode}
                onChange={(e) => onChangeDateMode(e.target.value as DateFilterMode)}
                aria-label="Select date mode"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-bold rounded-xl pl-3 pr-8 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="specific_date">Specific Date</option>
                <option value="entire_month">Entire Month</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Date Selector (Specific Date Mode) or Month Selector (Entire Month Mode) */}
          {dateMode === 'specific_date' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-[#587a6d]">Date</span>
              <div className="relative">
                <select
                  id="filter-specific-date"
                  value={selectedDate}
                  onChange={(e) => onChangeDate(e.target.value)}
                  aria-label="Select specific calendar date"
                  className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-bold rounded-xl pl-3 pr-8 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                >
                  {calendarDays.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-[#587a6d]">Month</span>
              <div className="relative">
                <select
                  id="filter-entire-month"
                  value={`${selectedYear}-${selectedMonth}`}
                  onChange={(e) => {
                    const [y, m] = e.target.value.split('-').map(Number);
                    onChangeMonth(y, m);
                  }}
                  aria-label="Select month"
                  className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-bold rounded-xl pl-3 pr-8 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Territory Dropdown (Column G: STATEORPROVINCE) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#587a6d]">Territory</span>
            <div className="relative">
              <select
                id="filter-territory"
                value={selectedTerritory}
                onChange={(e) => setSelectedTerritory(e.target.value)}
                aria-label="Filter territory"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="All districts">All districts</option>
                <option value="Albay">Albay</option>
                <option value="Sorsogon">Sorsogon</option>
                <option value="Masbate">Masbate</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* SLI Type Dropdown (Column S: SLI TYPE) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#587a6d]">SLI Type</span>
            <div className="relative">
              <select
                id="filter-sli-type"
                value={selectedSliType}
                onChange={(e) => setSelectedSliType(e.target.value)}
                aria-label="Filter SLI Type"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="All">All SLI Types</option>
                <option value="INHOUSE">INHOUSE</option>
                <option value="MSA">MSA</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Package / Measure Dropdown (Column AC: PACKAGE) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#587a6d]">Package</span>
            <div className="relative">
              <select
                id="filter-measure"
                value={selectedMeasure}
                onChange={(e) => setSelectedMeasure(e.target.value)}
                aria-label="Filter package measure"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="FiberX">FiberX</option>
                <option value="SME">SME</option>
                <option value="BIDA">BIDA</option>
                <option value="S2S">S2S</option>
                <option value="All Packages">All Packages</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Inspect Matching Rows toggle */}
        <button
          onClick={() => setShowRecordDrawer(!showRecordDrawer)}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
        >
          <TableIcon className="w-3.5 h-3.5 text-emerald-700" />
          <span>{showRecordDrawer ? 'Hide Rows' : `Inspect Rows (${matchingRecords.length})`}</span>
        </button>
      </div>

      {/* Main Top Cards Grid (Left Hero Card + Right Portfolio Snapshot) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Hero Card - Deep Forest Green */}
        <div
          id="hero-metric-card"
          className="lg:col-span-7 bg-[#144c38] text-white rounded-3xl p-7 shadow-md flex flex-col justify-between relative overflow-hidden"
        >
          {/* Subtle decorative background glow */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#1f6a4e] rounded-full blur-3xl opacity-30 pointer-events-none"></div>

          <div>
            {/* Card Header & Date Mode Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold">
                <div className="w-6 h-6 rounded-full bg-[#1e6147] flex items-center justify-center">
                  <Wifi className="w-3.5 h-3.5 text-emerald-300" />
                </div>
                <span>
                  {dateMode === 'specific_date' ? selectedDate : monthDisplayLabel} •{' '}
                  {selectedMeasure === 'All Packages' ? 'All Packages' : selectedMeasure} Activated
                </span>
              </div>

              <div className="bg-[#0e3b2b] border border-[#276c52] px-2.5 py-1 rounded-full text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{dateMode === 'specific_date' ? 'Specific Date Mode' : 'Entire Month Mode'}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              {/* Giant Count Number (Strict user requirement) */}
              <div>
                <div className="text-6xl font-extrabold tracking-tight text-white font-sans">
                  {selectedMeasure === 'SME' ? `₱${activatedSmeAmount.toLocaleString()}` : activatedCount.toLocaleString()}
                </div>

                {/* Clear mode subtext specified in prompt */}
                <div className="text-xs text-emerald-200 font-medium mt-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>
                    {dateMode === 'specific_date'
                      ? `Activated on ${selectedDate}`
                      : `Activated during ${monthDisplayLabel}`}
                  </span>
                  {selectedMeasure === 'SME' && (
                    <span className="text-white font-bold ml-1">
                      ({activatedCount} JOs)
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-emerald-300/80 mt-1">
                  Source: Column AF (CLOSING DATE) matching raw JO ACTIVATED data
                </div>
              </div>

              {/* Sub-card: Target Attainment */}
              <div className="bg-[#113f2e]/90 border border-[#276b51] rounded-2xl p-4 min-w-[160px] text-center shadow-inner">
                <div className="w-7 h-7 mx-auto rounded-full bg-[#1b5d43] flex items-center justify-center mb-1.5">
                  <Target className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wide">
                  {dateMode === 'specific_date' ? 'Daily Pace' : 'Monthly Attainment'}
                </div>
                <div className="text-2xl font-black text-white mt-0.5">
                  {progressPct.toFixed(1)}%
                </div>
                <div className="text-[11px] text-emerald-300 font-semibold flex items-center justify-center gap-1 mt-1">
                  <span>Goal: {runningUnit}{effectiveTarget.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Slider Track */}
          <div className="mt-8 pt-4">
            <div className="relative flex items-center">
              <div className="w-full h-3 bg-[#0c3123] rounded-full overflow-hidden p-0.5 shadow-inner">
                <div
                  className="h-full bg-linear-to-r from-emerald-400 to-[#38d39f] rounded-full transition-all duration-700 relative"
                  style={{ width: `${Math.min(100, Math.max(2, progressPct))}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md -mr-1 border-2 border-emerald-600"></div>
                </div>
              </div>
            </div>

            {/* Range markers */}
            <div className="flex items-center justify-between text-xs text-emerald-200/80 font-medium mt-2.5">
              <span>0</span>
              <span className="text-white font-bold text-xs bg-[#1a5a41] px-2.5 py-0.5 rounded-full">
                {activatedCount} {selectedMeasure} Activated
              </span>
              <span>{runningUnit}{effectiveTarget.toLocaleString()}</span>
            </div>

            {/* Formula verification banner */}
            <div className="mt-3 pt-2.5 border-t border-[#1e6147] flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-200/90 font-mono">
              <span className="flex items-center gap-1.5 truncate max-w-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                {dateMode === 'specific_date' ? (
                  <span>COUNTIFS(G=&quot;{selectedTerritory}&quot;, S=&quot;{selectedSliType}&quot;, AC=&quot;{selectedMeasure}&quot;, AF=&quot;{selectedDate}&quot;)</span>
                ) : (
                  <span>COUNTIFS(G=&quot;{selectedTerritory}&quot;, S=&quot;{selectedSliType}&quot;, AC=&quot;{selectedMeasure}&quot;, AF in {monthDisplayLabel})</span>
                )}
              </span>
              <span className="font-bold text-white bg-[#0e3b2a] px-2 py-0.5 rounded border border-[#237053]">
                = {activatedCount} JOs
              </span>
            </div>
          </div>
        </div>

        {/* Right Card - Portfolio Snapshot */}
        <div
          id="portfolio-snapshot-card"
          className="lg:col-span-5 bg-white border border-[#dce7e1] rounded-3xl p-7 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="text-[11px] font-bold tracking-wider text-[#587a6d] uppercase">
              PORTFOLIO SNAPSHOT
            </div>
            <h2 className="text-xl font-bold text-[#0f2e22] mt-0.5">
              {selectedTerritory === 'All districts' ? 'Bicol territory' : `${selectedTerritory} district`}
            </h2>
            <p className="text-xs text-[#688a7e] font-normal mt-0.5">
              Filter: {selectedSliType === 'All' ? 'All SLI Types' : selectedSliType} •{' '}
              {selectedMeasure === 'All Packages' ? 'All Packages' : selectedMeasure}
            </p>
          </div>

          {/* 3 Metric Cards side by side */}
          <div className="grid grid-cols-3 gap-3 my-4">
            {/* Activated Count */}
            <div className="bg-[#f7faf8] border border-[#e2ece6] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="w-6 h-6 rounded-full bg-[#dcf2e6] flex items-center justify-center text-[#144c37] mb-2">
                <Wifi className="w-3 h-3" />
              </div>
              <div className="text-[10px] font-semibold text-[#5a7c6f]">
                {dateMode === 'specific_date' ? 'Date Count' : 'Month Total'}
              </div>
              <div className="text-xl font-bold text-[#0e2c20] mt-0.5">
                {activatedCount.toLocaleString()}
              </div>
              <div className="text-[10px] text-[#719385] mt-1 truncate">
                {dateMode === 'specific_date' ? 'on date' : 'in month'}
              </div>
            </div>

            {/* Target */}
            <div className="bg-[#f7faf8] border border-[#e2ece6] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="w-6 h-6 rounded-full bg-[#dcf2e6] flex items-center justify-center text-[#144c37] mb-2">
                <Target className="w-3 h-3" />
              </div>
              <div className="text-[10px] font-semibold text-[#5a7c6f]">
                {dateMode === 'specific_date' ? 'Daily Goal' : 'Target'}
              </div>
              <div className="text-xl font-bold text-[#0e2c20] mt-0.5">
                {runningUnit}{effectiveTarget.toLocaleString()}
              </div>
              <div className="text-[10px] text-[#719385] mt-1">
                {dateMode === 'specific_date' ? 'run-rate goal' : 'monthly goal'}
              </div>
            </div>

            {/* Progress */}
            <div className="bg-[#f7faf8] border border-[#e2ece6] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="w-6 h-6 rounded-full bg-[#dcf2e6] flex items-center justify-center text-[#144c37] mb-2">
                <TrendingUp className="w-3 h-3" />
              </div>
              <div className="text-[10px] font-semibold text-[#5a7c6f]">
                Progress
              </div>
              <div className="text-xl font-bold text-[#0e2c20] mt-0.5">
                {progressPct.toFixed(1)}%
              </div>
              <div className="w-full bg-[#e0ede6] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-emerald-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, progressPct)}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#698a7d] flex items-center justify-between border-t border-[#edf3f0] pt-3">
            <span>
              Mode: <strong className="text-[#144c38] font-bold">{dateMode === 'specific_date' ? 'Specific Date' : 'Entire Month'}</strong>
            </span>
            <span className="font-semibold text-emerald-700">
              Matching rows: {matchingRecords.length}
            </span>
          </div>
        </div>
      </div>

      {/* Matching Raw JO Records Inspection Drawer */}
      {showRecordDrawer && (
        <div className="bg-white border border-[#cbe4d5] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                <TableIcon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0e2d21]">
                  Matching JO Rows for {dateMode === 'specific_date' ? selectedDate : monthDisplayLabel}
                </h3>
                <p className="text-xs text-[#5d8072]">
                  {matchingRecords.length} records where Province=&apos;{selectedTerritory}&apos;, SLI Type=&apos;{selectedSliType}&apos;, Package=&apos;{selectedMeasure}&apos;
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowRecordDrawer(false)}
              className="text-xs text-[#527567] hover:text-[#0e2d21] font-semibold px-2 py-1"
            >
              Close
            </button>
          </div>

          {matchingRecords.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#6e8f81] bg-[#f8faf9] rounded-2xl border border-dashed border-[#d8e6df]">
              No activated JO records found for {dateMode === 'specific_date' ? selectedDate : monthDisplayLabel} with current filters.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 border border-[#e2ebe6] rounded-2xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#f0f6f2] text-[#1e4839] font-bold sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2.5">JO Number</th>
                    <th className="px-3.5 py-2.5">STATEORPROVINCE (Col G)</th>
                    <th className="px-3.5 py-2.5">SLI TYPE (Col S)</th>
                    <th className="px-3.5 py-2.5">PACKAGE (Col AC)</th>
                    <th className="px-3.5 py-2.5">CLOSING DATE (Col AF)</th>
                    <th className="px-3.5 py-2.5">Vendor</th>
                    <th className="px-3.5 py-2.5 text-right">MRC (Col AE)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf3ef]">
                  {matchingRecords.slice(0, 100).map((r, i) => (
                    <tr key={r.id || i} className="hover:bg-[#f6fbf8]">
                      <td className="px-3.5 py-2 font-mono font-medium text-[#0f2e22]">{r.joNumber}</td>
                      <td className="px-3.5 py-2 text-[#244c3c] font-semibold">{r.stateOrProvince}</td>
                      <td className="px-3.5 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.sliType === 'INHOUSE' ? 'bg-emerald-100 text-emerald-900' : 'bg-teal-100 text-teal-900'}`}>
                          {r.sliType}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-[#244c3c]">{r.packageName}</td>
                      <td className="px-3.5 py-2 font-mono text-[#0e3b2b] font-bold">{r.closingDate || r.activationDate}</td>
                      <td className="px-3.5 py-2 text-[#4f7164]">{r.vendor}</td>
                      <td className="px-3.5 py-2 text-right font-medium text-[#184635]">
                        {r.amount ? `₱${r.amount.toLocaleString()}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bottom Grid: District Breakdown (Left) + Channel Mix (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* District Breakdown */}
        <div
          id="district-breakdown-card"
          className="lg:col-span-7 bg-white border border-[#dce7e1] rounded-3xl p-7 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] font-bold tracking-wider text-[#587a6d] uppercase">
                  DISTRICT BREAKDOWN
                </div>
                <h2 className="text-xl font-bold text-[#0f2e22]">
                  {dateMode === 'specific_date' ? `Activations on ${selectedDate}` : `Activations during ${monthDisplayLabel}`}
                </h2>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-semibold text-[#547366]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#18533e]"></span>
                  <span>activated</span>
                </div>
              </div>
            </div>

            {/* Territory Bars */}
            <div className="space-y-4 my-6">
              {[
                { name: 'Albay', prov: 'ALBAY', count: provinceCounts.albay, target: dateMode === 'specific_date' ? 10 : 300 },
                { name: 'Sorsogon', prov: 'SORSOGON', count: provinceCounts.sorsogon, target: dateMode === 'specific_date' ? 4 : 120 },
                { name: 'Masbate', prov: 'MASBATE', count: provinceCounts.masbate, target: dateMode === 'specific_date' ? 5 : 140 },
              ].map((item) => {
                const totalFiltered = provinceCounts.albay + provinceCounts.sorsogon + provinceCounts.masbate;
                const pctOfTotal = totalFiltered > 0 ? (item.count / totalFiltered) * 100 : 0;

                return (
                  <div key={item.prov} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#143e30]">{item.name}</span>
                        <span className="text-[#6d8d80] text-[11px]">
                          ({item.count} JOs)
                        </span>
                      </div>
                      <span className="font-bold text-[#143e30]">{pctOfTotal.toFixed(1)}% of total</span>
                    </div>

                    {/* Bar visualization */}
                    <div className="w-full h-3 bg-[#e8f0ec] rounded-full overflow-hidden flex">
                      <div
                        className="bg-[#18533e] h-full rounded-l-full transition-all duration-500"
                        style={{ width: `${Math.min(100, pctOfTotal)}%` }}
                      ></div>
                      <div
                        className="bg-[#d6e3dc] h-full"
                        style={{ width: `${Math.max(0, 100 - pctOfTotal)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer of District Breakdown */}
          <div className="flex items-center justify-between border-t border-[#edf3f0] pt-4 text-xs">
            <span className="text-[#648779]">
              Filtered by: {selectedSliType === 'All' ? 'All SLI Types' : selectedSliType} • {selectedMeasure}
            </span>
            {onNavigateToVendors && (
              <button
                onClick={onNavigateToVendors}
                className="font-bold text-[#144c38] hover:text-[#0b3325] flex items-center gap-1 hover:underline transition-colors"
              >
                <span>View vendor contribution</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Channel Mix - Donut Card */}
        <div
          id="channel-mix-card"
          className="lg:col-span-5 bg-white border border-[#dce7e1] rounded-3xl p-7 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold tracking-wider text-[#587a6d] uppercase">
                CHANNEL MIX
              </div>
              <span className="text-xs font-semibold text-[#5a7d70]">
                {channelTotal.toLocaleString()} total
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#0f2e22] mt-0.5">
              {dateMode === 'specific_date' ? `Contribution on ${selectedDate}` : `Contribution in ${monthDisplayLabel}`}
            </h2>

            {/* Donut Chart Visualization */}
            <div className="flex items-center justify-center my-6">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke="#e8f0ec"
                    strokeWidth={strokeWidth}
                  />
                  {channelTotal > 0 && (
                    <>
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="transparent"
                        stroke="#14563f"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${inhouseDash} ${circumference}`}
                        strokeDashoffset="0"
                        className="transition-all duration-700"
                      />
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        fill="transparent"
                        stroke="#2dd4bf"
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${msaDash} ${circumference}`}
                        strokeDashoffset={`-${inhouseDash}`}
                        className="transition-all duration-700"
                      />
                    </>
                  )}
                </svg>

                {/* Donut Center */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-[#0f2f23] tracking-tight">
                    {channelTotal.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-semibold text-[#668b7d] uppercase tracking-wider">
                    {dateMode === 'specific_date' ? 'ON DATE' : 'IN MONTH'}
                  </span>
                </div>
              </div>
            </div>

            {/* Legend & Breakdown */}
            <div className="space-y-2.5 pt-2 border-t border-[#edf3f0]">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#14563f]"></span>
                  <span className="font-semibold text-[#184233]">INHOUSE</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#668b7d] font-medium">{inhouseCount}</span>
                  <span className="font-bold text-[#143d2f] w-10 text-right">{inhousePct}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2dd4bf]"></span>
                  <span className="font-semibold text-[#184233]">MSA</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[#668b7d] font-medium">{msaCount}</span>
                  <span className="font-bold text-[#143d2f] w-10 text-right">{msaPct}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#6d9183] border-t border-[#edf3f0] pt-3 text-center font-mono">
            Formula: <code>COUNTIFS(S:S, &quot;INHOUSE&quot;|&quot;MSA&quot;, AF:AF, date)</code>
          </div>
        </div>
      </div>

      {/* Raw JO ACTIVATED Dynamic Grouping & Counting Engine */}
      <GroupingMatrixView aggregates={metrics} />
    </div>
  );
};
