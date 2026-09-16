import React, { useMemo } from 'react';
import { Calendar, CheckCircle2, ChevronRight } from 'lucide-react';
import { JORecord } from '../types';
import {
  DateFilterMode,
  formatClosedOnDisplay,
  countActivatedForDate,
  normalizeDate,
} from '../utils/dateCountingEngine';

interface DailyActivationTableProps {
  records: JORecord[];
  selectedYear: number;
  selectedMonth: number;
  selectedProvince: string;
  selectedPackage: string;
  dateMode: DateFilterMode;
  selectedDate: string;
  onSelectDate?: (dateStr: string) => void;
}

export const DailyActivationTable: React.FC<DailyActivationTableProps> = ({
  records,
  selectedYear,
  selectedMonth,
  selectedProvince,
  selectedPackage,
  dateMode,
  selectedDate,
  onSelectDate,
}) => {
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const parsedSelectedDate = useMemo(() => normalizeDate(selectedDate), [selectedDate]);

  // Compute daily rows for every day in the selected month
  const dailyData = useMemo(() => {
    const rows = [];
    let totalInhouse = 0;
    let totalMsa = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(selectedYear, selectedMonth, day);
      const closedOn = formatClosedOnDisplay(dateObj);

      // INHOUSE count for this date, respecting province and package filters
      const inhouse = countActivatedForDate(
        records,
        dateObj,
        selectedProvince,
        'INHOUSE',
        selectedPackage
      );

      // MSA count for this date, respecting province and package filters
      const msa = countActivatedForDate(
        records,
        dateObj,
        selectedProvince,
        'MSA',
        selectedPackage
      );

      const grandTotal = inhouse + msa;
      totalInhouse += inhouse;
      totalMsa += msa;

      const isSelected =
        dateMode === 'specific_date' &&
        parsedSelectedDate &&
        parsedSelectedDate.getFullYear() === selectedYear &&
        parsedSelectedDate.getMonth() === selectedMonth &&
        parsedSelectedDate.getDate() === day;

      rows.push({
        day,
        dateObj,
        closedOn,
        inhouse,
        msa,
        grandTotal,
        isSelected,
      });
    }

    return {
      rows,
      totals: {
        inhouse: totalInhouse,
        msa: totalMsa,
        grandTotal: totalInhouse + totalMsa,
      },
    };
  }, [
    records,
    selectedYear,
    selectedMonth,
    selectedProvince,
    selectedPackage,
    daysInMonth,
    dateMode,
    parsedSelectedDate,
  ]);

  return (
    <div
      id="daily-activation-table-card"
      className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span className="text-[11px] font-bold tracking-wider text-[#587a6d] uppercase">
              DAILY ACTIVATION TABLE
            </span>
          </div>
          <h2 className="text-xl font-bold text-[#0f2e22] mt-0.5">
            Closed On Breakdown (Column AF)
          </h2>
          <p className="text-xs text-[#5f8173] mt-0.5">
            Formula: <code>COUNTIFS(&#39;JO ACTIVATED&#39;!AF:AF, date, &#39;JO ACTIVATED&#39;!S:S, &quot;INHOUSE&quot;|&quot;MSA&quot;)</code>
            {selectedProvince !== 'All districts' && ` • Filtered by ${selectedProvince}`}
            {selectedPackage !== 'All Packages' && ` • ${selectedPackage}`}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#608274]">Month Total:</span>
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-200">
            {dailyData.totals.grandTotal} JOs
          </span>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto max-h-96 border border-[#e2ece6] rounded-2xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-[#f0f6f2] text-[#1a4435] font-bold sticky top-0 z-10 border-b border-[#dce7e1]">
            <tr>
              <th className="px-4 py-3">CLOSED ON (Col AF)</th>
              <th className="px-4 py-3 text-right">INHOUSE</th>
              <th className="px-4 py-3 text-right">MSA</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#edf3ef]">
            {dailyData.rows.map((row) => (
              <tr
                key={row.closedOn}
                onClick={() => onSelectDate && onSelectDate(row.closedOn)}
                className={`transition-colors cursor-pointer ${
                  row.isSelected
                    ? 'bg-emerald-100/70 font-semibold text-emerald-950 border-l-4 border-l-emerald-600'
                    : 'hover:bg-[#f6fbf8] text-[#193a2e]'
                }`}
                title="Click to filter by this specific date"
              >
                <td className="px-4 py-2.5 font-mono font-medium flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[#587a6d]" />
                  <span>{row.closedOn}</span>
                  {row.isSelected && (
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">
                      Selected Date
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {row.inhouse > 0 ? (
                    <span className="text-[#124231] font-bold">{row.inhouse}</span>
                  ) : (
                    <span className="text-[#99b5a9]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-medium">
                  {row.msa > 0 ? (
                    <span className="text-[#0d6e53] font-bold">{row.msa}</span>
                  ) : (
                    <span className="text-[#99b5a9]">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-[#0e2f23]">
                  {row.grandTotal > 0 ? (
                    <span className="px-2 py-0.5 rounded-md bg-[#e4f3eb] text-[#0f3c2c]">
                      {row.grandTotal}
                    </span>
                  ) : (
                    <span className="text-[#99b5a9]">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {/* Footer Total Row */}
          <tfoot className="bg-[#eaf3ee] text-[#0f3427] font-bold border-t-2 border-[#cbe0d5] sticky bottom-0 z-10">
            <tr>
              <td className="px-4 py-3 uppercase tracking-wider">Grand Total</td>
              <td className="px-4 py-3 text-right text-emerald-900 font-extrabold">
                {dailyData.totals.inhouse}
              </td>
              <td className="px-4 py-3 text-right text-teal-900 font-extrabold">
                {dailyData.totals.msa}
              </td>
              <td className="px-4 py-3 text-right text-emerald-950 font-black text-sm">
                {dailyData.totals.grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#648678] pt-1">
        <span>Click any date row above to view specific date metrics.</span>
        <span>
          Showing {daysInMonth} days for {formatClosedOnDisplay(new Date(selectedYear, selectedMonth, 1)).split('-').slice(1).join(' ')}
        </span>
      </div>
    </div>
  );
};
