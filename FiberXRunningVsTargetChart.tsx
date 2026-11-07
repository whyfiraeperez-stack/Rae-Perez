import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingUp, Target, Activity } from 'lucide-react';
import { JORecord, SummarySheetTargets } from '../types';
import {
  getDatesInMonth,
  normalizeDate,
  MONTH_NAMES,
} from '../utils/dateCountingEngine';
import {
  getTargetsForProvince,
  DEFAULT_SUMMARY_TARGETS,
} from '../utils/summaryTargetService';

interface FiberXRunningVsTargetChartProps {
  records: JORecord[];
  selectedYear: number;
  selectedMonth: number; // 0-indexed (e.g. 8 for September)
  selectedProvince: string;
  selectedSliType: string;
  summaryTargets?: SummarySheetTargets;
}

interface DailyPoint {
  dateKey: string;
  displayDate: string;
  dayNumber: number;
  fiberXRunning: number;
  runningTarget: number;
  dayCount: number;
}

/**
 * Normalizes package string to verify if it represents FiberX.
 * Matches: 'FIBERX', 'FiberX', 'fiberx', 'fiber x' (case-insensitive, whitespace-trimmed)
 */
function isFiberXPackage(packageName: string | undefined): boolean {
  if (!packageName) return false;
  const cleaned = packageName.trim().toUpperCase().replace(/\s+/g, '');
  return cleaned.includes('FIBERX');
}

/**
 * Normalizes province matching
 */
function matchProvince(recordProvince: string | undefined, filterProvince: string): boolean {
  if (!filterProvince || filterProvince === 'All districts' || filterProvince === 'ALL') {
    return true;
  }
  const rNorm = (recordProvince || '').trim().toUpperCase();
  const fNorm = filterProvince.trim().toUpperCase();
  return rNorm === fNorm;
}

/**
 * Normalizes SLI Type matching (INHOUSE vs MSA)
 */
function matchSliType(recordSliType: string | undefined, filterSliType: string): boolean {
  if (!filterSliType || filterSliType === 'All' || filterSliType === 'All SLI Types' || filterSliType === 'ALL') {
    return true;
  }
  const rNorm = (recordSliType || '').trim().toUpperCase();
  const fNorm = filterSliType.trim().toUpperCase();
  return rNorm === fNorm;
}

