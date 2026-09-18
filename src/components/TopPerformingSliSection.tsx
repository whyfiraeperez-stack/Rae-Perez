import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ParsedJO } from '../types';

interface TopPerformingSliSectionProps {
  rows: ParsedJO[]; // MTD records filtered by province, sliType, package
  totalScopeJOs: number; // Total unique JOs in the current filtered dashboard scope
}

interface SliMetricItem {
  name: string;
  total: number;
  fiberX: number;
  sme: number;
  bida: number;
  s2s: number;
  totalMrc: number;
  smeMrc: number;
  provinces: string[];
  provinceDisplay: string;
  sliTypes: string[];
  sliTypeDisplay: string;
  share: number;
}

function formatCount(val: number): string {
  if (!Number.isFinite(val) || isNaN(val)) return '0';
  return Math.round(val).toLocaleString('en-PH');
}

function formatPeso(val: number): string {
  if (!Number.isFinite(val) || isNaN(val)) return '₱0';
  return `₱${Math.round(val).toLocaleString('en-PH')}`;
}

function formatPercent(val: number): string {
  if (!Number.isFinite(val) || isNaN(val) || val <= 0) return '0.00%';
  return `${val.toFixed(2)}%`;
}

function toTitleCase(val: string): string {
  const norm = String(val || '').trim().toUpperCase();
  if (norm === 'ALBAY') return 'Albay';
  if (norm === 'SORSOGON') return 'Sorsogon';
  if (norm === 'MASBATE') return 'Masbate';
  if (!norm) return '';
  return norm.charAt(0) + norm.slice(1).toLowerCase();
}

