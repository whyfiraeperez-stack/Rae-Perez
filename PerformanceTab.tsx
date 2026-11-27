import React from 'react';
import { SummaryAggregates } from '../utils/calculations';
import { DailyMetrics } from '../types';
import { Clock, TrendingUp, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface PerformanceTabProps {
  metrics: SummaryAggregates;
  dailyMetrics: DailyMetrics;
}

export const PerformanceTab: React.FC<PerformanceTabProps> = ({
  metrics,
  dailyMetrics,
}) => {
  return (
    <div id="performance-view" className="space-y-6">
      {/* Grid matching Photo 3: Left Pivot Table + Right Daily SLI Report */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Pivot Table - COUNTA of SLI by PACKAGE */}
        <div className="xl:col-span-7 bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs">
          <div className="border-b border-[#e5eee8] pb-4 mb-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-[#5c8072] uppercase tracking-wider">
                COUNTA OF SLI
              </div>
              <h2 className="text-xl font-bold text-[#103728]">
                Pivot table by Package
              </h2>
            </div>
            <span className="text-xs bg-[#eaf4ef] text-[#144b38] px-3 py-1 rounded-full font-semibold">
              Live Aggregation
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#e8f0ec]">
            <table id="performance-pivot-table" className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#124231] text-white font-bold text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">VENDOR</th>
                  <th className="py-2.5 px-3 text-center bg-[#18533e]">FIBERX</th>
                  <th className="py-2.5 px-3 text-center bg-[#1d634a]">SME</th>
                  <th className="py-2.5 px-3 text-center bg-[#237457]">BIDA</th>
                  <th className="py-2.5 px-4 text-center bg-[#0d3426]">Grand Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf3ef]">
                {metrics.vendorSummaries.map((v, idx) => (
                  <tr
                    key={v.vendor}
                    className={`hover:bg-[#f6faf8] transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-[#fafcfa]'
                    }`}
                  >
                    <td className="py-2 px-4 font-medium text-[#133c2e]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{v.vendor}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                            v.vendorType === 'INHOUSE'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {v.vendorType}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center font-bold text-[#144232]">
                      {v.fiberX || ''}
                    </td>
                    <td className="py-2 px-3 text-center text-[#426456]">
                      {v.sme > 0 ? v.sme : ''}
                    </td>
                    <td className="py-2 px-3 text-center text-[#426456]">
                      {v.bida > 0 ? v.bida : ''}
                    </td>
                    <td className="py-2 px-4 text-center font-black text-[#0f3426] bg-[#f4f9f6]">
                      {v.total}
                    </td>
                  </tr>
                ))}

                {/* Grand Total Row matching Photo 3 */}
                <tr className="bg-[#e4efe8] font-black text-[#0b2b1e] border-t-2 border-[#124231]">
                  <td className="py-3 px-4 font-extrabold uppercase">Grand Total</td>
                  <td className="py-3 px-3 text-center text-sm font-black text-emerald-950">
                    {metrics.fiberXCount}
                  </td>
                  <td className="py-3 px-3 text-center text-sm font-black text-emerald-950">
                    {metrics.smeCount}
                  </td>
                  <td className="py-3 px-3 text-center text-sm font-black text-emerald-950">
                    {metrics.bidaCount}
                  </td>
                  <td className="py-3 px-4 text-center text-base font-black text-white bg-[#124231]">
                    {metrics.totalRecords}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Daily SLI Report & Runrates matching Photo 3 */}
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-5">
            {/* Header timestamp */}
            <div className="border-b border-[#edf3ef] pb-3">
              <div className="flex items-center justify-between text-xs text-[#527768]">
                <span className="font-bold uppercase tracking-wider text-[#124231]">
                  *Daily SLI Report*
                </span>
                <span className="font-medium bg-[#f0f6f3] px-2 py-0.5 rounded text-[11px]">
                  as of: 14 Sep 2026 2:22 pm
                </span>
              </div>
            </div>

            {/* Daily Activations and FSOI */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#143e30] uppercase tracking-wide">
                *Daily Activations and FSOI*
              </div>
              <div className="bg-[#f7faf8] border border-[#e4eee8] rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">Activated FIBERX Yesterday:</span>
                  <span className="font-bold text-[#143e30] text-sm">
                    {dailyMetrics.activatedYesterday}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">Activated FIBERX Today:</span>
                  <span className="font-bold text-[#143e30] text-sm">
                    {dailyMetrics.activatedToday}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-[#e2ede6] pt-1.5">
                  <span className="text-[#517466] font-semibold">FSOI:</span>
                  <span className="font-black text-emerald-800 text-sm">
                    {dailyMetrics.fsoi}
                  </span>
                </div>
              </div>
            </div>

            {/* OPEN JOs for Closing */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#143e30] uppercase tracking-wide">
                *OPEN JOs for Closing*
              </div>
              <div className="bg-[#f7faf8] border border-[#e4eee8] rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">For Closeout:</span>
                  <span className="font-bold text-[#143e30]">{dailyMetrics.openJOsCloseout}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">For Activation:</span>
                  <span className="font-bold text-[#143e30]">{dailyMetrics.openJOsActivation}</span>
                </div>
              </div>
            </div>

            {/* MTD Activations vs Target with Photo 3 Yellow Highlight! */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#143e30] uppercase tracking-wide">
                *MTD Activations vs Target*
              </div>
              <div className="bg-[#f7faf8] border border-[#e4eee8] rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">FIBERX:</span>
                  <span className="font-bold text-[#143e30]">
                    {metrics.fiberXCount} (32%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">SME (VAT INC):</span>
                  <span className="font-bold text-[#143e30]">
                    ₱{metrics.smeAmountVatInc.toLocaleString()} (50%)
                  </span>
                </div>
                {/* Yellow Highlighted row from Photo 3 & 5 */}
                <div className="flex items-center justify-between bg-yellow-200/90 text-yellow-950 px-2 py-1 rounded font-bold shadow-2xs">
                  <span>SME (VAT EX):</span>
                  <span>₱{metrics.smeAmountVatEx.toLocaleString()} (44%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">BIDA:</span>
                  <span className="font-bold text-[#143e30]">{metrics.bidaCount} (2%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">S2S:</span>
                  <span className="font-bold text-[#143e30]">0 (0%)</span>
                </div>
              </div>
            </div>

            {/* Runrate vs Target matching Photo 3 */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#143e30] uppercase tracking-wide">
                *Runrate vs Target*
              </div>
              <div className="bg-[#f7faf8] border border-[#e4eee8] rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">FIBERX:</span>
                  <span className="font-bold text-[#143e30]">
                    {metrics.fiberXRunrate} / {metrics.fiberXTarget} ({Math.round(metrics.fiberXRunratePct)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">SME (VAT INC):</span>
                  <span className="font-bold text-[#143e30]">
                    ₱{metrics.smeRunrateAmount.toLocaleString()} / ₱{metrics.smeTargetAmount.toLocaleString()} ({Math.round(metrics.smeRunratePct)}%)
                  </span>
                </div>
                {/* Yellow Highlighted row from Photo 3 */}
                <div className="flex items-center justify-between bg-yellow-200/90 text-yellow-950 px-2 py-1 rounded font-bold shadow-2xs">
                  <span>SME (VAT EX):</span>
                  <span>₱{Math.round(metrics.smeRunrateAmount * 0.88).toLocaleString()} / ₱{metrics.smeTargetAmount.toLocaleString()} ({Math.round(((metrics.smeRunrateAmount * 0.88) / metrics.smeTargetAmount) * 100)}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">BIDA:</span>
                  <span className="font-bold text-[#143e30]">{metrics.bidaRunrate} / {metrics.bidaTarget} ({Math.round(metrics.bidaRunratePct)}%)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#517466]">S2S:</span>
                  <span className="font-bold text-[#143e30]">0 / {metrics.s2sTarget} (0%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
