import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ParsedJO, SliPivotDetailRow } from '../types';
import { aggregateSliPivotDetailRows } from '../services/sliPivotService';

export interface TopPerformingSliSectionProps {
  rows: ParsedJO[];
  totalScopeJOs: number;
  pivotRows?: SliPivotDetailRow[];
  pivotAvailable?: boolean;
  pivotSource?: string;
  monthName?: string;
  filterProvince?: string;
  filterSliType?: string;
  filterPackage?: string;
}

interface DisplayRankingItem {
  key: string;
  name: string;
  sliType: 'INHOUSE' | 'MSA';
  count: number;
  fiberX: number;
  sme: number;
  bida: number;
  mrc: number;
  share: number;
  provinceDisplay: string;
  provinces: string[];
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
  pivotRows,
  pivotAvailable = true,
  pivotSource,
  monthName = 'September 2026',
  filterProvince = 'All districts',
  filterSliType = 'All SLI Types',
  filterPackage = 'All Packages',
}) => {
  // Set of expanded composite keys (${sliType}|||${name}) for collapsible detail view
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Map MRC from raw rows by key: `${sliType}|||${sli.toUpperCase()}`
  const mrcByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const type = (r.sliType || '').toUpperCase();
      const sli = (r.sli || '').toUpperCase();
      if (!type || !sli) continue;
      const k = `${type}|||${sli}`;
      map.set(k, (map.get(k) || 0) + Number(r.mrc || 0));
    }
    return map;
  }, [rows]);

  // Fallback ranking calculation from deduplicated unique JO rows
  const fallbackList: DisplayRankingItem[] = useMemo(() => {
    const seen = new Set<string>();
    const deduplicated: ParsedJO[] = [];
    for (const r of rows) {
      const jo = String(r.joNumber || (r as any)['JO NUMBER'] || '').trim();
      if (!jo || seen.has(jo)) continue;
      seen.add(jo);
      deduplicated.push(r);
    }

    const map = new Map<
      string,
      {
        name: string;
        sliType: 'INHOUSE' | 'MSA';
        count: number;
        fiberX: number;
        sme: number;
        bida: number;
        mrc: number;
        provinces: Set<string>;
      }
    >();

    for (const row of deduplicated) {
      let sliName = String(row.sli ?? '').trim().replace(/\s+/g, ' ');
      const sliType = String(row.sliType ?? '').trim().toUpperCase();

      if (sliType !== 'INHOUSE' && sliType !== 'MSA') {
        continue;
      }

      if (!sliName) {
        const vendor = String(row.vendorType ?? '').toUpperCase();
        if (vendor === 'MSA' || sliType === 'MSA') {
          sliName = 'RAVENOUS SLR';
        } else {
          continue;
        }
      }

      const key = `${sliType}|||${sliName.toUpperCase()}`;
      if (!map.has(key)) {
        map.set(key, {
          name: sliName,
          sliType: sliType as 'INHOUSE' | 'MSA',
          count: 0,
          fiberX: 0,
          sme: 0,
          bida: 0,
          mrc: 0,
          provinces: new Set<string>(),
        });
      }

      const item = map.get(key)!;
      item.count += 1;
      item.mrc += Number(row.mrc || 0);

      const pkg = String(row.package || '').toUpperCase();
      if (pkg === 'FIBERX' || pkg.includes('FIBERX')) {
        item.fiberX += 1;
      } else if (pkg === 'SME' || pkg.includes('SME')) {
        item.sme += 1;
      } else if (pkg === 'BIDA' || pkg.includes('BIDA')) {
        item.bida += 1;
      }

      if (row.province) {
        item.provinces.add(row.province);
      }
    }

    const ranking = Array.from(map.values()).sort(
      (a, b) =>
        b.count - a.count ||
        a.sliType.localeCompare(b.sliType) ||
        a.name.localeCompare(b.name)
    );

    const denominator = Math.max(totalScopeJOs, deduplicated.length);

    return ranking.map((item) => {
      const share = denominator > 0 ? (item.count / denominator) * 100 : 0;
      const provArray = Array.from(item.provinces)
        .map((p: string) => toTitleCase(p))
        .filter(Boolean);
      const uniqueProvs = Array.from(new Set(provArray)).sort();
      let provinceDisplay = '—';
      if (uniqueProvs.length === 1) {
        provinceDisplay = uniqueProvs[0];
      } else if (uniqueProvs.length === 2) {
        provinceDisplay = `${uniqueProvs[0]} • ${uniqueProvs[1]}`;
      } else if (uniqueProvs.length > 2) {
        provinceDisplay = 'Multiple provinces';
      }

      return {
        key: `${item.sliType}|||${item.name.toUpperCase()}`,
        name: item.name,
        sliType: item.sliType,
        count: item.count,
        fiberX: item.fiberX,
        sme: item.sme,
        bida: item.bida,
        mrc: item.mrc,
        share,
        provinceDisplay,
        provinces: uniqueProvs,
      };
    });
  }, [rows, totalScopeJOs]);

  // Primary source of truth: aggregate from live spreadsheet pivot detail rows
  const displayList: DisplayRankingItem[] = useMemo(() => {
    if (pivotRows && pivotRows.length > 0) {
      const { groups } = aggregateSliPivotDetailRows(pivotRows, {
        province: filterProvince,
        sliType: filterSliType,
        package: filterPackage,
      });

      return groups.map((g) => ({
        key: g.key,
        name: g.name,
        sliType: g.sliType,
        count: g.total,
        fiberX: g.fiberX,
        sme: g.sme,
        bida: g.bida,
        mrc: mrcByKey.get(g.key) || 0,
        share: g.share,
        provinceDisplay: g.provinceDisplay,
        provinces: g.provinces,
      }));
    }

    // Fallback if pivot is still loading or not yet ready
    return fallbackList;
  }, [
    pivotRows,
    filterProvince,
    filterSliType,
    filterPackage,
    fallbackList,
    mrcByKey,
  ]);

  const maxCount = displayList.length > 0 ? displayList[0].count : 0;
  const totalFilteredJOs = useMemo(
    () => displayList.reduce((sum, item) => sum + item.count, 0),
    [displayList]
  );

  return (
    <section
      id="top-performing-sli"
      className="bg-white border border-[#dcece6] rounded-[20px] p-6 shadow-sm mb-8"
    >
      {/* SECTION HEADER */}
      <div className="flex items-center justify-between pb-5 border-b border-[#edf3f0] mb-5 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">
              TOP PERFORMING SLI
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#dff7ec] text-[#0a684d] border border-[#b5e6d0]">
              {pivotSource || `SLI ACTIVATION - ${monthName.toUpperCase()}`}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 font-medium">
            Activated JO performance by SLI partner.
          </p>
        </div>

        {displayList.length > 0 && pivotAvailable && (
          <div className="text-xs text-gray-500 font-semibold bg-[#f4f8f6] px-3.5 py-1.5 rounded-xl border border-[#dcece6]">
            {displayList.length} Active Records • {formatCount(totalFilteredJOs)} Total Filtered JOs
          </div>
        )}
      </div>

      {/* MONTH PIVOT NOT AVAILABLE STATE */}
      {!pivotAvailable ? (
        <div className="py-12 text-center text-gray-500 bg-[#fbfdfc] rounded-xl border border-dashed border-[#dcece6] my-2">
          <p className="font-semibold text-base text-gray-700">
            No SLI activation pivot available for this month.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Selected month: {monthName}. The spreadsheet does not contain a monthly pivot tab for this period.
          </p>
        </div>
      ) : displayList.length === 0 ? (
        /* EMPTY DATA STATE FOR SELECTED FILTERS */
        <div className="py-12 text-center text-gray-500 bg-[#fbfdfc] rounded-xl border border-dashed border-[#dcece6] my-2">
          <p className="font-semibold text-base text-gray-600">
            No SLI data available for the selected filters.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Try adjusting your province, SLI type, or package filters.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden">
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden md:block">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 pb-3 border-b border-[#edf3f0] px-3">
              <div className="col-span-1">RANK</div>
              <div className="col-span-3">SLI</div>
              <div className="col-span-2">SLI TYPE</div>
              <div className="col-span-1">PROVINCE</div>
              <div className="col-span-1 text-right">FIBERX</div>
              <div className="col-span-1 text-right">SME</div>
              <div className="col-span-1 text-right">BIDA</div>
              <div className="col-span-1 text-right">TOTAL</div>
              <div className="col-span-1 text-right">SHARE</div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[#edf3f0]">
              {displayList.map((item, index) => {
                const rank = index + 1;
                const isRank1 = rank === 1;
                const isExpanded = expandedKeys.has(item.key);
                const barWidthPercent =
                  maxCount > 0 ? (item.count / maxCount) * 100 : 0;

                return (
                  <div
                    key={item.key}
                    className={`transition-colors duration-150 ${
                      isRank1
                        ? 'bg-[#f4faf7] hover:bg-[#ebf6f1]'
                        : 'hover:bg-[#fbfdfc]'
                    }`}
                  >
                    {/* Main Row Content */}
                    <div
                      onClick={() => toggleExpand(item.key)}
                      className="grid grid-cols-12 gap-2 items-center py-3.5 px-3 cursor-pointer text-sm select-none"
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
                            isRank1
                              ? 'text-[#0a684d] font-bold text-[15px]'
                              : 'text-[#123b31]'
                          }`}
                        >
                          {item.name}
                        </div>
                        {/* Horizontal Thin Green Performance Bar */}
                        <div className="w-full max-w-[220px] bg-[#e4ede8] h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="bg-[#0aa37a] h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(barWidthPercent, 2)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* SLI Type: EXACTLY ONE small badge per row [INHOUSE] or [MSA] */}
                      <div className="col-span-2">
                        {item.sliType === 'INHOUSE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#e8f5f1] text-[#0a684d] border border-[#cfe4da]">
                            [INHOUSE]
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#edf4fc] text-[#1d4ed8] border border-[#cfe0fa]">
                            [MSA]
                          </span>
                        )}
                      </div>

                      {/* Province: Specific to this SLI TYPE + SLI partner */}
                      <div
                        className="col-span-1 text-xs font-medium text-gray-600 truncate"
                        title={item.provinceDisplay}
                      >
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

                      {/* Total */}
                      <div className="col-span-1 text-right font-extrabold text-[#123b31] text-[15px]">
                        {formatCount(item.count)}
                      </div>

                      {/* Share with Toggle */}
                      <div className="col-span-1 text-right flex items-center justify-end gap-1.5">
                        <span className="text-xs font-bold text-[#0a8a64]">
                          {formatPercent(item.share)}
                        </span>
                        <button
                          type="button"
                          aria-label={`Toggle details for ${item.name} (${item.sliType})`}
                          className="text-gray-400 hover:text-gray-600 p-0.5 transition-transform cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDABLE DETAIL DRAWER */}
                    {isExpanded && (
                      <div className="bg-[#f8faf9] border-t border-[#e2eee8] px-5 py-4 text-xs">
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 items-start">
                          <div>
                            <span className="text-gray-400 block font-medium">
                              SLI Partner
                            </span>
                            <span className="font-bold text-[#123b31] text-sm mt-0.5 block">
                              {item.name}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">
                              SLI Type
                            </span>
                            <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
                              [{item.sliType}]
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">
                              Coverage Area
                            </span>
                            <span className="font-medium text-gray-700 mt-0.5 block">
                              {item.provinceDisplay}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">
                              FiberX
                            </span>
                            <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
                              {formatCount(item.fiberX)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">
                              SME
                            </span>
                            <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
                              {formatCount(item.sme)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">
                              BIDA
                            </span>
                            <span className="font-semibold text-gray-800 text-sm mt-0.5 block">
                              {formatCount(item.bida)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-400 block font-medium">
                              Total Activations
                            </span>
                            <span className="font-bold text-[#123b31] text-sm mt-0.5 block">
                              {formatCount(item.count)} ({formatPercent(item.share)})
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
            {displayList.map((item, index) => {
              const rank = index + 1;
              const isRank1 = rank === 1;
              const isExpanded = expandedKeys.has(item.key);
              const barWidthPercent =
                maxCount > 0 ? (item.count / maxCount) * 100 : 0;

              return (
                <div
                  key={item.key}
                  className={`py-3.5 ${
                    isRank1 ? 'bg-[#f4faf7] -mx-4 px-4 rounded-xl' : ''
                  }`}
                >
                  <div
                    onClick={() => toggleExpand(item.key)}
                    className="cursor-pointer select-none space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {isRank1 ? (
                          <span className="bg-[#0a8a64] text-white font-extrabold text-xs px-2 py-0.5 rounded shadow-2xs mt-0.5">
                            #1
                          </span>
                        ) : (
                          <span className="text-gray-500 font-semibold text-xs px-1.5 py-0.5 rounded bg-gray-100 mt-0.5">
                            #{rank}
                          </span>
                        )}
                        <div>
                          <div
                            className={`font-semibold text-sm ${
                              isRank1
                                ? 'text-[#0a684d] font-bold'
                                : 'text-[#123b31]'
                            }`}
                          >
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {item.sliType === 'INHOUSE' ? (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#e8f5f1] text-[#0a684d] border border-[#cfe4da]">
                                [INHOUSE]
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#edf4fc] text-[#1d4ed8] border border-[#cfe0fa]">
                                [MSA]
                              </span>
                            )}
                            <span className="text-xs text-gray-500 font-medium">
                              {item.provinceDisplay}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="font-bold text-[#123b31] text-sm">
                            {formatCount(item.count)}
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
                          <span className="text-gray-400 block font-medium">
                            SLI Type
                          </span>
                          <span className="font-semibold text-gray-800">
                            [{item.sliType}]
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">
                            Province
                          </span>
                          <span className="font-semibold text-gray-800">
                            {item.provinceDisplay}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">
                            FiberX
                          </span>
                          <span className="font-semibold text-gray-800">
                            {formatCount(item.fiberX)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">
                            SME
                          </span>
                          <span className="font-semibold text-gray-800">
                            {formatCount(item.sme)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">
                            BIDA
                          </span>
                          <span className="font-semibold text-gray-800">
                            {formatCount(item.bida)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-medium">
                            Total Activations
                          </span>
                          <span className="font-bold text-[#123b31]">
                            {formatCount(item.count)} ({formatPercent(item.share)})
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
      )}
    </section>
  );
};
export default TopPerformingSliSection;
