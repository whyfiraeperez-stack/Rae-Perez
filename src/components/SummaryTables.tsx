import React, { useMemo } from 'react';
import { Layers, MapPin, DollarSign } from 'lucide-react';
import { JORecord } from '../types';
import {
  DateFilterMode,
  countActivatedForDate,
  countActivatedForMonth,
  sumAmountForDate,
  sumAmountForMonth,
} from '../utils/dateCountingEngine';

interface SummaryTablesProps {
  records: JORecord[];
  dateMode: DateFilterMode;
  selectedDate: string;
  selectedYear: number;
  selectedMonth: number;
  selectedProvince: string;
  selectedSliType: string;
  selectedPackage: string;
}

export const SummaryTables: React.FC<SummaryTablesProps> = ({
  records,
  dateMode,
  selectedDate,
  selectedYear,
  selectedMonth,
  selectedProvince,
  selectedSliType,
  selectedPackage,
}) => {
  // 1. MRC PACKAGE SUMMARY: FIBERX, SME, BIDA
  const packageSummary = useMemo(() => {
    const packages: Array<{ key: string; label: string }> = [
      { key: 'FIBERX', label: 'FIBERX' },
      { key: 'SME', label: 'SME' },
      { key: 'BIDA', label: 'BIDA' },
    ];

    let grandCount = 0;
    let grandMrc = 0;

    const rows = packages.map((pkg) => {
      const count =
        dateMode === 'specific_date'
          ? countActivatedForDate(
              records,
              selectedDate,
              selectedProvince,
              selectedSliType,
              pkg.key
            )
          : countActivatedForMonth(
              records,
              selectedYear,
              selectedMonth,
              selectedProvince,
              selectedSliType,
              pkg.key
            );

      const mrc =
        dateMode === 'specific_date'
          ? sumAmountForDate(
              records,
              selectedDate,
              selectedProvince,
              selectedSliType,
              pkg.key
            )
          : sumAmountForMonth(
              records,
              selectedYear,
              selectedMonth,
              selectedProvince,
              selectedSliType,
              pkg.key
            );

      grandCount += count;
      grandMrc += mrc;

      return {
        label: pkg.label,
        count,
        mrc,
      };
    });

    return { rows, grandCount, grandMrc };
  }, [
    records,
    dateMode,
    selectedDate,
    selectedYear,
    selectedMonth,
    selectedProvince,
    selectedSliType,
  ]);

  // 2. PROVINCE SUMMARY: ALBAY, MASBATE, SORSOGON
  const provinceSummary = useMemo(() => {
    const provinces: Array<{ key: string; label: string }> = [
      { key: 'ALBAY', label: 'ALBAY' },
      { key: 'MASBATE', label: 'MASBATE' },
      { key: 'SORSOGON', label: 'SORSOGON' },
    ];

    let totalInhouse = 0;
    let totalMsa = 0;

    const rows = provinces.map((prov) => {
      const inhouse =
        dateMode === 'specific_date'
          ? countActivatedForDate(
              records,
              selectedDate,
              prov.key,
              'INHOUSE',
              selectedPackage
            )
          : countActivatedForMonth(
              records,
              selectedYear,
              selectedMonth,
              prov.key,
              'INHOUSE',
              selectedPackage
            );

      const msa =
        dateMode === 'specific_date'
          ? countActivatedForDate(
              records,
              selectedDate,
              prov.key,
              'MSA',
              selectedPackage
            )
          : countActivatedForMonth(
              records,
              selectedYear,
              selectedMonth,
              prov.key,
              'MSA',
              selectedPackage
            );

      const total = inhouse + msa;
      totalInhouse += inhouse;
      totalMsa += msa;

      return {
        label: prov.label,
        inhouse,
        msa,
        total,
      };
    });

    return {
      rows,
      totalInhouse,
      totalMsa,
      grandTotal: totalInhouse + totalMsa,
    };
  }, [
    records,
    dateMode,
    selectedDate,
    selectedYear,
    selectedMonth,
    selectedPackage,
  ]);

  return (
    <div id="summary-tables-grid" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. MRC Package Summary */}
      <div
        id="mrc-package-summary-card"
        className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span className="text-[11px] font-bold tracking-wider text-[#587a6d] uppercase">
                PACKAGE &amp; REVENUE SUMMARY
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#0e2f22] mt-0.5">
              MRC Package Summary
            </h3>
            <p className="text-xs text-[#5f8173] mt-0.5">
              Calculated from Col AC (PACKAGE) and Col AE (MRC)
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-[#edf5f0] text-[#1a4b39] font-bold rounded-lg border border-[#cfe2d7]">
            {dateMode === 'specific_date' ? 'Specific Date' : 'Entire Month'}
          </span>
        </div>

        <div className="overflow-x-auto border border-[#e2ece6] rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f0f6f2] text-[#1a4435] font-bold border-b border-[#dce7e1]">
              <tr>
                <th className="px-4 py-3">PACKAGE (Col AC)</th>
                <th className="px-4 py-3 text-right">JO COUNT</th>
                <th className="px-4 py-3 text-right">TOTAL MRC (Col AE)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf3ef]">
              {packageSummary.rows.map((r) => (
                <tr key={r.label} className="hover:bg-[#f6fbf8] text-[#193a2e] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[#113e2f]">{r.label}</td>
                  <td className="px-4 py-3 text-right font-medium text-[#134433]">
                    {r.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-800">
                    ₱{r.mrc.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#eaf3ee] text-[#0f3427] font-bold border-t-2 border-[#cbe0d5]">
              <tr>
                <td className="px-4 py-3 uppercase tracking-wider">TOTAL</td>
                <td className="px-4 py-3 text-right text-emerald-950 font-extrabold text-sm">
                  {packageSummary.grandCount.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-emerald-950 font-black font-mono text-sm">
                  ₱{packageSummary.grandMrc.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 2. Province Summary */}
      <div
        id="province-summary-card"
        className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-teal-600" />
              <span className="text-[11px] font-bold tracking-wider text-[#587a6d] uppercase">
                DISTRICT CHANNEL SUMMARY
              </span>
            </div>
            <h3 className="text-lg font-bold text-[#0e2f22] mt-0.5">
              Province Summary
            </h3>
            <p className="text-xs text-[#5f8173] mt-0.5">
              Calculated from Col G (STATEORPROVINCE) and Col S (SLI TYPE)
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-[#edf5f0] text-[#1a4b39] font-bold rounded-lg border border-[#cfe2d7]">
            {selectedPackage === 'All Packages' ? 'All Packages' : selectedPackage}
          </span>
        </div>

        <div className="overflow-x-auto border border-[#e2ece6] rounded-2xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#f0f6f2] text-[#1a4435] font-bold border-b border-[#dce7e1]">
              <tr>
                <th className="px-4 py-3">PROVINCE (Col G)</th>
                <th className="px-4 py-3 text-right">INHOUSE</th>
                <th className="px-4 py-3 text-right">MSA</th>
                <th className="px-4 py-3 text-right">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf3ef]">
              {provinceSummary.rows.map((r) => (
                <tr key={r.label} className="hover:bg-[#f6fbf8] text-[#193a2e] transition-colors">
                  <td className="px-4 py-3 font-semibold text-[#113e2f]">{r.label}</td>
                  <td className="px-4 py-3 text-right font-medium text-[#134433]">
                    {r.inhouse.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-[#0e5c46]">
                    {r.msa.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-900">
                    {r.total.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#eaf3ee] text-[#0f3427] font-bold border-t-2 border-[#cbe0d5]">
              <tr>
                <td className="px-4 py-3 uppercase tracking-wider">TOTAL</td>
                <td className="px-4 py-3 text-right text-emerald-950 font-extrabold text-sm">
                  {provinceSummary.totalInhouse.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-teal-950 font-extrabold text-sm">
                  {provinceSummary.totalMsa.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-emerald-950 font-black text-sm">
                  {provinceSummary.grandTotal.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