export const FiberXRunningVsTargetChart: React.FC<FiberXRunningVsTargetChartProps> = ({
  records,
  selectedYear,
  selectedMonth,
  selectedProvince,
  selectedSliType,
  summaryTargets,
}) => {
  // 1. Determine Monthly FiberX Target dynamically from SUMMARY sheet
  const monthlyFiberXTarget = useMemo(() => {
    const provTargets = getTargetsForProvince(summaryTargets || DEFAULT_SUMMARY_TARGETS, selectedProvince);
    return provTargets.fiberXTarget;
  }, [summaryTargets, selectedProvince]);

  // 2. Compute calendar days and cumulative FiberX activations vs running target
  const { chartData, totalDaysInMonth, monthShortName, finalRunningCount, completionRate } = useMemo(() => {
    const dates = getDatesInMonth(selectedYear, selectedMonth);
    const totalDays = dates.length;
    const shortMonth = MONTH_NAMES[selectedMonth]?.slice(0, 3) || 'Sep';

    // Pre-filter all records that match FiberX, province, and SLI criteria
    const filteredFiberXRecords = records.filter((r) => {
      // Must be FiberX (Package filter does NOT change chart to SME or BIDA)
      if (!isFiberXPackage(r.packageName)) return false;
      // Must match Province filter
      if (!matchProvince(r.stateOrProvince, selectedProvince)) return false;
      // Must match SLI Type filter
      if (!matchSliType(r.sliType, selectedSliType)) return false;
      return true;
    });

    // Map each day of the month to its count and cumulative running sum
    let cumulative = 0;
    const points: DailyPoint[] = dates.map((dateObj) => {
      const dayNum = dateObj.getDate();
      const displayLabel = `${shortMonth} ${dayNum}`;

      // Count activations on this specific closing date (Column AF)
      const dayActivations = filteredFiberXRecords.filter((r) => {
        const cd = normalizeDate(r.closingDate || r.activationDate);
        if (!cd) return false;
        return (
          cd.getFullYear() === selectedYear &&
          cd.getMonth() === selectedMonth &&
          cd.getDate() === dayNum
        );
      }).length;

      cumulative += dayActivations;

      // Running Target: monthlyFiberXTarget * (dayOfMonth / totalDaysInMonth)
      // The final day of the month must equal the monthly FiberX target from SUMMARY.
      const isFinalDay = dayNum === totalDays;
      const runningTarget = isFinalDay
        ? monthlyFiberXTarget
        : totalDays > 0
        ? Number(((monthlyFiberXTarget * dayNum) / totalDays).toFixed(1))
        : 0;

      return {
        dateKey: dateObj.toISOString(),
        displayDate: displayLabel,
        dayNumber: dayNum,
        fiberXRunning: cumulative,
        runningTarget,
        dayCount: dayActivations,
      };
    });

    const finalCount = points.length > 0 ? points[points.length - 1].fiberXRunning : 0;
    const compRate = monthlyFiberXTarget > 0 ? ((finalCount / monthlyFiberXTarget) * 100).toFixed(1) : '0';

    return {
      chartData: points,
      totalDaysInMonth: totalDays,
      monthShortName: shortMonth,
      finalRunningCount: finalCount,
      completionRate: compRate,
    };
  }, [records, selectedYear, selectedMonth, selectedProvince, selectedSliType, monthlyFiberXTarget]);

  return (
    <div
      id="fiberx-performance-section"
      className="bg-white border border-[#dce7e1] rounded-3xl p-6 lg:p-7 shadow-2xs space-y-6"
    >
      {/* Header with Title and Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#edf3ef] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
              FIBERX PERFORMANCE
            </span>
            <span className="text-xs text-[#597c6f]">
              {selectedProvince !== 'All districts' ? selectedProvince : 'All Districts'}
              {selectedSliType !== 'All' && selectedSliType !== 'All SLI Types' ? ` • ${selectedSliType}` : ''}
            </span>
          </div>
          <h3 className="text-xl font-bold text-[#0e2f22] tracking-tight mt-1.5">
            FiberX Running vs Target
          </h3>
          <p className="text-xs text-[#5d8071] mt-0.5">
            Monthly cumulative FiberX activations compared with the running target.
          </p>
        </div>

        {/* Quick KPI summary badges */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-[#f2f8f4] border border-[#d3e5dc] rounded-2xl px-3.5 py-2">
            <div className="text-[10px] font-bold text-[#55786a] uppercase">Current Running</div>
            <div className="text-base font-black text-[#0f3426] font-sans">
              {finalRunningCount.toLocaleString()}{' '}
              <span className="text-xs font-normal text-[#597b6e]">JOs</span>
            </div>
          </div>

          <div className="bg-[#f0f6f3] border border-[#d3e5dc] rounded-2xl px-3.5 py-2">
            <div className="text-[10px] font-bold text-[#55786a] uppercase">Monthly Target</div>
            <div className="text-base font-black text-[#0f3426] font-sans">
              {monthlyFiberXTarget.toLocaleString()}{' '}
              <span className="text-xs font-semibold text-emerald-700">({completionRate}%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Canvas Container */}
      <div className="w-full h-80 sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 20, left: 0, bottom: 6 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e8f0eb" vertical={false} />
            <XAxis
              dataKey="displayDate"
              tickLine={false}
              axisLine={{ stroke: '#d3e4db' }}
              tick={{ fill: '#55786b', fontSize: 11 }}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={{ stroke: '#d3e4db' }}
              tick={{ fill: '#55786b', fontSize: 11 }}
              tickFormatter={(v: number) => Math.round(v).toLocaleString()}
              label={{
                value: 'Activated JOs',
                angle: -90,
                position: 'insideLeft',
                offset: 14,
                fill: '#55786b',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const dataPoint = payload[0].payload as DailyPoint;
                  return (
                    <div className="bg-white/95 backdrop-blur-xs border border-[#cfe2d7] rounded-xl p-3 shadow-md text-xs space-y-1.5 min-w-[140px]">
                      <div className="font-bold text-[#0e2f22] border-b border-[#e6eee9] pb-1">
                        {label}
                      </div>
                      <div className="flex items-center justify-between gap-3 text-emerald-900 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                          <span>FiberX Running:</span>
                        </div>
                        <span className="font-mono font-bold text-sm">
                          {dataPoint.fiberXRunning.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-slate-700 font-medium">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-1 rounded-sm bg-slate-500"></span>
                          <span>FiberX Running Target:</span>
                        </div>
                        <span className="font-mono font-semibold">
                          {dataPoint.runningTarget.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: '12px' }}
              content={() => (
                <div className="flex items-center justify-end gap-5 text-xs font-semibold text-[#325a4c]">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-1 rounded-full bg-emerald-600 inline-block"></span>
                    <span>FiberX Running</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-500 inline-block"></span>
                    <span className="text-slate-600">FiberX Running Target</span>
                  </div>
                </div>
              )}
            />
            {/* 1. FiberX Running Series (Solid Emerald) */}
            <Line
              type="monotone"
              dataKey="fiberXRunning"
              name="FiberX Running"
              stroke="#059669"
              strokeWidth={3}
              dot={{ r: 2.5, fill: '#059669', stroke: '#ffffff', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: '#047857', stroke: '#ffffff', strokeWidth: 2 }}
            />
            {/* 2. Target Series (Dashed Slate/Muted Line) */}
            <Line
              type="monotone"
              dataKey="runningTarget"
              name="FiberX Running Target"
              stroke="#64748b"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: '#475569', stroke: '#ffffff', strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
