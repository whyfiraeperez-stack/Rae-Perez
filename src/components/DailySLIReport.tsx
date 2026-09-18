import React, { useMemo } from 'react';
import { ParsedJO, Targets, OperationalStatus } from '../types';

interface DailySLIReportProps {
  reportDate: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  allMonthRows: ParsedJO[]; // Unfiltered records for the month (ALMASOR scope)
  overallTargets: Targets;
  operationalStatus?: OperationalStatus;
  latestDataDate?: string; // e.g. "2026-09-18"
}

function formatNumber(val: number): string {
  if (!Number.isFinite(val) || isNaN(val)) return '0';
  return Math.round(val).toLocaleString('en-PH');
}

function formatVal(val: number, isMoney: boolean): string {
  if (!Number.isFinite(val) || isNaN(val)) return isMoney ? '₱0' : '0';
  const rounded = Math.round(val);
  const formatted = rounded.toLocaleString('en-PH');
  return isMoney ? `₱${formatted}` : formatted;
}

function formatPercent(val: number): string {
  if (!Number.isFinite(val) || isNaN(val) || val < 0) return '0%';
  return `${Math.round(val)}%`;
}

export const DailySLIReport: React.FC<DailySLIReportProps> = ({
  reportDate,
  monthKey,
  allMonthRows,
  overallTargets,
  operationalStatus,
  latestDataDate = '2026-09-18',
}) => {
  // Parse report date and format header "As of:"
  const {
    year,
    monthNum,
    dayNum,
    daysInMonth,
    isTodayOrLatest,
    asOfDisplay,
  } = useMemo(() => {
    const [y, m, d] = reportDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dim = new Date(y, m, 0).getDate();

    const formattedDate = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }); // e.g. "18 Sep 2026"

    const isToday = reportDate >= latestDataDate;

    let asOf = `As of: ${formattedDate}`;
    if (isToday) {
      if (operationalStatus?.asOfText) {
        asOf = `As of: ${operationalStatus.asOfText}`;
      } else {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        asOf = `As of: ${formattedDate} ${timeStr}`;
      }
    }

    return {
      year: y,
      monthNum: m,
      dayNum: d,
      daysInMonth: dim,
      isTodayOrLatest: isToday,
      asOfDisplay: asOf,
    };
  }, [reportDate, latestDataDate, operationalStatus]);

  // Yesterday date string
  const yesterdayDate = useMemo(() => {
    const d = new Date(year, monthNum - 1, dayNum);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [year, monthNum, dayNum]);

  // Daily activations: FIBERX Yesterday & Today (unique JO number)
  const { fiberXYesterday, fiberXToday } = useMemo(() => {
    let yesterdayCount = 0;
    let todayCount = 0;

    for (const r of allMonthRows) {
      if (r.package !== 'FIBERX') continue;
      const rYear = r.closingDate.getFullYear();
      const rMonth = String(r.closingDate.getMonth() + 1).padStart(2, '0');
      const rDay = String(r.closingDate.getDate()).padStart(2, '0');
      const rDateStr = `${rYear}-${rMonth}-${rDay}`;

      if (rDateStr === yesterdayDate) {
        yesterdayCount++;
      } else if (rDateStr === reportDate) {
        todayCount++;
      }
    }

    return {
      fiberXYesterday: yesterdayCount,
      fiberXToday: todayCount,
    };
  }, [allMonthRows, yesterdayDate, reportDate]);

  // MTD actuals up to reportDate cutoff (first day of month to reportDate inclusive)
  const mtdData = useMemo(() => {
    const mtdRows = allMonthRows.filter((r) => {
      const rYear = r.closingDate.getFullYear();
      const rMonth = r.closingDate.getMonth() + 1;
      const rDay = r.closingDate.getDate();
      return rYear === year && rMonth === monthNum && rDay <= dayNum;
    });

    let fiberXCount = 0;
    let smeVatIncSum = 0;
    let smeVatExSum = 0;
    let bidaCount = 0;
    let s2sCount = 0;

    for (const r of mtdRows) {
      if (r.package === 'FIBERX') {
        fiberXCount++;
      } else if (r.package === 'SME') {
        smeVatIncSum += r.mrc || 0;
        smeVatExSum += r.mrcVatEx !== undefined ? r.mrcVatEx : (r.mrc || 0) / 1.12;
      } else if (r.package === 'BIDA') {
        bidaCount++;
      } else if (r.package === 'S2S') {
        s2sCount++;
      }
    }

    return {
      fiberX: fiberXCount,
      smeVatInc: Math.round(smeVatIncSum),
      smeVatEx: Math.round(smeVatExSum),
      bida: bidaCount,
      s2s: s2sCount,
    };
  }, [allMonthRows, year, monthNum, dayNum]);

  // Targets
  const targets = useMemo(() => ({
    fiberX: overallTargets.fiberX || 859,
    sme: overallTargets.sme || 136508,
    bida: overallTargets.bida || 113,
    s2s: overallTargets.s2s || 782,
  }), [overallTargets]);

  // Runrate calculations: (actual / elapsedDays) * daysInMonth
  const runrates = useMemo(() => {
    const elapsedDays = Math.max(dayNum, 1);
    const factor = daysInMonth / elapsedDays;

    const fiberXRunrate = Math.round(mtdData.fiberX * factor);
    const smeVatIncRunrate = Math.round(mtdData.smeVatInc * factor);
    const smeVatExRunrate = Math.round(mtdData.smeVatEx * factor);
    const bidaRunrate = Math.round(mtdData.bida * factor);
    const s2sRunrate = Math.round(mtdData.s2s * factor);

    return {
      fiberX: fiberXRunrate,
      fiberXProgress: targets.fiberX > 0 ? (fiberXRunrate / targets.fiberX) * 100 : 0,
      smeVatInc: smeVatIncRunrate,
      smeVatIncProgress: targets.sme > 0 ? (smeVatIncRunrate / targets.sme) * 100 : 0,
      smeVatEx: smeVatExRunrate,
      smeVatExProgress: targets.sme > 0 ? (smeVatExRunrate / targets.sme) * 100 : 0,
      bida: bidaRunrate,
      bidaProgress: targets.bida > 0 ? (bidaRunrate / targets.bida) * 100 : 0,
      s2s: s2sRunrate,
      s2sProgress: targets.s2s > 0 ? (s2sRunrate / targets.s2s) * 100 : 0,
    };
  }, [dayNum, daysInMonth, mtdData, targets]);

  // MTD progress percentages
  const mtdProgress = useMemo(() => ({
    fiberX: targets.fiberX > 0 ? (mtdData.fiberX / targets.fiberX) * 100 : 0,
    smeVatInc: targets.sme > 0 ? (mtdData.smeVatInc / targets.sme) * 100 : 0,
    smeVatEx: targets.sme > 0 ? (mtdData.smeVatEx / targets.sme) * 100 : 0,
    bida: targets.bida > 0 ? (mtdData.bida / targets.bida) * 100 : 0,
    s2s: targets.s2s > 0 ? (mtdData.s2s / targets.s2s) * 100 : 0,
  }), [mtdData, targets]);

  const fsoi = operationalStatus?.fsoi ?? 14;
  const forCloseout = operationalStatus?.forCloseout ?? 2;
  const forActivation = operationalStatus?.forActivation ?? 1;

  // Row items for MTD
  const mtdRows = [
    {
      name: 'FIBERX',
      sublabel: 'JO Count',
      runningFormatted: formatVal(mtdData.fiberX, false),
      targetFormatted: formatVal(targets.fiberX, false),
      progress: mtdProgress.fiberX,
    },
    {
      name: 'SME (VAT INC)',
      sublabel: 'MRC Inc',
      runningFormatted: formatVal(mtdData.smeVatInc, true),
      targetFormatted: formatVal(targets.sme, true),
      progress: mtdProgress.smeVatInc,
    },
    {
      name: 'SME (VAT EX)',
      sublabel: 'MRC Ex',
      runningFormatted: formatVal(mtdData.smeVatEx, true),
      targetFormatted: formatVal(targets.sme, true),
      progress: mtdProgress.smeVatEx,
    },
    {
      name: 'BIDA',
      sublabel: 'JO Count',
      runningFormatted: formatVal(mtdData.bida, false),
      targetFormatted: formatVal(targets.bida, false),
      progress: mtdProgress.bida,
    },
    {
      name: 'S2S',
      sublabel: 'JO Count',
      runningFormatted: formatVal(mtdData.s2s, false),
      targetFormatted: formatVal(targets.s2s, false),
      progress: mtdProgress.s2s,
    },
  ];

  // Row items for Runrate
  const runrateRows = [
    {
      name: 'FIBERX',
      sublabel: 'JO Count',
      runrateFormatted: formatVal(runrates.fiberX, false),
      targetFormatted: formatVal(targets.fiberX, false),
      progress: runrates.fiberXProgress,
    },
    {
      name: 'SME (VAT INC)',
      sublabel: 'MRC Inc',
      runrateFormatted: formatVal(runrates.smeVatInc, true),
      targetFormatted: formatVal(targets.sme, true),
      progress: runrates.smeVatIncProgress,
    },
    {
      name: 'SME (VAT EX)',
      sublabel: 'MRC Ex',
      runrateFormatted: formatVal(runrates.smeVatEx, true),
      targetFormatted: formatVal(targets.sme, true),
      progress: runrates.smeVatExProgress,
    },
    {
      name: 'BIDA',
      sublabel: 'JO Count',
      runrateFormatted: formatVal(runrates.bida, false),
      targetFormatted: formatVal(targets.bida, false),
      progress: runrates.bidaProgress,
    },
    {
      name: 'S2S',
      sublabel: 'JO Count',
      runrateFormatted: formatVal(runrates.s2s, false),
      targetFormatted: formatVal(targets.s2s, false),
      progress: runrates.s2sProgress,
    },
  ];

  return (
    <div
      id="daily-sli-report"
      className="bg-white border border-[#dcece6] rounded-[20px] p-6 shadow-sm"
    >
      {/* 2. SECTION HEADER */}
      <div className="flex items-center justify-between pb-5 border-b border-[#edf3f0] mb-6 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold tracking-tight text-[#123b31]">
              DAILY SLI REPORT
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#e8f5f1] text-[#0a684d] border border-[#cfe4da]">
              ALMASOR
            </span>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {asOfDisplay}
          </p>
        </div>
      </div>

      {/* 4. TOP ROW — DAILY OPERATIONAL SNAPSHOT (3 Columns on Desktop, Stacked on Mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* COLUMN 1: DAILY ACTIVATIONS */}
        <div className="bg-[#f8faf9] rounded-2xl p-4 border border-[#e2eee8] flex flex-col justify-between">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            DAILY ACTIVATIONS
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-[#e8f0ed] shadow-xs">
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                Activated FIBERX Yesterday
              </div>
              <div className="text-xl font-bold text-[#123b31] mt-1.5">
                {formatNumber(fiberXYesterday)}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#cbe4db] shadow-xs">
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                Activated FIBERX Today
              </div>
              <div className="text-xl font-bold text-[#0a8a64] mt-1.5">
                {formatNumber(fiberXToday)}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: FSOI */}
        <div className="bg-[#f8faf9] rounded-2xl p-4 border border-[#e2eee8] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              FSOI
            </div>
            <span className="inline-flex items-center text-[10px] font-semibold text-[#0a684d] bg-[#e8f5f1] border border-[#cfe4da] px-2 py-0.5 rounded">
              Live status
            </span>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#e8f0ed] shadow-xs flex flex-col items-center justify-center text-center my-auto">
            <div className="text-3xl font-extrabold text-[#123b31]">
              {formatNumber(fsoi)}
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-1">
              Active operational pipeline
            </div>
          </div>
        </div>

        {/* COLUMN 3: OPEN JOs FOR CLOSING */}
        <div className="bg-[#f8faf9] rounded-2xl p-4 border border-[#e2eee8] flex flex-col justify-between">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            OPEN JOs FOR CLOSING
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-[#e8f0ed] shadow-xs">
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                For Closeout
              </div>
              <div className="text-xl font-bold text-[#123b31] mt-1.5">
                {formatNumber(forCloseout)}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#e8f0ed] shadow-xs">
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                For Activation
              </div>
              <div className="text-xl font-bold text-[#0a684d] mt-1.5">
                {formatNumber(forActivation)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. MTD ACTIVATIONS VS TARGET */}
      <div className="bg-[#f8faf9] rounded-2xl p-4 md:p-5 border border-[#e2eee8] mb-6">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
            MTD ACTIVATIONS VS TARGET
          </h3>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">
            MTD Cutoff: {reportDate}
          </span>
        </div>

        {/* Table Header (Desktop) */}
        <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider text-gray-500 pb-2 border-b border-[#e2eee8]">
          <div className="col-span-4">METRIC</div>
          <div className="col-span-3 text-right">RUNNING (MTD)</div>
          <div className="col-span-3 text-right">TARGET</div>
          <div className="col-span-2 text-right">PROGRESS</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#edf3f0]">
          {mtdRows.map((row) => (
            <div key={row.name} className="py-3">
              {/* Desktop view */}
              <div className="hidden sm:grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-4 font-semibold text-[#123b31] flex items-center gap-1.5">
                  <span>{row.name}</span>
                  <span className="text-[11px] text-gray-400 font-normal hidden lg:inline">
                    ({row.sublabel})
                  </span>
                </div>
                <div className="col-span-3 text-right font-medium text-gray-900">
                  {row.runningFormatted}
                </div>
                <div className="col-span-3 text-right font-medium text-gray-500">
                  {row.targetFormatted}
                </div>
                <div className="col-span-2 text-right font-bold text-[#0a8a64]">
                  {formatPercent(row.progress)}
                </div>
              </div>

              {/* Mobile view */}
              <div className="sm:hidden space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#123b31]">{row.name}</span>
                  <span className="font-bold text-[#0a8a64]">{formatPercent(row.progress)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Running: <strong className="text-gray-800">{row.runningFormatted}</strong></span>
                  <span>Target: {row.targetFormatted}</span>
                </div>
              </div>

              {/* 6. Thin Progress Bar */}
              <div className="w-full bg-[#e8f3ee] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#0aa37a] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(Math.max(row.progress, 0), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. RUNRATE VS TARGET */}
      <div className="bg-[#f8faf9] rounded-2xl p-4 md:p-5 border border-[#e2eee8]">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
            RUNRATE VS TARGET
          </h3>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">
            Projected to month end ({daysInMonth} days)
          </span>
        </div>

        {/* Table Header (Desktop) */}
        <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider text-gray-500 pb-2 border-b border-[#e2eee8]">
          <div className="col-span-4">METRIC</div>
          <div className="col-span-3 text-right">RUNRATE</div>
          <div className="col-span-3 text-right">TARGET</div>
          <div className="col-span-2 text-right">PROGRESS</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#edf3f0]">
          {runrateRows.map((row) => (
            <div key={row.name} className="py-3">
              {/* Desktop view */}
              <div className="hidden sm:grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-4 font-semibold text-[#123b31] flex items-center gap-1.5">
                  <span>{row.name}</span>
                  <span className="text-[11px] text-gray-400 font-normal hidden lg:inline">
                    ({row.sublabel})
                  </span>
                </div>
                <div className="col-span-3 text-right font-medium text-gray-900">
                  {row.runrateFormatted}
                </div>
                <div className="col-span-3 text-right font-medium text-gray-500">
                  {row.targetFormatted}
                </div>
                <div className="col-span-2 text-right font-bold text-[#0a8a64]">
                  {formatPercent(row.progress)}
                </div>
              </div>

              {/* Mobile view */}
              <div className="sm:hidden space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#123b31]">{row.name}</span>
                  <span className="font-bold text-[#0a8a64]">{formatPercent(row.progress)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Runrate: <strong className="text-gray-800">{row.runrateFormatted}</strong></span>
                  <span>Target: {row.targetFormatted}</span>
                </div>
              </div>

              {/* Thin Progress Bar */}
              <div className="w-full bg-[#e8f3ee] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#0aa37a] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(Math.max(row.progress, 0), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
