import React, { useState } from 'react';
import { Wifi, Target, TrendingUp, ArrowUpRight, ChevronDown, CheckCircle } from 'lucide-react';
import { Province, PackageCategory } from '../types';
import { SummaryAggregates } from '../utils/calculations';

interface OverviewTabProps {
  metrics: SummaryAggregates;
  onNavigateToVendors: () => void;
  onNavigateToRawData: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  metrics,
  onNavigateToVendors,
  onNavigateToRawData,
}) => {
  const [selectedTerritory, setSelectedTerritory] = useState<string>('All districts');
  const [selectedMeasure, setSelectedMeasure] = useState<string>('FiberX');

  // Filter calculations dynamically based on selected measure and territory
  let runningActual = metrics.fiberXCount;
  let runningTarget = metrics.fiberXTarget;
  let runningUnit = '';

  if (selectedMeasure === 'SME') {
    runningActual = metrics.smeAmountVatInc;
    runningTarget = metrics.smeTargetAmount;
    runningUnit = '₱';
  } else if (selectedMeasure === 'BIDA') {
    runningActual = metrics.bidaCount;
    runningTarget = metrics.bidaTarget;
  } else if (selectedMeasure === 'S2S') {
    runningActual = metrics.s2sCount;
    runningTarget = metrics.s2sTarget;
  } else if (selectedMeasure === 'Total') {
    runningActual = metrics.totalRecords;
    runningTarget = metrics.fiberXTarget + metrics.bidaTarget;
  }

  // Adjust by selected territory if filtered
  if (selectedTerritory !== 'All districts') {
    const prov = selectedTerritory.toUpperCase() as Province;
    const b = metrics.territoryBreakdowns[prov];
    if (b) {
      if (selectedMeasure === 'FiberX') {
        runningActual = b.totalFiberX;
        runningTarget = b.fiberXTarget;
      } else if (selectedMeasure === 'SME') {
        runningActual = b.totalSmeAmount;
        runningTarget = b.smeTargetAmount;
      } else if (selectedMeasure === 'BIDA') {
        runningActual = b.totalBida;
        runningTarget = b.bidaTarget;
      } else if (selectedMeasure === 'S2S') {
        runningActual = b.totalS2S;
        runningTarget = b.s2sTarget;
      }
    }
  }

  const progressPct = runningTarget > 0 ? (runningActual / runningTarget) * 100 : 0;
  const reportingDistrictsCount = selectedTerritory === 'All districts' ? 3 : 1;

  // Channel Mix numbers
  let inhouseCount = metrics.inhouseFiberX;
  let msaCount = metrics.msaFiberX;
  let channelTotal = inhouseCount + msaCount;

  if (selectedMeasure === 'SME') {
    inhouseCount = metrics.inhouseSmeCount;
    msaCount = metrics.msaSmeCount;
    channelTotal = inhouseCount + msaCount;
  } else if (selectedMeasure === 'BIDA') {
    inhouseCount = metrics.inhouseBidaCount;
    msaCount = metrics.msaBidaCount;
    channelTotal = inhouseCount + msaCount;
  } else if (selectedMeasure === 'Total') {
    inhouseCount = metrics.inhouseTotal;
    msaCount = metrics.msaTotal;
    channelTotal = metrics.totalRecords;
  }

  const inhousePct = channelTotal > 0 ? Math.round((inhouseCount / channelTotal) * 100) : 0;
  const msaPct = channelTotal > 0 ? 100 - inhousePct : 0;

  // Donut SVG parameters
  const strokeWidth = 14;
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const inhouseDash = (circumference * inhousePct) / 100;
  const msaDash = circumference - inhouseDash;

  return (
    <div id="overview-view" className="space-y-6">
      {/* Filter / Live View Bar */}
      <div
        id="filter-bar"
        className="bg-white border border-[#dce7e1] rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-2xs"
      >
        <div className="flex flex-wrap items-center gap-5">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-[#144937]">Live view</span>
          </div>

          {/* Territory Dropdown */}
          <div className="flex items-center gap-2">
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

          {/* Measure Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#587a6d]">Measure</span>
            <div className="relative">
              <select
                id="filter-measure"
                value={selectedMeasure}
                onChange={(e) => setSelectedMeasure(e.target.value)}
                aria-label="Filter measure"
                className="appearance-none bg-[#f4f9f6] border border-[#d2e3da] text-[#123d2e] text-xs font-semibold rounded-xl pl-3 pr-8 py-1.5 focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="FiberX">FiberX</option>
                <option value="SME">SME</option>
                <option value="BIDA">BIDA</option>
                <option value="S2S">S2S</option>
                <option value="Total">Total</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#587a6d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-2 text-xs font-medium text-[#587a6d]">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Updated daily</span>
        </div>
      </div>

      {/* Main Top Cards Grid (Left Hero Card + Right Portfolio Snapshot) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Hero Card - Deep Forest Green */}
        <div
          id="hero-metric-card"
          className="lg:col-span-7 bg-[#144c37] text-white rounded-3xl p-7 shadow-md flex flex-col justify-between relative overflow-hidden"
        >
          {/* Subtle decorative background glow */}
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-[#1f6a4e] rounded-full blur-3xl opacity-30 pointer-events-none"></div>

          <div>
            {/* Card header */}
            <div className="flex items-center gap-2 text-emerald-200 text-xs font-semibold mb-6">
              <div className="w-6 h-6 rounded-full bg-[#1e6147] flex items-center justify-center">
                <Wifi className="w-3.5 h-3.5 text-emerald-300" />
              </div>
              <span>{selectedMeasure} MTD vs target</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              {/* Giant Number */}
              <div>
                <div className="text-6xl font-extrabold tracking-tight text-white font-sans">
                  {runningUnit}
                  {runningActual.toLocaleString()}
                </div>
                <div className="text-xs text-emerald-200/80 font-medium mt-1">
                  running total of <strong className="text-white font-bold">{runningUnit}{runningTarget.toLocaleString()}</strong>
                </div>
              </div>

              {/* Sub-card: Current achievement */}
              <div className="bg-[#113f2e]/90 border border-[#276b51] rounded-2xl p-4 min-w-[160px] text-center shadow-inner">
                <div className="w-7 h-7 mx-auto rounded-full bg-[#1b5d43] flex items-center justify-center mb-1.5">
                  <Target className="w-4 h-4 text-emerald-300" />
                </div>
                <div className="text-[11px] font-semibold text-emerald-200 uppercase tracking-wide">
                  Current achievement
                </div>
                <div className="text-2xl font-black text-white mt-0.5">
                  {progressPct.toFixed(2)}%
                </div>
                <div className="text-[11px] text-emerald-300 font-semibold flex items-center justify-center gap-1 mt-1">
                  <span>↗ on track</span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Slider Track */}
          <div className="mt-8 pt-4">
            <div className="relative flex items-center">
              {/* Slider Track Background */}
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
                {progressPct.toFixed(1)}% achieved
              </span>
              <span>{runningUnit}{runningTarget.toLocaleString()}</span>
            </div>

            {/* COUNTIFS verification notice */}
            {selectedMeasure === 'FiberX' && (
              <div className="mt-3 pt-2.5 border-t border-[#1e6147] flex items-center justify-between text-[11px] text-emerald-200/90 font-mono">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  COUNTIFS: 149 (Albay) + 59 (Sorsogon) + 70 (Masbate)
                </span>
                <span className="font-bold text-white bg-[#0e3b2a] px-2 py-0.5 rounded border border-[#237053]">
                  = 278 FiberX
                </span>
              </div>
            )}
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
              Bicol territory
            </h2>
            <p className="text-xs text-[#688a7e] font-normal mt-0.5">
              Across {reportingDistrictsCount} reporting district{reportingDistrictsCount > 1 ? 's' : ''}
            </p>
          </div>

          {/* 3 Metric Cards side by side */}
          <div className="grid grid-cols-3 gap-3 my-4">
            {/* Running MTD */}
            <div className="bg-[#f7faf8] border border-[#e2ece6] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="w-6 h-6 rounded-full bg-[#dcf2e6] flex items-center justify-center text-[#144c37] mb-2">
                <Wifi className="w-3 h-3" />
              </div>
              <div className="text-[10px] font-semibold text-[#5a7c6f]">
                Running MTD
              </div>
              <div className="text-xl font-bold text-[#0e2c20] mt-0.5">
                {runningUnit}{runningActual.toLocaleString()}
              </div>
              <div className="text-[10px] text-[#719385] mt-1">
                activated to date
              </div>
            </div>

            {/* Target */}
            <div className="bg-[#f7faf8] border border-[#e2ece6] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="w-6 h-6 rounded-full bg-[#dcf2e6] flex items-center justify-center text-[#144c37] mb-2">
                <Target className="w-3 h-3" />
              </div>
              <div className="text-[10px] font-semibold text-[#5a7c6f]">
                Target
              </div>
              <div className="text-xl font-bold text-[#0e2c20] mt-0.5">
                {runningUnit}{runningTarget.toLocaleString()}
              </div>
              <div className="text-[10px] text-[#719385] mt-1">
                monthly goal
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
                {progressPct.toFixed(2)}%
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
            <span>Cycle: Sep 1–30, 2026 (Day 14)</span>
            <span className="font-semibold text-emerald-700">Pace: {metrics.fiberXRunrate} est.</span>
          </div>
        </div>
      </div>

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
                  Progress by territory
                </h2>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs font-semibold text-[#547366]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#18533e]"></span>
                  <span>achieved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#d6e3dc]"></span>
                  <span>remaining</span>
                </div>
              </div>
            </div>

            {/* Territory Bars */}
            <div className="space-y-4 my-6">
              {(['ALBAY', 'SORSOGON', 'MASBATE'] as Province[]).map((prov) => {
                const b = metrics.territoryBreakdowns[prov];
                let actual = b.totalFiberX;
                let target = b.fiberXTarget;
                let pct = b.fiberXShare;

                if (selectedMeasure === 'SME') {
                  actual = b.totalSmeAmount;
                  target = b.smeTargetAmount;
                  pct = b.smeShare;
                } else if (selectedMeasure === 'BIDA') {
                  actual = b.totalBida;
                  target = b.bidaTarget;
                  pct = b.bidaShare;
                }

                const displayName =
                  prov === 'ALBAY' ? 'Albay' : prov === 'SORSOGON' ? 'Sorsogon' : 'Masbate';

                return (
                  <div key={prov} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#143e30]">{displayName}</span>
                        <span className="text-[#6d8d80] text-[11px]">
                          ({actual.toLocaleString()} of {target.toLocaleString()})
                        </span>
                      </div>
                      <span className="font-bold text-[#143e30]">{pct.toFixed(1)}%</span>
                    </div>

                    {/* Bar visualization */}
                    <div className="w-full h-3 bg-[#e8f0ec] rounded-full overflow-hidden flex">
                      <div
                        className="bg-[#18533e] h-full rounded-l-full transition-all duration-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      ></div>
                      <div
                        className="bg-[#d6e3dc] h-full"
                        style={{ width: `${Math.max(0, 100 - pct)}%` }}
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
              Showing target attainment for {selectedMeasure}
            </span>
            <button
              onClick={onNavigateToVendors}
              className="font-bold text-[#144c38] hover:text-[#0b3325] flex items-center gap-1 hover:underline transition-colors"
            >
              <span>View vendor contribution</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
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
              MTD contribution
            </h2>

            {/* Donut Chart Visualization */}
            <div className="flex items-center justify-center my-6">
              <div className="relative w-44 h-44 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  {/* Background Circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke="#e8f0ec"
                    strokeWidth={strokeWidth}
                  />
                  {/* Inhouse Segment */}
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke="#14563f"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${inhouseDash} ${circumference}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                  />
                  {/* MSA Segment */}
                  <circle
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke="#2dd4bf"
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${msaDash} ${circumference}`}
                    strokeDashoffset={-inhouseDash}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Donut Center */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-extrabold text-[#0f2f23] tracking-tight">
                    {channelTotal.toLocaleString()}
                  </span>
                  <span className="text-[11px] font-semibold text-[#668b7d] uppercase tracking-wider">
                    MTD
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

          <div className="text-[11px] text-[#6d9183] border-t border-[#edf3f0] pt-3 text-center">
            Formula: <code className="bg-[#f0f6f3] px-1.5 py-0.5 rounded text-emerald-800 font-mono">COUNTIFS(SLI_TYPE, &quot;INHOUSE&quot;|&quot;MSA&quot;)</code>
          </div>
        </div>
      </div>
    </div>
  );
};
