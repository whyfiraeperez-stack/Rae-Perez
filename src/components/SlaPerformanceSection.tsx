import React, { useMemo } from 'react';
import { ParsedJO } from '../types';

interface SlaPerformanceSectionProps {
  rows: ParsedJO[];
}

function formatCount(val: number): string {
  return Math.round(val || 0).toLocaleString('en-PH');
}

function formatPercent(val: number): string {
  if (!Number.isFinite(val) || isNaN(val) || val <= 0) {
    return '0.00%';
  }
  return `${val.toFixed(2)}%`;
}

export const SlaPerformanceSection: React.FC<SlaPerformanceSectionProps> = ({
  rows,
}) => {
  const categories: Array<{ key: string; label: string }> = [
    { key: 'within 24 hrs', label: 'within 24 hrs' },
    { key: 'within 48 hrs', label: 'within 48 hrs' },
    { key: 'within 3 days', label: 'within 3 days' },
    { key: 'within 5 days', label: 'within 5 days' },
    { key: 'beyond 5 days', label: 'beyond 5 days' },
  ];

  const { items, grandTotal } = useMemo(() => {
    const totalCount = rows.length;

    let runningCumulativeCount = 0;

    const computedItems = categories.map(({ key, label }) => {
      const count = rows.filter((r) => r.sla === key).length;
      runningCumulativeCount += count;
      const cumulativePercent =
        totalCount > 0 ? (runningCumulativeCount / totalCount) * 100 : 0;

      return {
        key,
        label,
        count,
        cumulativeCount: runningCumulativeCount,
        cumulativePercent,
      };
    });

    return {
      items: computedItems,
      grandTotal: totalCount,
    };
  }, [rows]);

  return (
    <section className="mb-10" id="sla-performance-section">
      <div className="mb-4">
        <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">SLA PERFORMANCE</h2>
        <p className="text-sm text-gray-500 mt-0.5 font-medium">
          Distribution + cumulative % • Monthly closed JO turnaround time distribution
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* TABLE */}
        <div className="lg:col-span-6 bg-white border border-[#dcece6] rounded-2xl p-5 shadow-sm">
          <div className="pb-3 border-b border-[#edf3f0]">
            <h3 className="text-sm font-bold text-[#005e47] uppercase tracking-wide">
              SLA Ageing Distribution
            </h3>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-[#f2f8f5] text-gray-700 font-semibold border-b border-[#dcece6]">
                  <th className="py-2.5 px-3">SLA CATEGORY</th>
                  <th className="py-2.5 px-3 text-right">JO COUNT</th>
                  <th className="py-2.5 px-3 text-right">CUMULATIVE %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f5f2]">
                {items.map((item) => (
                  <tr key={item.key} className="hover:bg-[#fafcfb]">
                    <td className="py-2.5 px-3 font-medium text-gray-700">
                      {item.label}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-gray-800">
                      {formatCount(item.count)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#0a684d]">
                      {formatPercent(item.cumulativePercent)}
                    </td>
                  </tr>
                ))}

                {/* Grand Total */}
                <tr className="bg-[#e8f8f0] font-extrabold text-[#005e47] border-t-2 border-[#b5e6d0]">
                  <td className="py-2.5 px-3 uppercase">Grand Total</td>
                  <td className="py-2.5 px-3 text-right text-sm">
                    {formatCount(grandTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-sm text-[#0a684d]">
                    100.00%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CUMULATIVE VISUALIZATION */}
        <div className="lg:col-span-6 bg-white border border-[#dcece6] rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-[#edf3f0]">
              <h3 className="text-sm font-bold text-[#005e47] uppercase tracking-wide">
                Cumulative SLA Completion Pacing
              </h3>
            </div>

            <div className="space-y-4 mt-4">
              {items.map((item) => {
                const width = Math.max(0, Math.min(100, item.cumulativePercent));

                return (
                  <div key={item.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-700 capitalize">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">
                          {formatCount(item.cumulativeCount)} / {formatCount(grandTotal)} JOs
                        </span>
                        <span className="font-bold text-[#0a684d] w-14 text-right">
                          {formatPercent(item.cumulativePercent)}
                        </span>
                      </div>
                    </div>

                    <div className="h-3 w-full bg-[#e8edea] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#0aa37a] to-[#0a8a64] rounded-full transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-[#f0f5f2] flex items-center justify-between text-xs text-gray-500">
            <span>Target benchmark: &ge; 80% within 24 hours</span>
            <span className="font-semibold text-[#0a684d]">
              {grandTotal > 0
                ? `${formatPercent(items[0]?.cumulativePercent || 0)} 24h actual`
                : 'No data'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
