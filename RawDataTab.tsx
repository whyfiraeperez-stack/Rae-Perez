import React, { useState, useMemo } from 'react';
import { JORecord, Province, SliType, PackageCategory, SyncSourceInfo } from '../types';
import { Search, Filter, Download, Plus, ChevronLeft, ChevronRight, FileSpreadsheet, Eye, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

interface RawDataTabProps {
  records: JORecord[];
  onOpenAddModal: () => void;
  onOpenImportModal?: () => void;
  syncSourceInfo?: SyncSourceInfo | null;
}

export const RawDataTab: React.FC<RawDataTabProps> = ({ records, onOpenAddModal, onOpenImportModal, syncSourceInfo }) => {
  const [search, setSearch] = useState('');
  const [provinceFilter, setProvinceFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (provinceFilter !== 'ALL' && r.stateOrProvince !== provinceFilter) return false;
      if (typeFilter !== 'ALL' && r.sliType !== typeFilter) return false;
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.joNumber.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.barangayName.toLowerCase().includes(q) ||
          r.packageName.toLowerCase().includes(q) ||
          r.agentCode.toLowerCase().includes(q) ||
          r.cpeSerialNo.toLowerCase().includes(q) ||
          r.vendor.toLowerCase().includes(q) ||
          r.crew.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [records, search, provinceFilter, typeFilter, categoryFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginated = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportExcel = () => {
    const dataToExport = filteredRecords.map((r) => ({
      'JO NUMBER': r.joNumber,
      'STATEORPROVINCE': r.stateOrProvince,
      'CITY': r.city,
      'BARANGAY_NAME': r.barangayName,
      'PACKAGE_NAME': r.packageName,
      'NAP CODE': r.napCode,
      'NAP PORT': r.napPort,
      'CREW': r.crew,
      'CPE_SERIALNO': r.cpeSerialNo,
      'AGENT CODE': r.agentCode,
      'SLI SYSTEM CHECK_CREW CODE': r.sliSystemCheckCrewCode,
      'SLI': r.sli,
      'SLI TYPE': r.sliType,
      'VENDOR': r.vendor,
      'VENDOR TYPE': r.vendorType,
      'CATEGORY': r.category,
      'ACTIVATION DATE': r.activationDate,
      'STATUS': r.status,
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'JO ACTIVATED');
    XLSX.writeFile(wb, 'ALMASOR_SLI_MONITORING_JO_ACTIVATED.xlsx');
  };

  return (
    <div id="raw-data-view" className="space-y-4">
      {/* Top Banner styled like Google Sheets from Photo 4 */}
      <div className="bg-white border border-[#dce7e1] rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e9f1ed] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black shadow-sm">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  ALMASOR SLI MONITORING
                </span>
                <span className="text-xs text-[#5f8173] font-medium">
                  &gt; File: <strong className="text-[#103728]">{syncSourceInfo?.fileName || 'ALMASOR SLI MONITORING.xlsx'}</strong> | Sheet: <strong className="text-[#103728]">{syncSourceInfo?.sheetName || 'JO ACTIVATED'}</strong>
                </span>
              </div>
              <h2 className="text-xl font-bold text-[#0f2e22] mt-0.5">
                Raw Activated JO Database
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenImportModal && (
              <button
                id="import-raw-excel-btn"
                onClick={onOpenImportModal}
                className="flex items-center gap-2 bg-[#ecf6f0] hover:bg-[#dcefe3] text-[#0f3d2c] border border-[#b8dec8] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>Import Excel / Sheet</span>
              </button>
            )}

            <button
              id="export-raw-excel-btn"
              onClick={exportExcel}
              className="flex items-center gap-2 bg-[#f2f8f5] hover:bg-[#e4efe9] text-[#124231] border border-[#cbe1d5] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export XLSX ({filteredRecords.length})</span>
            </button>

            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-1.5 bg-[#144c38] hover:bg-[#0f3d2c] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add JO</span>
            </button>
          </div>
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 text-[#75988b] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search JO, city, agent, serial, vendor..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-[#f8faf9] border border-[#d5e4dc] text-xs rounded-xl pl-9 pr-3.5 py-2 text-[#133e2f] placeholder-[#8ca99f] focus:outline-hidden focus:border-emerald-600 focus:bg-white"
              />
            </div>

            {/* Province selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#527668]">
              <span className="font-semibold">Province:</span>
              <select
                value={provinceFilter}
                onChange={(e) => {
                  setProvinceFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter province"
                className="bg-[#f8faf9] border border-[#d5e4dc] text-xs font-semibold rounded-lg px-2.5 py-1.5 text-[#133e2f] focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Provinces</option>
                <option value="ALBAY">Albay</option>
                <option value="SORSOGON">Sorsogon</option>
                <option value="MASBATE">Masbate</option>
              </select>
            </div>

            {/* Type selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#527668]">
              <span className="font-semibold">SLI Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter SLI type"
                className="bg-[#f8faf9] border border-[#d5e4dc] text-xs font-semibold rounded-lg px-2.5 py-1.5 text-[#133e2f] focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="INHOUSE">INHOUSE</option>
                <option value="MSA">MSA</option>
              </select>
            </div>

            {/* Category selector */}
            <div className="flex items-center gap-1.5 text-xs text-[#527668]">
              <span className="font-semibold">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Filter category"
                className="bg-[#f8faf9] border border-[#d5e4dc] text-xs font-semibold rounded-lg px-2.5 py-1.5 text-[#133e2f] focus:outline-hidden cursor-pointer"
              >
                <option value="ALL">All Packages</option>
                <option value="FIBERX">FiberX</option>
                <option value="SME">SME</option>
                <option value="BIDA">BIDA</option>
                <option value="S2S">S2S</option>
              </select>
            </div>
          </div>

          {/* Counts count badge */}
          <div className="text-xs text-[#53786a] font-medium">
            Showing <strong className="text-[#103728]">{filteredRecords.length}</strong> of {records.length} records
          </div>
        </div>
      </div>

      {/* Spreadsheet Table matching Photo 4 */}
      <div className="bg-white border border-[#dce7e1] rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[640px] text-[11px]">
          <table id="jo-activated-table" className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-[#e2ede7] text-[#133d2e] font-bold border-b border-[#cbdcd2] uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">#</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">JO NUMBER</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">STATEORPROVINCE</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">CITY</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">BARANGAY_NAME</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">PACKAGE_NAME</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">NAP CODE</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">NAP PORT</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">CREW</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">CPE_SERIALNO</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">AGENT CODE</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">SLI SYSTEM CHECK_CREW</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">SLI</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">SLI TYPE</th>
                <th className="py-2.5 px-3 border-r border-[#cbdcd2]">VENDOR</th>
                <th className="py-2.5 px-3">VENDOR TYPE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf3f0] text-[#193d30]">
              {paginated.map((r, i) => {
                const rowNum = (currentPage - 1) * pageSize + i + 1;
                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-[#eaf4ef] transition-colors ${
                      i % 2 === 0 ? 'bg-white' : 'bg-[#fbfdfb]'
                    }`}
                  >
                    <td className="py-2 px-3 border-r border-[#edf3f0] text-[#789a8e] font-mono text-[10px]">
                      {rowNum}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-mono font-bold text-emerald-950">
                      {r.joNumber}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-semibold">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          r.stateOrProvince === 'ALBAY'
                            ? 'bg-blue-50 text-blue-800'
                            : r.stateOrProvince === 'SORSOGON'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-purple-50 text-purple-800'
                        }`}
                      >
                        {r.stateOrProvince}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0]">{r.city}</td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] text-[#4d7063]">
                      {r.barangayName}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-medium text-[#11382b]">
                      {r.packageName}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-mono text-[10px] text-[#4b6f62]">
                      {r.napCode}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-mono text-[10px]">
                      {r.napPort}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-mono font-semibold text-emerald-900">
                      {r.crew}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-mono text-[10px] text-[#55786b]">
                      {r.cpeSerialNo}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] text-[#224438]">
                      {r.agentCode}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] text-[#335649]">
                      {r.sliSystemCheckCrewCode}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] text-[#224539]">
                      {r.sli}
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-bold">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          r.sliType === 'INHOUSE'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-teal-100 text-teal-900'
                        }`}
                      >
                        {r.sliType}
                      </span>
                    </td>
                    <td className="py-2 px-3 border-r border-[#edf3f0] font-semibold text-[#143e30]">
                      {r.vendor}
                    </td>
                    <td className="py-2 px-3 font-semibold text-[#486b5d]">
                      {r.vendorType}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-[#f7faf8] border-t border-[#e5eee9] px-6 py-3.5 flex items-center justify-between text-xs">
          <span className="text-[#5b7f71]">
            Page <strong className="text-[#103728]">{currentPage}</strong> of {totalPages} ({filteredRecords.length} records)
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 bg-white border border-[#d2e2da] rounded-xl text-[#1a3f31] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#eef5f1] transition-colors flex items-center gap-1 font-semibold"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 bg-white border border-[#d2e2da] rounded-xl text-[#1a3f31] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#eef5f1] transition-colors flex items-center gap-1 font-semibold"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
