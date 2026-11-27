import React, { useState, useMemo } from 'react';
import {
  Layers,
  Filter,
  Search,
  Database,
  CheckCircle2,
  Download,
  RotateCcw,
  Sparkles,
  ArrowUpDown,
  Building2,
  Radio,
  Package as PackageIcon,
  Calendar,
} from 'lucide-react';
import { GroupCombinationResult, GroupingFilters } from '../utils/groupingEngine';
import { SummaryAggregates } from '../utils/calculations';

interface GroupingMatrixViewProps {
  aggregates: SummaryAggregates;
  fileName?: string;
  sheetName?: string;
  isSynced?: boolean;
}

export const GroupingMatrixView: React.FC<GroupingMatrixViewProps> = ({
  aggregates,
  fileName = 'JO ACTIVATED (Spreadsheet)',
  sheetName = 'JO ACTIVATED',
  isSynced = false,
}) => {
  const groupingResult = aggregates.groupingEngineResult;

  const [provinceFilter, setProvinceFilter] = useState<string>('ALL');
  const [sliTypeFilter, setSliTypeFilter] = useState<string>('ALL');
  const [packageFilter, setPackageFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'province' | 'sliType' | 'packageName' | 'monthActivated' | 'count' | 'totalMrc'>('count');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const filterOptions = useMemo(() => {
    return {
      provinces: groupingResult?.provinces || ['ALBAY', 'MASBATE', 'SORSOGON'],
      sliTypes: groupingResult?.sliTypes || ['INHOUSE', 'MSA'],
      packages: groupingResult?.packages || ['FIBERX', 'SME', 'BIDA', 'S2S'],
      months: groupingResult?.months || ['September'],
    };
  }, [groupingResult]);

  const filteredCombinations = useMemo(() => {
    if (!groupingResult) return [];

    const activeFilters: GroupingFilters = {
      province: provinceFilter,
      sliType: sliTypeFilter,
      packageName: packageFilter,
      monthActivated: monthFilter,
    };

    const { filteredCombinations } = groupingResult.filterResults(activeFilters);

    let list = [...filteredCombinations];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.province.toLowerCase().includes(q) ||
          c.sliType.toLowerCase().includes(q) ||
          c.packageName.toLowerCase().includes(q) ||
          c.monthActivated.toLowerCase().includes(q) ||
          c.key.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [groupingResult, provinceFilter, sliTypeFilter, packageFilter, monthFilter, searchQuery, sortField, sortAsc]);

  const totalFilteredCount = useMemo(() => {
    return filteredCombinations.reduce((sum, c) => sum + c.count, 0);
  }, [filteredCombinations]);

  const totalFilteredMrc = useMemo(() => {
    return filteredCombinations.reduce((sum, c) => sum + c.totalMrc, 0);
  }, [filteredCombinations]);

  const handleResetFilters = () => {
    setProvinceFilter('ALL');
    setSliTypeFilter('ALL');
    setPackageFilter('ALL');
    setMonthFilter('ALL');
    setSearchQuery('');
  };

  const handleExportCsv = () => {
    const headers = ['Province (Col G)', 'SLI Type (Col S)', 'Package (Col AC)', 'Month Activated (Col AA)', 'Count', 'Total MRC (Col AE)', 'Grouping Key'];
    const rows = filteredCombinations.map((c) => [
      c.province,
      c.sliType,
      c.packageName,
      c.monthActivated,
      c.count,
      c.totalMrc,
      `"${c.key}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Almasor_JO_Activated_Groupings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div id="grouping-matrix-section" className="space-y-6">
      {/* Informative Banner */}
      <div className="bg-gradient-to-r from-teal-900/90 via-slate-900 to-indigo-950 rounded-2xl border border-teal-500/30 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-radial from-teal-500/10 to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-300 text-xs font-semibold mb-2">
              <Database className="w-3.5 h-3.5" />
              <span>Raw Spreadsheet Source of Truth: {sheetName}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <Layers className="w-6 h-6 text-teal-400" />
              Dynamic JO ACTIVATED Counting & Grouping Engine
            </h2>
            <p className="text-slate-300 text-sm mt-1 max-w-3xl leading-relaxed">
              Every row is automatically aggregated from raw columns:{' '}
              <strong className="text-teal-300">Col G (STATEORPROVINCE)</strong> ×{' '}
              <strong className="text-teal-300">Col S (SLI TYPE)</strong> ×{' '}
              <strong className="text-teal-300">Col AC (PACKAGE)</strong> ×{' '}
              <strong className="text-teal-300">Col AA (MONTH ACTIVATED)</strong>.
              Zero report-sheet cell references (no C5, B8, C9, D7). Dynamically updates on Excel / Google Sheet sync.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-center">
            <button
              id="export-groupings-btn"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium shadow-md transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60 text-xs">
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
            <span className="text-slate-400 block mb-0.5">Total Raw Records</span>
            <span className="text-xl font-bold text-white font-mono">{groupingResult?.totalRecords || aggregates.totalRecords}</span>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
            <span className="text-slate-400 block mb-0.5">FiberX Count (Col AC)</span>
            <span className="text-xl font-bold text-emerald-400 font-mono">{groupingResult?.totalFiberX || aggregates.fiberXCount}</span>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
            <span className="text-slate-400 block mb-0.5">SME Total MRC (Col AE)</span>
            <span className="text-xl font-bold text-cyan-400 font-mono">₱{(groupingResult?.totalSmeMrc || aggregates.smeAmountVatInc).toLocaleString()}</span>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/50">
            <span className="text-slate-400 block mb-0.5">Unique Combinations</span>
            <span className="text-xl font-bold text-amber-400 font-mono">{groupingResult?.combinations.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Filters Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold text-sm">
            <Filter className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>Dynamic Multi-Column Filters</span>
            <span className="text-xs text-slate-500 font-normal ml-1">
              (Filter the raw combinations by any combination of attributes)
            </span>
          </div>

          {(provinceFilter !== 'ALL' || sliTypeFilter !== 'ALL' || packageFilter !== 'ALL' || monthFilter !== 'ALL' || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:underline font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Province Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Province (Col G)</span>
            </label>
            <select
              id="filter-province-select"
              value={provinceFilter}
              onChange={(e) => setProvinceFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Provinces (Almasor)</option>
              {filterOptions.provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* SLI Type Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-slate-500" />
              <span>SLI Type (Col S)</span>
            </label>
            <select
              id="filter-slitype-select"
              value={sliTypeFilter}
              onChange={(e) => setSliTypeFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All SLI Types (Inhouse & MSA)</option>
              {filterOptions.sliTypes.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Package Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <PackageIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>Package (Col AC)</span>
            </label>
            <select
              id="filter-package-select"
              value={packageFilter}
              onChange={(e) => setPackageFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Packages</option>
              {filterOptions.packages.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>
          </div>

          {/* Month Activated Filter */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Month Activated (Col AA)</span>
            </label>
            <select
              id="filter-month-select"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
            >
              <option value="ALL">All Months</option>
              {filterOptions.months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <span>Search Groupings</span>
            </label>
            <div className="relative">
              <input
                id="search-grouping-input"
                type="text"
                placeholder="Search province, package..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Results Summary Strip */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Filtered Aggregation:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-800 dark:text-teal-300 font-bold font-mono">
              {totalFilteredCount} Total JOs
            </span>
            {totalFilteredMrc > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-800 dark:text-cyan-300 font-bold font-mono">
                ₱{totalFilteredMrc.toLocaleString()} MRC
              </span>
            )}
            <span className="text-slate-500 dark:text-slate-400">
              across {filteredCombinations.length} unique combinations
            </span>
          </div>

          <div className="text-slate-500 dark:text-slate-400">
            {packageFilter === 'FIBERX' && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ FiberX verified count: {totalFilteredCount}
              </span>
            )}
            {packageFilter === 'SME' && (
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">
                ✓ SME MRC Sum: ₱{totalFilteredMrc.toLocaleString()} ({totalFilteredCount} packages)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grouped Combinations Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Unique Combination Breakdown</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                {filteredCombinations.length} rows
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any column header to toggle ascending/descending sort.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100/80 dark:bg-slate-800/70 uppercase text-[11px] font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/60">
              <tr>
                <th
                  onClick={() => handleSort('province')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Province (Col G)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('sliType')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>SLI Type (Col S)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('packageName')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Package (Col AC)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('monthActivated')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Month (Col AA)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('count')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Count</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalMrc')}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total MRC</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Share</th>
                <th className="px-4 py-3">Grouping Key</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {filteredCombinations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No combinations match the current filter selection.
                  </td>
                </tr>
              ) : (
                filteredCombinations.map((c, idx) => {
                  const sharePct = totalFilteredCount > 0 ? ((c.count / totalFilteredCount) * 100).toFixed(1) : '0';
                  return (
                    <tr
                      key={c.key}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {c.province}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            c.sliType === 'INHOUSE'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                          }`}
                        >
                          {c.sliType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                            c.category === 'FIBERX'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : c.category === 'SME'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : c.category === 'BIDA'
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                              : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {c.packageName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {c.monthActivated}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white text-sm">
                        {c.count}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                        {c.totalMrc > 0 ? `₱${c.totalMrc.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-500 dark:text-slate-400">
                        {sharePct}%
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700/60">
                          {c.key}
                        </code>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filteredCombinations.length > 0 && (
              <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-semibold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-700">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase text-slate-500">
                    Filtered Total:
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-base font-bold text-teal-600 dark:text-teal-400">
                    {totalFilteredCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-cyan-600 dark:text-cyan-400">
                    ₱{totalFilteredMrc.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-500">100%</td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {filteredCombinations.length} unique combinations
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
