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

function formatPercent(val: number): string {
  if (!Number.isFinite(val) || isNaN(val) || val <= 0) return '0%';
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
  // Parse report date
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
    });

    const isToday = reportDate >= latestDataDate;

    let asOf = `As of: ${formattedDate}`;
    if (isToday && operationalStatus?.asOfText) {
      asOf = `As of: ${operationalStatus.asOfText}`;
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

  return (
    <div
      id="daily-sli-report"
      className="bg-white border border-[#dcece6] rounded-2xl p-5 shadow-sm flex flex-col justify-between"
    >
      {/* Header */}
      <div className="pb-3 border-b border-[#eef5f2] mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold tracking-wider text-[#0a684d] uppercase">
            DAILY SLI REPORT
          </h2>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#e8f5f1] text-[#0a684d]">
            ALMASOR
          </span>
        </div>
        <p className="text-xs text-gray-500 font-medium mt-0.5">
          {asOfDisplay}
        </p>
      </div>

      <div className="space-y-3.5 text-xs">
        {/* Section 1: Daily Activations and FSOI */}
        <div>
          <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase mb-1.5 flex items-center justify-between">
            <span>DAILY ACTIVATIONS AND FSOI</span>
          </div>
          <div className="bg-[#f9fbfb] rounded-xl p-2.5 border border-[#e8f0ed] space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Activated FIBERX Yesterday:</span>
              <span className="font-bold text-[#123b31] bg-white px-2 py-0.5 rounded border border-[#e2ece7]">
                {formatNumber(fiberXYesterday)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Activated FIBERX Today:</span>
              <span className="font-bold text-[#0a8a64] bg-white px-2 py-0.5 rounded border border-[#cbe4db]">
                {formatNumber(fiberXToday)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 flex items-center gap-1.5">
                FSOI:
                {!isTodayOrLatest && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded font-medium border border-amber-200">
                    Live status
                  </span>
                )}
              </span>
              <span className="font-bold text-gray-800 bg-white px-2 py-0.5 rounded border border-[#e2ece7]">
                {formatNumber(fsoi)}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Open JOs for Closing */}
        <div>
          <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase mb-1.5 flex items-center justify-between">
            <span>OPEN JOs FOR CLOSING</span>
            {!isTodayOrLatest && (
              <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded font-medium border border-amber-200">
                Live status
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 bg-[#f9fbfb] rounded-xl p-2.5 border border-[#e8f0ed]">
            <div className="bg-white p-2 rounded-lg border border-[#e2ece7]">
              <div className="text-[10px] text-gray-500 font-medium">For Closeout</div>
              <div className="text-base font-bold text-[#123b31] mt-0.5">
                {formatNumber(forCloseout)}
              </div>
            </div>
            <div className="bg-white p-2 rounded-lg border border-[#e2ece7]">
              <div className="text-[10px] text-gray-500 font-medium">For Activation</div>
              <div className="text-base font-bold text-[#0a684d] mt-0.5">
                {formatNumber(forActivation)}
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: MTD Activations vs Target */}
        <div>
          <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase mb-1.5">
            MTD ACTIVATIONS VS TARGET
          </div>
          <div className="bg-[#f9fbfb] rounded-xl p-2.5 border border-[#e8f0ed] space-y-1">
            <div className="flex justify-between items-center py-0.5 border-b border-[#edf3f0]">
              <span className="text-gray-600 font-medium">FIBERX:</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(mtdData.fiberX)}{' '}
                <span className="text-[#0a8a64] font-bold">
                  ({formatPercent(mtdProgress.fiberX)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-[#edf3f0]">
              <span className="text-gray-600 font-medium">SME (VAT INC):</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(mtdData.smeVatInc)}{' '}
                <span className="text-[#0a8a64] font-bold">
                  ({formatPercent(mtdProgress.smeVatInc)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-[#edf3f0]">
              <span className="text-gray-600 font-medium">SME (VAT EX):</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(mtdData.smeVatEx)}{' '}
                <span className="text-[#0a8a64] font-bold">
                  ({formatPercent(mtdProgress.smeVatEx)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-[#edf3f0]">
              <span className="text-gray-600 font-medium">BIDA:</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(mtdData.bida)}{' '}
                <span className="text-[#0a8a64] font-bold">
                  ({formatPercent(mtdProgress.bida)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-600 font-medium">S2S:</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(mtdData.s2s)}{' '}
                <span className="text-gray-500 font-bold">
                  ({formatPercent(mtdProgress.s2s)})
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Runrate vs Target */}
        <div>
          <div className="text-[11px] font-bold text-gray-700 tracking-wide uppercase mb-1.5">
            RUNRATE VS TARGET
          </div>
          <div className="bg-[#f9fbfb] rounded-xl p-2.5 border border-[#e8f0ed] space-y-1">
            <div className="flex justify-between items-center py-0.5 border-b border-[#edf3f0]">
              <span className="text-gray-600 font-medium">FIBERX:</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(runrates.fiberX)} / {formatNumber(targets.fiberX)}{' '}
                <span className="text-[#0a8a64] font-bold">
                  ({formatPercent(runrates.fiberXProgress)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-[#edf3f0]">
              <span className="text-gray-600 font-medium">SME (VAT INC):</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(runrates.smeVatInc)} / {formatNumber(targets.sme)}{' '}
                <span className="text-[#0a8a64] font-bold">
                  ({formatPercent(runrates.smeVatIncProgress)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-[#edf3f0]">
              <span className="text-gray-600 font-medium">SME (VAT EX):</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(runrates.smeVatEx)} / {formatNumber(targets.sme)}{' '}
                <span className="text-[#0a8a64] font-bold">
                  ({formatPercent(runrates.smeVatExProgress)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-[#edf3f0]">
              <span className="text-gray-600 font-medium">BIDA:</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(runrates.bida)} / {formatNumber(targets.bida)}{' '}
                <span className="text-[#0a8a64] font-bold">
                  ({formatPercent(runrates.bidaProgress)})
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-600 font-medium">S2S:</span>
              <span className="font-semibold text-gray-900">
                {formatNumber(runrates.s2s)} / {formatNumber(targets.s2s)}{' '}
                <span className="text-gray-500 font-bold">
                  ({formatPercent(runrates.s2sProgress)})
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