export const TopPerformingSliSection: React.FC<TopPerformingSliSectionProps> = ({
  rows,
  totalScopeJOs,
}) => {
  // Set of expanded SLI names for collapsible detail view
  const [expandedSliNames, setExpandedSliNames] = useState<Set<string>>(new Set());

  const toggleExpand = (sliName: string) => {
    setExpandedSliNames((prev) => {
      const next = new Set(prev);
      if (next.has(sliName)) {
        next.delete(sliName);
      } else {
        next.add(sliName);
      }
      return next;
    });
  };

  // Process and rank SLIs from filtered rows
  const { sliList, maxCount, validTotalScope } = useMemo(() => {
    const sliMap = new Map<
      string,
      {
        name: string;
        uniqueJOs: Set<string>;
        fiberXJOs: Set<string>;
        smeJOs: Set<string>;
        bidaJOs: Set<string>;
        s2sJOs: Set<string>;
        totalMrc: number;
        smeMrc: number;
        provinces: Set<string>;
        sliTypes: Set<string>;
      }
    >();

    // Denominator: Total unique JOs in the current filtered scope
    const denominator = Math.max(totalScopeJOs, rows.length);

    for (const r of rows) {
      const rawSli = r.sli ? String(r.sli).trim() : '';
      // Remove blank, null, whitespace-only values
      if (!rawSli) {
        continue;
      }

      if (!sliMap.has(rawSli)) {
        sliMap.set(rawSli, {
          name: rawSli,
          uniqueJOs: new Set(),
          fiberXJOs: new Set(),
          smeJOs: new Set(),
          bidaJOs: new Set(),
          s2sJOs: new Set(),
          totalMrc: 0,
          smeMrc: 0,
          provinces: new Set(),
          sliTypes: new Set(),
        });
      }

      const entry = sliMap.get(rawSli)!;

      // Unique JO number de-duplication per SLI
      if (!entry.uniqueJOs.has(r.joNumber)) {
        entry.uniqueJOs.add(r.joNumber);

        // Package breakdown (unique JO count)
        const pkg = String(r.package || '').toUpperCase();
        if (pkg.includes('FIBERX')) {
          entry.fiberXJOs.add(r.joNumber);
        } else if (pkg.includes('SME')) {
          entry.smeJOs.add(r.joNumber);
          entry.smeMrc += r.mrc || 0;
        } else if (pkg.includes('BIDA')) {
          entry.bidaJOs.add(r.joNumber);
        } else if (pkg.includes('S2S')) {
          entry.s2sJOs.add(r.joNumber);
        }

        // MRC per SLI from Column AE
        entry.totalMrc += r.mrc || 0;

        // Province tracking
        const provTitle = toTitleCase(r.province);
        if (provTitle) {
          entry.provinces.add(provTitle);
        }

        // SLI Type tracking
        const sType = String(r.sliType || '').toUpperCase().trim();
        if (sType === 'INHOUSE' || sType === 'MSA') {
          entry.sliTypes.add(sType);
        }
      }
    }

    // Convert map to list and compute share
    const list: SliMetricItem[] = Array.from(sliMap.values()).map((e) => {
      const totalCount = e.uniqueJOs.size;
      const share = denominator > 0 ? (totalCount / denominator) * 100 : 0;

      // Province display: 1 prov -> "Albay", 2 provs -> "Albay • Sorsogon", >2 -> "Multiple provinces"
      const provArray = Array.from(e.provinces).sort();
      let provinceDisplay = '';
      if (provArray.length === 1) {
        provinceDisplay = provArray[0];
      } else if (provArray.length === 2) {
        provinceDisplay = `${provArray[0]} • ${provArray[1]}`;
      } else if (provArray.length > 2) {
        provinceDisplay = 'Multiple provinces';
      } else {
        provinceDisplay = '—';
      }

      // SLI Type display: "INHOUSE", "MSA", or "INHOUSE • MSA"
      const typeArray = Array.from(e.sliTypes).sort();
      let sliTypeDisplay = '';
      if (typeArray.includes('INHOUSE') && typeArray.includes('MSA')) {
        sliTypeDisplay = 'INHOUSE • MSA';
      } else if (typeArray.includes('INHOUSE')) {
        sliTypeDisplay = 'INHOUSE';
      } else if (typeArray.includes('MSA')) {
        sliTypeDisplay = 'MSA';
      } else {
        sliTypeDisplay = '—';
      }

      return {
        name: e.name,
        total: totalCount,
        fiberX: e.fiberXJOs.size,
        sme: e.smeJOs.size,
        bida: e.bidaJOs.size,
        s2s: e.s2sJOs.size,
        totalMrc: e.totalMrc,
        smeMrc: e.smeMrc,
        provinces: provArray,
        provinceDisplay,
        sliTypes: typeArray,
        sliTypeDisplay,
        share,
      };
    });

    // Sort descending by unique JO count; alphabetical for ties
    list.sort((a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total;
      }
      return a.name.localeCompare(b.name);
    });

    const max = list.length > 0 ? list[0].total : 0;

    return {
      sliList: list,
      maxCount: max,
      validTotalScope: denominator,
    };
  }, [rows, totalScopeJOs]);

  return (
    <section
      id="top-performing-sli"
      className="bg-white border border-[#dcece6] rounded-[20px] p-6 shadow-sm mb-8"
    >
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between pb-5 border-b border-[#edf3f0] mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[#123b31]">
            TOP PERFORMING SLI
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            Activated JO performance by SLI partner.
          </p>
        </div>

        {sliList.length > 0 && (
          <div className="text-xs text-gray-500 font-semibold bg-[#f4f8f6] px-3.5 py-1.5 rounded-xl border border-[#dcece6]">
            {sliList.length} Active Partners • {formatCount(validTotalScope)} Total Filtered JOs
          </div>
        )}
      </div>

      {/* EMPTY DATA STATE */}
      {sliList.length === 0 ? (
        <div className="py-12 text-center text-gray-500 bg-[#fbfdfc] rounded-xl border border-dashed border-[#dcece6] my-2">
          <p className="font-semibold text-base text-gray-600">
            No SLI data available for the selected filters.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Try adjusting your province, SLI type, package, or report date filters.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden">
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 text-xs font-bold uppercase tracking-wider text-gray-500 pb-3 border-b border-[#edf3f0] px-3">
              <div className="col-span-1">RANK</div>
              <div className="col-span-3">SLI</div>
              <div className="col-span-2">SLI TYPE</div>
              <div className="col-span-2">PROVINCE</div>
              <div className="col-span-1 text-right">FIBERX</div>
              <div className="col-span-1 text-right">SME</div>
              <div className="col-span-1 text-right">BIDA</div>
              <div className="col-span-1 text-right">TOTAL</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[#edf3f0]">
              {sliList.map((item, index) => {
                const rank = index + 1;
                const isRank1 = rank === 1;
                const isExpanded = expandedSliNames.has(item.name);
                const barWidthPercent =
                  maxCount > 0 ? (item.total / maxCount) * 100 : 0;

                return (
                  <div
                    key={item.name}
                    className={`transition-colors duration-150 ${
                      isRank1
                        ? 'bg-[#f4faf7] hover:bg-[#ebf6f1]'
                        : 'hover:bg-[#fbfdfc]'
                    }`}
                  >
                    {/* Main Row Content */}
                    <div
                      onClick={() => toggleExpand(item.name)}
                      className="grid grid-cols-12 gap-3 items-center py-3.5 px-3 cursor-pointer text-sm select-none"
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex items-center gap-1.5">
                        {isRank1 ? (
                          <span className="inline-flex items-center justify-center bg-[#0a8a64] text-white font-extrabold text-xs px-2 py-0.5 rounded-md shadow-2xs">
                            #1
                          </span>
                        ) : (
                          <span className="text-gray-500 font-semibold text-xs px-1.5 py-0.5 rounded bg-gray-100">
                            #{rank}
                          </span>
                        )}
                      </div>

                      {/* SLI Name & Bar */}
                      <div className="col-span-3 pr-2">
                        <div
                          className={`font-semibold tracking-tight ${
                            isRank1 ? 'text-[#0a684d] font-bold text-[15px]' : 'text-[#123b31]'
                          }`}
                        >
                          {item.name}
                        </div>
                        {/* Horizontal Performance Bar */}
                        <div className="w-full max-w-[220px] bg-[#e4ede8] h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="bg-[#0aa37a] h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(barWidthPercent, 2)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* SLI Type */}
                      <div className="col-span-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            item.sliTypeDisplay.includes('INHOUSE') &&
                            item.sliTypeDisplay.includes('MSA')
                              ? 'bg-[#eef4f1] text-[#123b31] border border-[#cfe4da]'
                              : item.sliTypeDisplay === 'INHOUSE'
                              ? 'bg-[#e8f5f1] text-[#0a684d] border border-[#cfe4da]'
                              : 'bg-[#edf4fc] text-[#1d4ed8] border border-[#cfe0fa]'
                          }`}
                        >
                          {item.sliTypeDisplay}
                        </span>
                      </div>

                      {/* Province */}
                      <div className="col-span-2 text-xs font-medium text-gray-600">
                        {item.provinceDisplay}
                      </div>

                      {/* FiberX */}
                      <div className="col-span-1 text-right font-medium text-gray-700">
                        {formatCount(item.fiberX)}
                      </div>

                      {/* SME */}
                      <div className="col-span-1 text-right font-medium text-gray-700">
                        {formatCount(item.sme)}
                      </div>

                      {/* BIDA */}
                      <div className="col-span-1 text-right font-medium text-gray-700">
                        {formatCount(item.bida)}
                      </div>

                      {/* Total & Share with Toggle */}
                      <div className="col-span-1 text-right flex items-center justify-end gap-2">
                        <div>
                          <div className="font-extrabold text-[#123b31] text-[15px]">
                            {formatCount(item.total)}
                          </div>
                          <div className="text-[11px] font-semibold text-[#0a8a64]">
                            {formatPercent(item.share)}
                          </div>
                        </div>
                        <button
                          type="button"
                          aria-label={`Toggle details for ${item.name}`}
                          className="text-gray-400 hover:text-gray-600 p-0.5 transition-transform"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDABLE DETAIL DRAWER */}
                    {isExpanded && (
                      <div className="bg-[#f8faf9] border-t border-[#e2eee8] px-5 py-4 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-start">
                          <div>
                            <span className="text-gray-400 block font-medium">SLI Partner</span>
                            <span className="font-bold text-[#123b31] text-sm mt-0.5 block">
                              {item.name}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">Total Unique JOs</span>
                            <span className="font-bold text-[#123b31] text-sm mt-0.5 block">
                              {formatCount(item.total)} ({formatPercent(item.share)})
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">FiberX Activations</span>
                            <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
                              {formatCount(item.fiberX)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">SME Activations</span>
                            <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
                              {formatCount(item.sme)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">BIDA Activations</span>
                            <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
                              {formatCount(item.bida)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">Total MRC</span>
                            <span className="font-bold text-[#0a684d] text-sm mt-0.5 block">
                              {formatPeso(item.totalMrc)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">SME MRC</span>
                            <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
                              {formatPeso(item.smeMrc)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">Coverage Area</span>
                            <span className="font-medium text-gray-700 mt-0.5 block">
                              {item.provinceDisplay} ({item.sliTypeDisplay})
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* MOBILE VIEW (CARDS & EXPANDABLE DETAILS) */}
          <div className="md:hidden divide-y divide-[#edf3f0]">
            {sliList.map((item, index) => {
              const rank = index + 1;
              const isRank1 = rank === 1;
              const isExpanded = expandedSliNames.has(item.name);
              const barWidthPercent =
                maxCount > 0 ? (item.total / maxCount) * 100 : 0;

              return (
                <div
                  key={item.name}
                  className={`py-3.5 ${
                    isRank1 ? 'bg-[#f4faf7] -mx-4 px-4 rounded-xl' : ''
                  }`}
                >
                  <div
                    onClick={() => toggleExpand(item.name)}
                    className="cursor-pointer select-none space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isRank1 ? (
                          <span className="bg-[#0a8a64] text-white font-extrabold text-xs px-2 py-0.5 rounded shadow-2xs">
                            #1
                          </span>
                        ) : (
                          <span className="text-gray-500 font-semibold text-xs px-1.5 py-0.5 rounded bg-gray-100">
                            #{rank}
                          </span>
                        )}
                        <span
                          className={`font-semibold text-sm ${
                            isRank1 ? 'text-[#0a684d] font-bold' : 'text-[#123b31]'
                          }`}
                        >
                          {item.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="font-bold text-[#123b31] text-sm">
                            {formatCount(item.total)}
                          </span>
                          <span className="text-xs text-[#0a8a64] font-semibold ml-1.5">
                            ({formatPercent(item.share)})
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Progress Bar on Mobile */}
                    <div className="w-full bg-[#e4ede8] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#0aa37a] h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(barWidthPercent, 2)}%` }}
                      />
                    </div>
                  </div>

                  {/* Expanded Detail on Mobile */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-[#e2eee8] bg-[#f8faf9] rounded-xl p-3 text-xs space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-gray-400 block font-medium">SLI Type</span>
                          <span className="font-semibold text-gray-800">{item.sliTypeDisplay}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">Province</span>
                          <span className="font-semibold text-gray-800">{item.provinceDisplay}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">FiberX</span>
                          <span className="font-semibold text-gray-800">{formatCount(item.fiberX)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">SME</span>
                          <span className="font-semibold text-gray-800">{formatCount(item.sme)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">BIDA</span>
                          <span className="font-semibold text-gray-800">{formatCount(item.bida)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">Total MRC</span>
                          <span className="font-bold text-[#0a684d]">{formatPeso(item.totalMrc)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
