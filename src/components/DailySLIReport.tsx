import React, { useMemo } from 'react';
import { ParsedJO, Targets, DailyReportAlmasor } from '../types';
import { DEFAULT_DAILY_REPORT } from '../utils/dailyReport';

interface DailySLIReportProps {
  reportDate: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  allMonthRows: ParsedJO[]; // Unfiltered records for the month (ALMASOR scope)
  overallTargets: Targets;
  dailyReport?: DailyReportAlmasor;
  dailyReportError?: string;
  latestDataDate?: string; // e.g. "2026-09-19"
}

function parsePercentFromText(text: string): number {
  if (!text) return 0;
  const match = String(text).match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? parseFloat(match[1]) : 0;
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

function prefixPesoIfNeeded(text: string): string {
  if (!text) return '₱0';
  const trimmed = text.trim();
  if (trimmed.startsWith('₱') || trimmed.startsWith('P')) return trimmed;
  return `₱${trimmed}`;
}

function formatReportLabel(raw: string): string {
  if (!raw) return '19 Sep 2026';
  const cleaned = raw.replace(/^\*+|\*+$/g, '').trim();
  const prefixMatch = cleaned.match(/as of:\s*(.+)$/i);
  if (prefixMatch && prefixMatch[1]) {
    return prefixMatch[1].trim();
  }
  return cleaned;
}

function getCurrentManilaDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const DailySLIReport: React.FC<DailySLIReportProps> = ({
  reportDate,
  monthKey,
  allMonthRows,
  overallTargets,
  dailyReport,
  dailyReportError,
  latestDataDate,
}) => {
  // Use official daily report from Google Sheet DAILY REPORT ALMASOR, or fallback default
  const activeReport: DailyReportAlmasor = dailyReport || DEFAULT_DAILY_REPORT;
  const currentManilaToday = getCurrentManilaDateKey();
  const effectiveLatestDate = latestDataDate || currentManilaToday;

  // Parse report date
  const { year, monthNum, dayNum, daysInMonth, selectedFormattedDate } = useMemo(() => {
    const [y, m, d] = (reportDate || currentManilaToday).split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dim = new Date(y, m, 0).getDate();

    const formatted = dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    return {
      year: y,
      monthNum: m,
      dayNum: d,
      daysInMonth: dim,
      selectedFormattedDate: formatted,
    };
  }, [reportDate, currentManilaToday]);

  // Determine if selected reportDate is TODAY
  const isToday = useMemo(() => {
    if (!reportDate) return true;

    // Check if reportDate matches spreadsheet reportLabel (e.g. "19 Sep 2026")
    const repLabel = (activeReport.reportLabel || '').toUpperCase();
    const dateObj = new Date(year, monthNum - 1, dayNum);
    const dayStr = String(dayNum);
    const dayPad = String(dayNum).padStart(2, '0');
    const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

    if (
      repLabel &&
      (repLabel.includes(`${dayStr} ${monthShort}`) ||
       repLabel.includes(`${dayPad} ${monthShort}`) ||
       repLabel.includes(`${monthShort} ${dayStr}`) ||
       repLabel.includes(`${monthShort} ${dayPad}`)) &&
      repLabel.includes(String(year))
    ) {
      return true;
    }

    // Manila time
    const manilaIso = getCurrentManilaDateKey();
    if (reportDate === manilaIso) return true;

    // If reportDate >= latest recorded date
    if (effectiveLatestDate && reportDate >= effectiveLatestDate) return true;

    return false;
  }, [reportDate, activeReport.reportLabel, year, monthNum, dayNum, effectiveLatestDate]);

  // Targets from SUMMARY
  const targets = useMemo(() => ({
    fiberX: overallTargets.fiberX || 859,
    sme: overallTargets.sme || 136508,
    bida: overallTargets.bida || 113,
    s2s: overallTargets.s2s || 782,
  }), [overallTargets]);

  // Yesterday date string for historical calculations
  const yesterdayDate = useMemo(() => {
    const d = new Date(year, monthNum - 1, dayNum);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [year, monthNum, dayNum]);

  // Daily activations: FIBERX Yesterday & Today
  const { fiberXYesterdayDisplay, fiberXTodayDisplay } = useMemo(() => {
    if (isToday) {
      return {
        fiberXYesterdayDisplay: activeReport.fiberYesterday || '0',
        fiberXTodayDisplay: activeReport.fiberToday || '0',
      };
    }

    // Historical calculation from JO ACTIVATED (unique JOs)
    const seenYesterday = new Set<string>();
    const seenToday = new Set<string>();

    for (const r of allMonthRows) {
      if (r.package !== 'FIBERX') continue;
      const rYear = r.closingDate.getFullYear();
      const rMonth = String(r.closingDate.getMonth() + 1).padStart(2, '0');
      const rDay = String(r.closingDate.getDate()).padStart(2, '0');
      const rDateStr = `${rYear}-${rMonth}-${rDay}`;

      if (rDateStr === yesterdayDate) {
        seenYesterday.add(r.joNumber);
      } else if (rDateStr === reportDate) {
        seenToday.add(r.joNumber);
      }
    }

    return {
      fiberXYesterdayDisplay: formatNumber(seenYesterday.size),
      fiberXTodayDisplay: formatNumber(seenToday.size),
    };
  }, [isToday, activeReport.fiberYesterday, activeReport.fiberToday, allMonthRows, yesterdayDate, reportDate]);

  // Live operational pipeline values from DAILY REPORT ALMASOR (never fabricated historically)
  const fsoiDisplay = activeReport.fsoi || '0';
  const forCloseoutDisplay = activeReport.forCloseout || '0';
  const forActivationDisplay = activeReport.forActivation || '0';

  // Historical MTD calculation (only when not TODAY)
  const historicalMtd = useMemo(() => {
    if (isToday) {
      return null;
    }

    const mtdRows = allMonthRows.filter((r) => {
      const rYear = r.closingDate.getFullYear();
      const rMonth = r.closingDate.getMonth() + 1;
      const rDay = r.closingDate.getDate();
      return rYear === year && rMonth === monthNum && rDay <= dayNum;
    });

    const fiberXSet = new Set<string>();
    const bidaSet = new Set<string>();
    const s2sSet = new Set<string>();
    let smeVatIncSum = 0;
    let smeVatExSum = 0;

    for (const r of mtdRows) {
      if (r.package === 'FIBERX') {
        fiberXSet.add(r.joNumber);
      } else if (r.package === 'SME') {
        smeVatIncSum += r.mrc || 0;
        smeVatExSum += r.mrcVatEx !== undefined ? r.mrcVatEx : (r.mrc || 0) / 1.12;
      } else if (r.package === 'BIDA') {
        bidaSet.add(r.joNumber);
      } else if (r.package === 'S2S') {
        s2sSet.add(r.joNumber);
      }
    }

    return {
      fiberX: fiberXSet.size,
      smeVatInc: Math.round(smeVatIncSum),
      smeVatEx: Math.round(smeVatExSum),
      bida: bidaSet.size,
      s2s: s2sSet.size,
    };
  }, [isToday, allMonthRows, year, monthNum, dayNum]);

  // MTD Rows definition
  const mtdRows = useMemo(() => {
    if (isToday) {
      return [
        {
          name: 'FIBERX',
          sublabel: 'JO Count',
          runningDisplay: activeReport.fiberMTD,
          targetDisplay: formatVal(targets.fiberX, false),
          progressPercent: parsePercentFromText(activeReport.fiberMTD),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.fiberMTD))}%`,
        },
        {
          name: 'SME (VAT INC)',
          sublabel: 'MRC Inc',
          runningDisplay: prefixPesoIfNeeded(activeReport.smeVatIncMTD),
          targetDisplay: formatVal(targets.sme, true),
          progressPercent: parsePercentFromText(activeReport.smeVatIncMTD),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.smeVatIncMTD))}%`,
        },
        {
          name: 'SME (VAT EX)',
          sublabel: 'MRC Ex',
          runningDisplay: prefixPesoIfNeeded(activeReport.smeVatExMTD),
          targetDisplay: formatVal(targets.sme, true),
          progressPercent: parsePercentFromText(activeReport.smeVatExMTD),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.smeVatExMTD))}%`,
        },
        {
          name: 'BIDA',
          sublabel: 'JO Count',
          runningDisplay: activeReport.bidaMTD,
          targetDisplay: formatVal(targets.bida, false),
          progressPercent: parsePercentFromText(activeReport.bidaMTD),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.bidaMTD))}%`,
        },
        {
          name: 'S2S',
          sublabel: 'JO Count',
          runningDisplay: activeReport.s2sMTD,
          targetDisplay: formatVal(targets.s2s, false),
          progressPercent: parsePercentFromText(activeReport.s2sMTD),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.s2sMTD))}%`,
        },
      ];
    }

    // Historical MTD
    const h = historicalMtd || { fiberX: 0, smeVatInc: 0, smeVatEx: 0, bida: 0, s2s: 0 };
    const pFiber = targets.fiberX > 0 ? (h.fiberX / targets.fiberX) * 100 : 0;
    const pSmeInc = targets.sme > 0 ? (h.smeVatInc / targets.sme) * 100 : 0;
    const pSmeEx = targets.sme > 0 ? (h.smeVatEx / targets.sme) * 100 : 0;
    const pBida = targets.bida > 0 ? (h.bida / targets.bida) * 100 : 0;
    const pS2s = targets.s2s > 0 ? (h.s2s / targets.s2s) * 100 : 0;

    return [
      {
        name: 'FIBERX',
        sublabel: 'JO Count',
        runningDisplay: formatVal(h.fiberX, false),
        targetDisplay: formatVal(targets.fiberX, false),
        progressPercent: pFiber,
        progressDisplay: formatPercent(pFiber),
      },
      {
        name: 'SME (VAT INC)',
        sublabel: 'MRC Inc',
        runningDisplay: formatVal(h.smeVatInc, true),
        targetDisplay: formatVal(targets.sme, true),
        progressPercent: pSmeInc,
        progressDisplay: formatPercent(pSmeInc),
      },
      {
        name: 'SME (VAT EX)',
        sublabel: 'MRC Ex',
        runningDisplay: formatVal(h.smeVatEx, true),
        targetDisplay: formatVal(targets.sme, true),
        progressPercent: pSmeEx,
        progressDisplay: formatPercent(pSmeEx),
      },
      {
        name: 'BIDA',
        sublabel: 'JO Count',
        runningDisplay: formatVal(h.bida, false),
        targetDisplay: formatVal(targets.bida, false),
        progressPercent: pBida,
        progressDisplay: formatPercent(pBida),
      },
      {
        name: 'S2S',
        sublabel: 'JO Count',
        runningDisplay: formatVal(h.s2s, false),
        targetDisplay: formatVal(targets.s2s, false),
        progressPercent: pS2s,
        progressDisplay: formatPercent(pS2s),
      },
    ];
  }, [isToday, activeReport, targets, historicalMtd]);

  // Runrate Rows definition
  const runrateRows = useMemo(() => {
    if (isToday) {
      return [
        {
          name: 'FIBERX',
          sublabel: 'JO Count',
          runrateDisplay: activeReport.fiberRunrate,
          targetDisplay: formatVal(targets.fiberX, false),
          progressPercent: parsePercentFromText(activeReport.fiberRunrate),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.fiberRunrate))}%`,
        },
        {
          name: 'SME (VAT INC)',
          sublabel: 'MRC Inc',
          runrateDisplay: prefixPesoIfNeeded(activeReport.smeVatIncRunrate),
          targetDisplay: formatVal(targets.sme, true),
          progressPercent: parsePercentFromText(activeReport.smeVatIncRunrate),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.smeVatIncRunrate))}%`,
        },
        {
          name: 'SME (VAT EX)',
          sublabel: 'MRC Ex',
          runrateDisplay: prefixPesoIfNeeded(activeReport.smeVatExRunrate),
          targetDisplay: formatVal(targets.sme, true),
          progressPercent: parsePercentFromText(activeReport.smeVatExRunrate),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.smeVatExRunrate))}%`,
        },
        {
          name: 'BIDA',
          sublabel: 'JO Count',
          runrateDisplay: activeReport.bidaRunrate,
          targetDisplay: formatVal(targets.bida, false),
          progressPercent: parsePercentFromText(activeReport.bidaRunrate),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.bidaRunrate))}%`,
        },
        {
          name: 'S2S',
          sublabel: 'JO Count',
          runrateDisplay: activeReport.s2sRunrate,
          targetDisplay: formatVal(targets.s2s, false),
          progressPercent: parsePercentFromText(activeReport.s2sRunrate),
          progressDisplay: `${Math.round(parsePercentFromText(activeReport.s2sRunrate))}%`,
        },
      ];
    }

    // Historical runrate projection
    const h = historicalMtd || { fiberX: 0, smeVatInc: 0, smeVatEx: 0, bida: 0, s2s: 0 };
    const elapsedDays = Math.max(dayNum, 1);
    const factor = daysInMonth / elapsedDays;

    const rFiber = Math.round(h.fiberX * factor);
    const rSmeInc = Math.round(h.smeVatInc * factor);
    const rSmeEx = Math.round(h.smeVatEx * factor);
    const rBida = Math.round(h.bida * factor);
    const rS2s = Math.round(h.s2s * factor);

    const pFiber = targets.fiberX > 0 ? (rFiber / targets.fiberX) * 100 : 0;
    const pSmeInc = targets.sme > 0 ? (rSmeInc / targets.sme) * 100 : 0;
    const pSmeEx = targets.sme > 0 ? (rSmeEx / targets.sme) * 100 : 0;
    const pBida = targets.bida > 0 ? (rBida / targets.bida) * 100 : 0;
    const pS2s = targets.s2s > 0 ? (rS2s / targets.s2s) * 100 : 0;

    return [
      {
        name: 'FIBERX',
        sublabel: 'JO Count',
        runrateDisplay: formatVal(rFiber, false),
        targetDisplay: formatVal(targets.fiberX, false),
        progressPercent: pFiber,
        progressDisplay: formatPercent(pFiber),
      },
      {
        name: 'SME (VAT INC)',
        sublabel: 'MRC Inc',
        runrateDisplay: formatVal(rSmeInc, true),
        targetDisplay: formatVal(targets.sme, true),
        progressPercent: pSmeInc,
        progressDisplay: formatPercent(pSmeInc),
      },
      {
        name: 'SME (VAT EX)',
        sublabel: 'MRC Ex',
        runrateDisplay: formatVal(rSmeEx, true),
        targetDisplay: formatVal(targets.sme, true),
        progressPercent: pSmeEx,
        progressDisplay: formatPercent(pSmeEx),
      },
      {
        name: 'BIDA',
        sublabel: 'JO Count',
        runrateDisplay: formatVal(rBida, false),
        targetDisplay: formatVal(targets.bida, false),
        progressPercent: pBida,
        progressDisplay: formatPercent(pBida),
      },
      {
        name: 'S2S',
        sublabel: 'JO Count',
        runrateDisplay: formatVal(rS2s, false),
        targetDisplay: formatVal(targets.s2s, false),
        progressPercent: pS2s,
        progressDisplay: formatPercent(pS2s),
      },
    ];
  }, [isToday, activeReport, targets, historicalMtd, dayNum, daysInMonth]);

  return (
    <div
      id="daily-sli-report"
      className="bg-white border border-[#dcece6] rounded-[20px] p-6 shadow-sm mb-8"
    >
      {/* 1. SECTION HEADER */}
      <div className="flex items-center justify-between pb-5 border-b border-[#edf3f0] mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-bold tracking-tight text-[#123b31]">
              DAILY SLI REPORT
            </h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#e8f5f1] text-[#0a684d] border border-[#cfe4da]">
              DAILY REPORT ALMASOR
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-gray-500 font-medium">
            <span>
              Official Daily SLI Report:{' '}
              <strong className="text-[#0a684d]">
                {formatReportLabel(activeReport.reportLabel)}
              </strong>
            </span>
            <span className="text-gray-300">•</span>
            <span>
              Dashboard report date:{' '}
              <strong className="text-gray-700">
                {selectedFormattedDate}
              </strong>
            </span>
            {isToday ? (
              <span className="inline-flex items-center text-[10px] font-semibold text-[#0a684d] bg-[#e8f5f1] border border-[#cfe4da] px-2 py-0.5 rounded">
                Live Spreadsheet Report
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                Historical View
              </span>
            )}
          </div>
        </div>

        {dailyReportError && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
            Daily Report temporarily unavailable
          </div>
        )}
      </div>

      {/* 2. TOP ROW — DAILY OPERATIONAL SNAPSHOT (3 Columns on Desktop, Stacked on Mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* COLUMN 1: DAILY ACTIVATIONS */}
        <div className="bg-[#f8faf9] rounded-2xl p-4 border border-[#e2eee8] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              DAILY ACTIVATIONS
            </div>
            {isToday ? (
              <span className="inline-flex items-center text-[10px] font-semibold text-[#0a684d] bg-[#e8f5f1] border border-[#cfe4da] px-2 py-0.5 rounded">
                Live Report
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                Historical
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-[#e8f0ed] shadow-xs">
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                Activated FIBERX Yesterday
              </div>
              <div className="text-xl font-bold text-[#123b31] mt-1.5">
                {fiberXYesterdayDisplay}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#cbe4db] shadow-xs">
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                Activated FIBERX Today
              </div>
              <div className="text-xl font-bold text-[#0a8a64] mt-1.5">
                {fiberXTodayDisplay}
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
              LIVE STATUS
            </span>
          </div>
          <div className="bg-white rounded-xl p-3 border border-[#e8f0ed] shadow-xs flex flex-col items-center justify-center text-center my-auto">
            <div className="text-3xl font-extrabold text-[#123b31]">
              {fsoiDisplay}
            </div>
            <div className="text-[11px] text-gray-400 font-medium mt-1">
              Active operational pipeline
            </div>
          </div>
        </div>

        {/* COLUMN 3: OPEN JOs FOR CLOSING */}
        <div className="bg-[#f8faf9] rounded-2xl p-4 border border-[#e2eee8] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              OPEN JOs FOR CLOSING
            </div>
            <span className="inline-flex items-center text-[10px] font-semibold text-[#0a684d] bg-[#e8f5f1] border border-[#cfe4da] px-2 py-0.5 rounded">
              LIVE STATUS
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-xl border border-[#e8f0ed] shadow-xs">
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                For Closeout
              </div>
              <div className="text-xl font-bold text-[#123b31] mt-1.5">
                {forCloseoutDisplay}
              </div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#e8f0ed] shadow-xs">
              <div className="text-[11px] text-gray-500 font-medium leading-tight">
                For Activation
              </div>
              <div className="text-xl font-bold text-[#0a684d] mt-1.5">
                {forActivationDisplay}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MTD ACTIVATIONS VS TARGET */}
      <div className="bg-[#f8faf9] rounded-2xl p-4 md:p-5 border border-[#e2eee8] mb-6">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              MTD ACTIVATIONS VS TARGET
            </h3>
            {isToday ? (
              <span className="text-[10px] font-semibold text-[#0a684d] bg-[#e8f5f1] border border-[#cfe4da] px-1.5 py-0.2 rounded">
                Official Spreadsheet
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.2 rounded">
                Calculated MTD
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">
            MTD Cutoff: {selectedFormattedDate}
          </span>
        </div>

        {/* Table Header (Desktop) */}
        <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider text-gray-500 pb-2 border-b border-[#e2eee8]">
          <div className="col-span-3">METRIC</div>
          <div className="col-span-4 text-right">RUNNING (MTD)</div>
          <div className="col-span-3 text-right">TARGET</div>
          <div className="col-span-2 text-right">PROGRESS</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#edf3f0]">
          {mtdRows.map((row) => (
            <div key={row.name} className="py-3">
              {/* Desktop view */}
              <div className="hidden sm:grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-3 font-semibold text-[#123b31] flex items-center gap-1.5">
                  <span>{row.name}</span>
                  <span className="text-[11px] text-gray-400 font-normal hidden lg:inline">
                    ({row.sublabel})
                  </span>
                </div>
                <div className="col-span-4 text-right font-medium text-gray-900">
                  {row.runningDisplay}
                </div>
                <div className="col-span-3 text-right font-medium text-gray-500">
                  {row.targetDisplay}
                </div>
                <div className="col-span-2 text-right font-bold text-[#0a8a64]">
                  {row.progressDisplay}
                </div>
              </div>

              {/* Mobile view */}
              <div className="sm:hidden space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#123b31]">{row.name}</span>
                  <span className="font-bold text-[#0a8a64]">{row.progressDisplay}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>
                    Running: <strong className="text-gray-800">{row.runningDisplay}</strong>
                  </span>
                  <span>Target: {row.targetDisplay}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#e8f3ee] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#0aa37a] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(Math.max(row.progressPercent, 0), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. RUNRATE VS TARGET */}
      <div className="bg-[#f8faf9] rounded-2xl p-4 md:p-5 border border-[#e2eee8]">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              RUNRATE VS TARGET
            </h3>
            {isToday ? (
              <span className="text-[10px] font-semibold text-[#0a684d] bg-[#e8f5f1] border border-[#cfe4da] px-1.5 py-0.2 rounded">
                Official Spreadsheet
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.2 rounded">
                Projected
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 font-medium hidden sm:inline">
            Projected to month end ({daysInMonth} days)
          </span>
        </div>

        {/* Table Header (Desktop) */}
        <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider text-gray-500 pb-2 border-b border-[#e2eee8]">
          <div className="col-span-3">METRIC</div>
          <div className="col-span-4 text-right">RUNRATE</div>
          <div className="col-span-3 text-right">TARGET</div>
          <div className="col-span-2 text-right">PROGRESS</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#edf3f0]">
          {runrateRows.map((row) => (
            <div key={row.name} className="py-3">
              {/* Desktop view */}
              <div className="hidden sm:grid grid-cols-12 gap-3 items-center text-sm">
                <div className="col-span-3 font-semibold text-[#123b31] flex items-center gap-1.5">
                  <span>{row.name}</span>
                  <span className="text-[11px] text-gray-400 font-normal hidden lg:inline">
                    ({row.sublabel})
                  </span>
                </div>
                <div className="col-span-4 text-right font-medium text-gray-900">
                  {row.runrateDisplay}
                </div>
                <div className="col-span-3 text-right font-medium text-gray-500">
                  {row.targetDisplay}
                </div>
                <div className="col-span-2 text-right font-bold text-[#0a8a64]">
                  {row.progressDisplay}
                </div>
              </div>

              {/* Mobile view */}
              <div className="sm:hidden space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[#123b31]">{row.name}</span>
                  <span className="font-bold text-[#0a8a64]">{row.progressDisplay}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>
                    Runrate: <strong className="text-gray-800">{row.runrateDisplay}</strong>
                  </span>
                  <span>Target: {row.targetDisplay}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[#e8f3ee] h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-[#0aa37a] h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(Math.max(row.progressPercent, 0), 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
