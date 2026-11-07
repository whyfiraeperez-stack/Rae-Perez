import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, CheckCircle2, ArrowUpDown } from 'lucide-react';
import { VendorSummary, SliType } from '../types';

interface VendorsTabProps {
  vendorSummaries: VendorSummary[];
  onAddVendorRecord: (vendorName?: string) => void;
  onEditVendor?: (vendor: VendorSummary) => void;
  onDeleteVendor?: (vendorName: string) => void;
}

export const VendorsTab: React.FC<VendorsTabProps> = ({
  vendorSummaries,
  onAddVendorRecord,
  onEditVendor,
  onDeleteVendor,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'total' | 'share' | 'fiberX' | 'vendor'>('total');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = vendorSummaries.filter((v) =>
    v.vendor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    let comp = 0;
    if (sortField === 'vendor') comp = a.vendor.localeCompare(b.vendor);
    else if (sortField === 'fiberX') comp = a.fiberX - b.fiberX;
    else if (sortField === 'share') comp = a.share - b.share;
    else comp = a.total - b.total;
    return sortAsc ? comp : -comp;
  });

  const totalFiberX = filtered.reduce((sum, v) => sum + v.fiberX, 0);
  const totalSme = filtered.reduce((sum, v) => sum + v.sme, 0);
  const totalBida = filtered.reduce((sum, v) => sum + v.bida, 0);
  const grandTotal = filtered.reduce((sum, v) => sum + v.total, 0);

  const toggleSort = (field: 'total' | 'share' | 'fiberX' | 'vendor') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const getBadgeColor = (vendor: string, type: SliType) => {
    const char = vendor.charAt(0).toUpperCase();
    if (char === 'A') return 'bg-[#dcfce7] text-[#166534]';
    if (char === 'S') return 'bg-[#e0f2fe] text-[#0369a1]';
    if (char === 'R') return 'bg-[#fef3c7] text-[#92400e]';
    if (char === 'I') return 'bg-[#ede9fe] text-[#5b21b6]';
    if (char === 'B') return 'bg-[#fee2e2] text-[#991b1b]';
    if (char === 'D') return 'bg-[#ffedd5] text-[#9a3412]';
    if (char === 'T') return 'bg-[#dbeafe] text-[#1e40af]';
    return 'bg-[#f1f5f9] text-[#334155]';
  };

  return (
    <div id="vendors-view" className="bg-white border border-[#dce7e1] rounded-3xl p-7 shadow-xs space-y-6">
      {/* Header bar matching Photo 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold tracking-wider text-[#587a6d] uppercase">
            VENDOR CONTRIBUTION
          </div>
          <h2 className="text-2xl font-bold text-[#0f2e22] tracking-tight">
            Top contributors
          </h2>
          <p className="text-xs text-[#5e8173] mt-0.5">
            Packages activated in the current reporting period.
          </p>
        </div>

        {/* Controls: Search + Add */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-[#75988b] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="search-vendors-input"
              type="text"
              placeholder="Search vendors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#f6faf8] border border-[#d3e3da] text-xs font-medium rounded-xl pl-9 pr-3.5 py-2 text-[#133e2f] placeholder-[#8baaa0] focus:outline-hidden focus:border-emerald-600 focus:bg-white transition-all"
            />
          </div>

          <button
            id="add-vendor-btn"
            onClick={() => onAddVendorRecord()}
            className="flex items-center gap-1.5 bg-[#144c38] hover:bg-[#0e3c2c] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Table matching Photo 2 */}
      <div className="overflow-x-auto rounded-2xl border border-[#e8f0ec]">
        <table id="vendors-table" className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#f9fbf9] border-b border-[#e8f0ec] text-[#55776a] font-semibold text-[11px] uppercase tracking-wider">
              <th
                onClick={() => toggleSort('vendor')}
                className="py-3.5 px-5 cursor-pointer hover:text-[#113a2c]"
              >
                <div className="flex items-center gap-1.5">
                  <span>Vendor</span>
                  <ArrowUpDown className="w-3 h-3 text-[#8baea2]" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('fiberX')}
                className="py-3.5 px-4 text-center cursor-pointer hover:text-[#113a2c]"
              >
                FiberX
              </th>
              <th className="py-3.5 px-4 text-center">SME</th>
              <th className="py-3.5 px-4 text-center">BIDA</th>
              <th
                onClick={() => toggleSort('total')}
                className="py-3.5 px-4 text-center cursor-pointer hover:text-[#113a2c]"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>Total</span>
                  <ArrowUpDown className="w-3 h-3 text-[#8baea2]" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('share')}
                className="py-3.5 px-4 text-center cursor-pointer hover:text-[#113a2c]"
              >
                Share
              </th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#eef4f0]">
            {sorted.map((v, idx) => {
              const initial = v.vendor.charAt(0).toUpperCase();
              return (
                <tr
                  key={v.vendor}
                  className="hover:bg-[#f6faf8] transition-colors group text-[#1a3d30]"
                >
                  {/* Vendor with initial avatar */}
                  <td className="py-3 px-5 font-semibold">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${getBadgeColor(
                          v.vendor,
                          v.vendorType
                        )}`}
                      >
                        {initial}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#143e30] group-hover:text-emerald-800 transition-colors">
                          {v.vendor}
                        </div>
                        <div className="text-[10px] text-[#719385] font-normal">
                          {v.vendorType}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* FiberX */}
                  <td className="py-3 px-4 text-center font-semibold text-[#184234]">
                    {v.fiberX}
                  </td>

                  {/* SME */}
                  <td className="py-3 px-4 text-center font-medium text-[#466a5c]">
                    {v.sme > 0 ? v.sme : '0'}
                  </td>

                  {/* BIDA */}
                  <td className="py-3 px-4 text-center font-medium text-[#466a5c]">
                    {v.bida > 0 ? v.bida : '0'}
                  </td>

                  {/* Total */}
                  <td className="py-3 px-4 text-center font-black text-[#103728] text-sm">
                    {v.total}
                  </td>

                  {/* Share % */}
                  <td className="py-3 px-4 text-center">
                    <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full text-[11px]">
                      {v.share.toFixed(1)}%
                    </span>
                  </td>

                  {/* Actions (Pencil & Trash icons matching Photo 2) */}
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        title={`Edit ${v.vendor}`}
                        onClick={() => onEditVendor && onEditVendor(v)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#d6e3dc] text-[#55786b] hover:text-[#144c38] hover:bg-[#eaf4ef] transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title={`Delete ${v.vendor}`}
                        onClick={() => onDeleteVendor && onDeleteVendor(v.vendor)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-[#fed7d7] text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Grand Total Row matching Photo 3 */}
            <tr className="bg-[#f2f8f4] font-black text-[#0f3426] border-t-2 border-[#cfe4d8]">
              <td className="py-3.5 px-5 font-bold uppercase tracking-wide">
                Grand Total ({filtered.length} Vendors)
              </td>
              <td className="py-3.5 px-4 text-center text-sm">{totalFiberX}</td>
              <td className="py-3.5 px-4 text-center text-sm">{totalSme}</td>
              <td className="py-3.5 px-4 text-center text-sm">{totalBida}</td>
              <td className="py-3.5 px-4 text-center text-base text-emerald-900">{grandTotal}</td>
              <td className="py-3.5 px-4 text-center text-xs">
                <span className="bg-emerald-200 text-emerald-900 font-bold px-2.5 py-0.5 rounded-full">
                  100.0%
                </span>
              </td>
              <td className="py-3.5 px-5 text-right text-[11px] text-[#56796c] font-medium">
                COUNTIFS Total
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
