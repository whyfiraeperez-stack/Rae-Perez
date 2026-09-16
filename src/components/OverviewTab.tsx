import React, { useState, useMemo } from 'react';
import {
  Wifi,
  ChevronDown,
  Layers,
  CheckCircle2,
  DollarSign,
  Users,
  RotateCcw,
  Calendar,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { DashboardMetrics, JORecord } from '../types';
import {
  DateFilterMode,
  formatMonthDisplay,
  countActivatedForDate,
  countActivatedForMonth,
  sumAmountForDate,
  sumAmountForMonth,
} from '../utils/dateCountingEngine';
import { FiberXRunningVsTargetChart } from './FiberXRunningVsTargetChart';
import { SummaryTables } from './SummaryTables';
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
  // Core Interactive Filters mapped to JO ACTIVATED data:
  // Province (Column G: STATEORPROVINCE) -> default 'All districts'
  // SLI Type (Column S: SLI TYPE) -> default 'All'
  // Package (Column AC: PACKAGE) -> default 'All Packages'
  const [selectedProvince, setSelectedProvince] = useState<string>('All districts');
  const [selectedSliType, setSelectedSliType] = useState<string>('All');
  const [selectedPackage, setSelectedPackage] = useState<string>('All Packages');

  // Month label display (e.g. "September 2026")
  const monthDisplayLabel = useMemo(() => {
    return formatMonthDisplay(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Reset filters handler
  const handleResetFilters = () => {
    setSelectedProvince('All districts');
    setSelectedSliType('All');
    setSelectedPackage('All Packages');
    onChangeDateMode('entire_month');
  };

  // -------------------------------------------------------------
  // HERO CARD 1: ACTIVATED JO COUNT
  // Dynamically calculated from raw records
  // -------------------------------------------------------------
  const activatedCount = useMemo(() => {
    if (dateMode === 'specific_date') {
      return countActivatedForDate(
        records,
        selectedDate,
        selectedProvince,
        selectedSliType,
        selectedPackage
      );
    } else {
      return countActivatedForMonth(
        records,
        selectedYear,
        selectedMonth,
        selectedProvince,
        selectedSliType,
        selectedPackage
      );
    }
  }, [
    records,
    dateMode,
    selectedDate,
    selectedYear,
    selectedMonth,
    selectedProvince,
    selectedSliType,
    selectedPackage,
  ]);

  // -------------------------------------------------------------
  // HERO CARD 2: TOTAL MRC (Monthly Recurring Charge)
  // Dynamically calculated sum of Column AE (MRC)
  // -------------------------------------------------------------
  const totalMrc = useMemo(() => {
    if (dateMode === 'specific_date') {
      return sumAmountForDate(
        records,
        selectedDate,
        selectedProvince,
        selectedSliType,
        selectedPackage
      );
    } else {
      return sumAmountForMonth(
        records,
        selectedYear,
        selectedMonth,
        selectedProvince,
        selectedSliType,
        selectedPackage
      );
    }
  }, [
    records,
    dateMode,
    selectedDate,
    selectedYear,
    selectedMonth,
    selectedProvince,
    selectedSliType,
    selectedPackage,
  ]);

  // -------------------------------------------------------------
  // PACKAGE CARDS (FiberX, SME, BIDA)
  // Respects selected date/month, selected province, and selected SLI
  // -------------------------------------------------------------
  const packageCards = useMemo(() => {
    const calcPkg = (pkgKey: string) => {
      const count =
        dateMode === 'specific_date'
          ? countActivatedForDate(
              records,
              selectedDate,
              selectedProvince,
              selectedSliType,
              pkgKey
            )
          : countActivatedForMonth(
              records,
              selectedYear,
              selectedMonth,
              selectedProvince,
              selectedSliType,
              pkgKey
            );

      const mrc =
        dateMode === 'specific_date'
          ? sumAmountForDate(
              records,
              selectedDate,
              selectedProvince,
              selectedSliType,
              pkgKey
            )
          : sumAmountForMonth(
              records,
              selectedYear,
              selectedMonth,
              selectedProvince,
              selectedSliType,
              pkgKey
            );

      return { count, mrc };
    };

    return {
      fiberx: calcPkg('FIBERX'),
      sme: calcPkg('SME'),
      bida: calcPkg('BIDA'),
    };
  }, [
    records,
    dateMode,
    selectedDate,
    selectedYear,
    selectedMonth,
    selectedProvince,
    selectedSliType,
  ]);

  // -------------------------------------------------------------
  // SLI CARDS (INHOUSE & MSA)
  // Respects selected date/month, selected province, and selected package
  // -------------------------------------------------------------
  const sliCards = useMemo(() => {
    const calcSli = (sliKey: string) => {
      const count =
        dateMode === 'specific_date'
          ? countActivatedForDate(
              records,
              selectedDate,
              selectedProvince,
              sliKey,
              selectedPackage
            )
          : countActivatedForMonth(
              records,
              selectedYear,
              selectedMonth,
              selectedProvince,
              sliKey,
              selectedPackage
            );

      const mrc =
        dateMode === 'specific_date'
          ? sumAmountForDate(
              records,
              selectedDate,
              selectedProvince,
              sliKey,
              selectedPackage
            )
          : sumAmountForMonth(
              records,
              selectedYear,
              selectedMonth,
              selectedProvince,
              sliKey,
              selectedPackage
            );

      return { count, mrc };
    };

    const inhouse = calcSli('INHOUSE');
    const msa = calcSli('MSA');
    const total = inhouse.count + msa.count;
    const inhousePct = total > 0 ? ((inhouse.count / total) * 100).toFixed(1) : '0';
    const msaPct = total > 0 ? ((msa.count / total) * 100).toFixed(1) : '0';

    return { inhouse, msa, total, inhousePct, msaPct };
  }, [
    records,
    dateMode,
    selectedDate,
    selectedYear,
    selectedMonth,
    selectedProvince,
    selectedPackage,
  ]);

  // Active filter label for hero card subtitle
  const activeFiltersLabel = useMemo(() => {
    const parts: string[] = [];
    if (selectedProvince !== 'All districts') parts.push(selectedProvince);
    if (selectedSliType !== 'All') parts.push(selectedSliType);
    if (selectedPackage !== 'All Packages') parts.push(selectedPackage);
    if (parts.length === 0) return null;
    return parts.join(' • ');
  }, [selectedProvince, selectedSliType, selectedPackage]);

  return (
    <div id="overview-view" className="space-y-6">
      {/* Clean Business Filter Bar */}
      <div
        id="filter-bar"
        className="bg-white border border-[#dce7e1] rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs"
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Live Data Badge */}
          <div className="flex items-center gap-2 mr-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-[#144937]">Dynamic Sheet Sync</span>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#587a6d]">Month:</span>
            <div className="relative">
              <select
                id="filter-entire-month"
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(e) => {
                  const [y, m] = e.target.value.split('-').map(Number);
                  onChangeMonth(y, m);
                }}
                aria-label="Select month"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-bold rounded-xl pl-3 pr-7 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                {availableMonths.map((m) => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Province Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#587a6d]">Province:</span>
            <div className="relative">
              <select
                id="filter-province"
                value={selectedProvince}
                onChange={(e) => setSelectedProvince(e.target.value)}
                aria-label="Filter province"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-semibold rounded-xl pl-3 pr-7 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="All districts">All districts</option>
                <option value="Albay">ALBAY</option>
                <option value="Masbate">MASBATE</option>
                <option value="Sorsogon">SORSOGON</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* SLI Type Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#587a6d]">SLI Type:</span>
            <div className="relative">
              <select
                id="filter-sli-type"
                value={selectedSliType}
                onChange={(e) => setSelectedSliType(e.target.value)}
                aria-label="Filter SLI Type"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-semibold rounded-xl pl-3 pr-7 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="All">All SLI Types</option>
                <option value="INHOUSE">INHOUSE</option>
                <option value="MSA">MSA</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Package Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#587a6d]">Package:</span>
            <div className="relative">
              <select
                id="filter-package"
                value={selectedPackage}
                onChange={(e) => setSelectedPackage(e.target.value)}
                aria-label="Filter package"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-semibold rounded-xl pl-3 pr-7 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="All Packages">All Packages</option>
                <option value="FiberX">FIBERX</option>
                <option value="SME">SME</option>
                <option value="BIDA">BIDA</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Action Controls: Reset */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetFilters}
            title="Reset all filters to defaults"
            className="flex items-center gap-1 text-xs text-[#527567] hover:text-[#0e2d21] bg-[#f0f6f2] hover:bg-[#e4eee8] px-3 py-1.5 rounded-xl transition-colors cursor-pointer font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Hero Metric Cards Grid: Activated JO Count + Total MRC */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* HERO CARD 1: ACTIVATED JO COUNT */}
        <div
          id="card-activated-jo-count"
          className="bg-[#144c38] text-white rounded-3xl p-7 shadow-md flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#1f6a4e] rounded-full blur-3xl opacity-30 pointer-events-none"></div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold">
                <div className="w-6 h-6 rounded-full bg-[#1e6147] flex items-center justify-center">
                  <Wifi className="w-3.5 h-3.5 text-emerald-300" />
                </div>
                <span className="tracking-wider">ACTIVATED JO COUNT</span>
              </div>

              <div className="bg-[#0e3b2b] border border-[#276c52] px-3 py-1 rounded-full text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>{monthDisplayLabel}</span>
              </div>
            </div>

            <div className="text-6xl font-black tracking-tight text-white font-sans mt-2">
              {activatedCount.toLocaleString()}
            </div>

            <div className="text-xs text-emerald-200/90 font-medium mt-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                {activeFiltersLabel
                  ? `Filtered: ${activeFiltersLabel}`
                  : `Total activated job orders for ${monthDisplayLabel}`}
              </span>
            </div>
          </div>
        </div>

        {/* HERO CARD 2: TOTAL MRC */}
        <div
          id="card-total-mrc"
          className="bg-white border border-[#dce7e1] rounded-3xl p-7 shadow-xs flex flex-col justify-between"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 text-[#4e7465] text-xs font-semibold uppercase tracking-wider">
                <div className="w-6 h-6 rounded-full bg-[#dcf2e6] flex items-center justify-center text-[#144c37]">
                  <DollarSign className="w-3.5 h-3.5" />
                </div>
                <span>TOTAL MRC</span>
              </div>

              <div className="bg-[#f0f6f3] border border-[#d2e3da] px-3 py-1 rounded-full text-[11px] font-semibold text-[#144937]">
                Monthly Recurring Charge
              </div>
            </div>

            <div className="text-5xl font-black tracking-tight text-[#0f3124] font-sans mt-2">
              ₱{totalMrc.toLocaleString()}
            </div>

            <div className="text-xs text-[#5d8071] font-medium mt-3 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Consolidated recurring revenue from all activated subscriptions in scope
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Package Breakdown Cards (FiberX, SME, BIDA) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-[#0e2f22] tracking-wider uppercase">
            PACKAGE BREAKDOWN
          </h2>
          <span className="text-xs text-[#688a7c]">
            (Respecting active province and SLI filters)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* FiberX Card */}
          <div
            id="card-package-fiberx"
            className="bg-white border border-[#dce7e1] rounded-2xl p-5 shadow-2xs space-y-2 hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                FiberX Activated
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Core Fiber
              </span>
            </div>
            <div className="text-3xl font-black text-[#0f3023]">
              {packageCards.fiberx.count.toLocaleString()}
            </div>
            <div className="text-xs text-[#527768] font-medium flex items-center justify-between pt-1 border-t border-[#f0f5f2]">
              <span>Total MRC:</span>
              <span className="font-mono font-bold text-emerald-900">
                ₱{packageCards.fiberx.mrc.toLocaleString()}
              </span>
            </div>
          </div>

          {/* SME Card */}
          <div
            id="card-package-sme"
            className="bg-white border border-[#dce7e1] rounded-2xl p-5 shadow-2xs space-y-2 hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-800 uppercase tracking-wide">
                SME Activated
              </span>
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                Enterprise
              </span>
            </div>
            <div className="text-3xl font-black text-[#0f3023]">
              {packageCards.sme.count.toLocaleString()}
            </div>
            <div className="text-xs text-[#527768] font-medium flex items-center justify-between pt-1 border-t border-[#f0f5f2]">
              <span>Total MRC:</span>
              <span className="font-mono font-bold text-emerald-900">
                ₱{packageCards.sme.mrc.toLocaleString()}
              </span>
            </div>
          </div>

          {/* BIDA Card */}
          <div
            id="card-package-bida"
            className="bg-white border border-[#dce7e1] rounded-2xl p-5 shadow-2xs space-y-2 hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-800 uppercase tracking-wide">
                BIDA Activated
              </span>
              <span className="text-[11px] font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                Affordable
              </span>
            </div>
            <div className="text-3xl font-black text-[#0f3023]">
              {packageCards.bida.count.toLocaleString()}
            </div>
            <div className="text-xs text-[#527768] font-medium flex items-center justify-between pt-1 border-t border-[#f0f5f2]">
              <span>Total MRC:</span>
              <span className="font-mono font-bold text-emerald-900">
                ₱{packageCards.bida.mrc.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SLI Channel Breakdown Cards (INHOUSE & MSA) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-bold text-[#0e2f22] tracking-wider uppercase">
            SLI CHANNEL BREAKDOWN
          </h2>
          <span className="text-xs text-[#688a7c]">
            (Respecting active province and package filters)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* INHOUSE Card */}
          <div
            id="card-sli-inhouse"
            className="bg-white border border-[#dce7e1] rounded-2xl p-5 shadow-2xs space-y-2 hover:border-emerald-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                <span className="text-xs font-bold text-[#0f3023] uppercase tracking-wide">
                  INHOUSE Activated
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {sliCards.inhousePct}% share
              </span>
            </div>
            <div className="text-3xl font-black text-[#0f3023]">
              {sliCards.inhouse.count.toLocaleString()}
            </div>
            <div className="text-xs text-[#527768] font-medium flex items-center justify-between pt-1 border-t border-[#f0f5f2]">
              <span>Total MRC:</span>
              <span className="font-mono font-bold text-emerald-900">
                ₱{sliCards.inhouse.mrc.toLocaleString()}
              </span>
            </div>
          </div>

          {/* MSA Card */}
          <div
            id="card-sli-msa"
            className="bg-white border border-[#dce7e1] rounded-2xl p-5 shadow-2xs space-y-2 hover:border-teal-400 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                <span className="text-xs font-bold text-[#0f3023] uppercase tracking-wide">
                  MSA Activated
                </span>
              </div>
              <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                {sliCards.msaPct}% share
              </span>
            </div>
            <div className="text-3xl font-black text-[#0f3023]">
              {sliCards.msa.count.toLocaleString()}
            </div>
            <div className="text-xs text-[#527768] font-medium flex items-center justify-between pt-1 border-t border-[#f0f5f2]">
              <span>Total MRC:</span>
              <span className="font-mono font-bold text-teal-900">
                ₱{sliCards.msa.mrc.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FIBERX RUNNING VS TARGET CHART
          (Replaces the old Closed On Breakdown Column AF table) */}
      <FiberXRunningVsTargetChart
        records={records}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        selectedProvince={selectedProvince}
        selectedSliType={selectedSliType}
      />

      {/* Summary Tables: MRC Package Summary & Province Summary */}
      <SummaryTables
        records={records}
        dateMode={dateMode}
        selectedDate={selectedDate}
        selectedYear={selectedYear}
        selectedMonth={selectedMonth}
        selectedProvince={selectedProvince}
        selectedSliType={selectedSliType}
        selectedPackage={selectedPackage}
      />

      {/* Raw JO ACTIVATED Dynamic Grouping & Counting Engine */}
      <GroupingMatrixView aggregates={metrics} />
    </div>
  );
};
