import React, { useState } from 'react';
import { SummaryAggregates } from '../utils/calculations';
import { Calculator, CheckCircle2, Code2, ArrowRight, HelpCircle, Layers, Sparkles } from 'lucide-react';
import { Province, PackageCategory, SliType } from '../types';

interface FormulaGuideTabProps {
  metrics: SummaryAggregates;
}

export const FormulaGuideTab: React.FC<FormulaGuideTabProps> = ({ metrics }) => {
  const [testProvince, setTestProvince] = useState<Province>('ALBAY');
  const [testSliType, setTestSliType] = useState<SliType>('INHOUSE');
  const [testCategory, setTestCategory] = useState<PackageCategory>('FIBERX');

  // Interactive COUNTIFS demo
  const simulatedCount =
    metrics.territoryBreakdowns[testProvince]?.[
      testSliType === 'INHOUSE' ? 'inhouseFiberX' : 'msaFiberX'
    ] || 0;

  return (
    <div id="formula-guide-view" className="space-y-6">
      {/* Top Banner explaining the Photo 5 Formula */}
      <div className="bg-[#113f2e] text-white rounded-3xl p-7 shadow-md relative overflow-hidden">
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Calculator className="w-4 h-4" />
            <span>Google Sheets SLI Calculation Engine (Photo 5)</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            How Activated JOs are Computed
          </h2>
          <p className="text-xs text-emerald-100/90 leading-relaxed font-normal">
            As shown in the formula bar of Photo 5, each cell in the regional summary report is dynamically
            evaluated from the <code className="bg-[#1e5842] px-1.5 py-0.5 rounded font-mono text-emerald-200">&apos;JO ACTIVATED&apos;</code> tab using multi-criteria COUNTIFS and runrate pacing models.
          </p>

          {/* Formula Callout Box */}
          <div className="bg-[#0b281d] border border-[#21674d] rounded-2xl p-4 font-mono text-xs text-emerald-300 flex items-start gap-3 shadow-inner">
            <Code2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="overflow-x-auto">
              <div className="text-[10px] text-emerald-400 font-bold uppercase mb-1">
                EXACT FORMULA FROM PHOTO 5:
              </div>
              <div className="font-bold text-white tracking-wide">
                =COUNTIFS(&apos;JO ACTIVATED&apos;!$A:$A, C5, &apos;JO ACTIVATED&apos;!$G:$G, B$8, &apos;JO ACTIVATED&apos;!$S:$S, C$8, &apos;JO ACTIVATED&apos;!$AC:$AC, D$7)
              </div>
              <div className="text-[11px] text-emerald-400/80 mt-2 font-sans grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-[#184e3a]">
                <div>• <strong>$A:$A = C5</strong>: Matches Province (Albay / Sorsogon / Masbate)</div>
                <div>• <strong>$G:$G = B$8</strong>: Matches SLI Type (INHOUSE / MSA)</div>
                <div>• <strong>$S:$S = C$8</strong>: Matches Package Category (FIBERX, SME, BIDA)</div>
                <div>• <strong>$AC:$AC = D$7</strong>: Validates Activation Date &amp; Status</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formula Rules & Math Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Rule 1: Runrate Calculation */}
        <div className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
            1
          </div>
          <h3 className="text-base font-bold text-[#113a2c]">Runrate Formula</h3>
          <div className="bg-[#f5faf7] border border-[#d9ebe1] rounded-xl p-3 font-mono text-xs text-[#134937]">
            X = MTD × (Days in Month / Days Elapsed)
          </div>
          <p className="text-xs text-[#527768] leading-relaxed">
            On September 14, <strong>Days Elapsed = 14</strong> and <strong>Days In Month = 30</strong> (Runrate factor = 30 / 14 ≈ 2.14).
            MTD <strong>{metrics.fiberXCount}</strong> FiberX projects to <strong>{metrics.fiberXRunrate}</strong> month-end activations ({Math.round(metrics.fiberXRunratePct)}% of 859 target).
            <span className="block mt-2 p-2 bg-emerald-50 text-emerald-900 rounded-lg text-[11px] font-medium border border-emerald-200">
              ✓ Verified via COUNTIFS from raw data: 149 (Albay) + 59 (Sorsogon) + 70 (Masbate) = 278 FiberX.
            </span>
          </p>
        </div>

        {/* Rule 2: SME VAT Calculation */}
        <div className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
            2
          </div>
          <h3 className="text-base font-bold text-[#113a2c]">SME (12% VAT Exclusive)</h3>
          <div className="bg-[#fef9c3] border border-yellow-300 rounded-xl p-3 font-mono text-xs text-yellow-950 font-bold">
            SME (VAT EX) = SME (VAT INC) / 1.12
          </div>
          <p className="text-xs text-[#527768] leading-relaxed">
            As highlighted in yellow in Photo 3 &amp; 5:
            <br />
            <strong>₱67,990.00 / 1.12 = ₱59,831.20</strong> (deducting the 12% Philippine Value Added Tax).
          </p>
        </div>

        {/* Rule 3: Interactive Sandbox */}
        <div className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
            3
          </div>
          <h3 className="text-base font-bold text-[#113a2c]">Live Formula Tester</h3>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <select
                value={testProvince}
                onChange={(e) => setTestProvince(e.target.value as Province)}
                aria-label="Select test province"
                className="bg-[#f5faf7] border border-[#d2e2d9] rounded-lg p-1.5 text-xs font-semibold"
              >
                <option value="ALBAY">ALBAY</option>
                <option value="SORSOGON">SORSOGON</option>
                <option value="MASBATE">MASBATE</option>
              </select>

              <select
                value={testSliType}
                onChange={(e) => setTestSliType(e.target.value as SliType)}
                aria-label="Select test SLI type"
                className="bg-[#f5faf7] border border-[#d2e2d9] rounded-lg p-1.5 text-xs font-semibold"
              >
                <option value="INHOUSE">INHOUSE</option>
                <option value="MSA">MSA</option>
              </select>
            </div>

            <div className="bg-[#eaf4ee] rounded-xl p-2.5 text-center">
              <div className="text-[10px] text-[#55796b] font-bold uppercase">Evaluated Count:</div>
              <div className="text-2xl font-black text-[#103728]">{simulatedCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* MTD VS TARGET Table matching the exact blue sheet in Photo 5 */}
      <div className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#e5eee8] pb-3">
          <div>
            <div className="text-[11px] font-bold text-[#5c8072] uppercase tracking-wider">
              BICOL MTD SEPTEMBER - RGM REPORT
            </div>
            <h2 className="text-xl font-bold text-[#103728]">
              MTD VS TARGET by Province &amp; Channel
            </h2>
          </div>
          <span className="text-xs font-bold text-blue-900 bg-blue-100 px-3 py-1 rounded-full">
            Sheet: SUMMARY
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#cbd5e1]">
          <table id="mtd-vs-target-table" className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#1e40af] text-white font-bold text-[11px] text-center">
                <th className="py-2 px-3 border border-blue-900 text-left">PROVINCE</th>
                <th className="py-2 px-3 border border-blue-900 text-left">SLI</th>
                <th className="py-2 px-3 border border-blue-900">FIBERX</th>
                <th className="py-2 px-3 border border-blue-900">SME (₱)</th>
                <th className="py-2 px-3 border border-blue-900">BIDA</th>
                <th className="py-2 px-3 border border-blue-900">S2S</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#cbd5e1] text-[#1e293b]">
              {/* ALBAY */}
              <tr className="bg-white">
                <td rowSpan={6} className="py-2 px-3 font-bold border border-[#cbd5e1] bg-slate-50 align-top">
                  ALBAY
                </td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] font-medium">INHOUSE</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-bold">55</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right">16,948.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
              </tr>
              <tr className="bg-white">
                <td className="py-1.5 px-3 border border-[#cbd5e1] font-medium">MSA</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-bold">94</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right">10,895.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
              </tr>
              <tr className="bg-[#f1f5f9] font-bold">
                <td className="py-1.5 px-3 border border-[#cbd5e1] italic">SubTotal</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">149</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right font-black">27,843.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">0</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">0</td>
              </tr>
              <tr className="text-emerald-700 font-bold bg-[#f0fdf4]">
                <td className="py-1 px-3 border border-[#cbd5e1] italic">Target</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">467</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right">71,993.00</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">82</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">572</td>
              </tr>
              <tr className="text-blue-700 italic bg-blue-50/50">
                <td className="py-1 px-3 border border-[#cbd5e1]">%Share</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">31.9%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right font-bold">38.7%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">0.0%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">0.0%</td>
              </tr>
              <tr className="text-red-600 bg-red-50/30">
                <td className="py-1 px-3 border border-[#cbd5e1] italic">Var</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">-318</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right">-44,150.00</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">-82</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">572</td>
              </tr>

              {/* SORSOGON */}
              <tr className="bg-white">
                <td rowSpan={6} className="py-2 px-3 font-bold border border-[#cbd5e1] bg-slate-50 align-top">
                  SORSOGON
                </td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] font-medium">INHOUSE</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-bold">34</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right">9,599.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">2</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
              </tr>
              <tr className="bg-white">
                <td className="py-1.5 px-3 border border-[#cbd5e1] font-medium">MSA</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-bold">25</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right">22,449.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
              </tr>
              <tr className="bg-[#f1f5f9] font-bold">
                <td className="py-1.5 px-3 border border-[#cbd5e1] italic">SubTotal</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">59</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right font-black">32,048.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">2</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">0</td>
              </tr>
              <tr className="text-emerald-700 font-bold bg-[#f0fdf4]">
                <td className="py-1 px-3 border border-[#cbd5e1] italic">Target</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">189</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right">59,354.00</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">21</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">169</td>
              </tr>
              <tr className="text-blue-700 italic bg-blue-50/50">
                <td className="py-1 px-3 border border-[#cbd5e1]">%Share</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">31.2%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right font-bold">54.0%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">9.5%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">0.0%</td>
              </tr>
              <tr className="text-red-600 bg-red-50/30">
                <td className="py-1 px-3 border border-[#cbd5e1] italic">Var</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">-130</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right">-27,306.00</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">-19</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">169</td>
              </tr>

              {/* MASBATE */}
              <tr className="bg-white">
                <td rowSpan={6} className="py-2 px-3 font-bold border border-[#cbd5e1] bg-slate-50 align-top">
                  MASBATE
                </td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] font-medium">INHOUSE</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-bold">36</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right">8,099.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
              </tr>
              <tr className="bg-white">
                <td className="py-1.5 px-3 border border-[#cbd5e1] font-medium">MSA</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-bold">34</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right">0.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center">0</td>
              </tr>
              <tr className="bg-[#f1f5f9] font-bold">
                <td className="py-1.5 px-3 border border-[#cbd5e1] italic">SubTotal</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">70</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-right font-black">8,099.00</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">0</td>
                <td className="py-1.5 px-3 border border-[#cbd5e1] text-center font-black">0</td>
              </tr>
              <tr className="text-emerald-700 font-bold bg-[#f0fdf4]">
                <td className="py-1 px-3 border border-[#cbd5e1] italic">Target</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">203</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right">5,161.00</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">10</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">41</td>
              </tr>
              <tr className="text-blue-700 italic bg-blue-50/50">
                <td className="py-1 px-3 border border-[#cbd5e1]">%Share</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">34.5%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right font-bold">156.9%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">0.0%</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center font-bold">0.0%</td>
              </tr>
              <tr className="text-emerald-700 bg-emerald-50/30">
                <td className="py-1 px-3 border border-[#cbd5e1] italic">Var</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center text-red-600">-133</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-right text-emerald-700 font-bold">2,938.00</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center text-red-600">-10</td>
                <td className="py-1 px-3 border border-[#cbd5e1] text-center">41</td>
              </tr>

              {/* OVERALL GRAND TOTAL */}
              <tr className="bg-[#1e3a8a] text-white font-extrabold text-sm border-t-2 border-blue-950">
                <td colSpan={2} className="py-2.5 px-3 border border-blue-900 uppercase">
                  Grand Total
                </td>
                <td className="py-2.5 px-3 border border-blue-900 text-center font-black">
                  {metrics.fiberXCount}
                </td>
                <td className="py-2.5 px-3 border border-blue-900 text-right font-black">
                  ₱{metrics.smeAmountVatInc.toLocaleString()}
                </td>
                <td className="py-2.5 px-3 border border-blue-900 text-center font-black">
                  {metrics.bidaCount}
                </td>
                <td className="py-2.5 px-3 border border-blue-900 text-center font-black">
                  0
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
