import React from 'react';
import { LayoutDashboard, TrendingUp, Users, Database, FileSpreadsheet, Calculator } from 'lucide-react';

export type NavTab = 'overview' | 'performance' | 'vendors' | 'raw_data' | 'formula_guide';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  recordCount: number;
  vendorCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  recordCount,
  vendorCount,
}) => {
  return (
    <aside
      id="sidebar"
      className="w-64 bg-[#0d2a21] text-white flex flex-col justify-between shrink-0 min-h-screen border-r border-[#143e31] select-none"
    >
      <div>
        {/* Logo Section */}
        <div id="sidebar-brand" className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#34d399] flex items-center justify-center text-[#0d2a21] shadow-md shadow-emerald-950/40">
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
          </div>
          <div>
            <div className="font-extrabold text-base tracking-wide text-white font-sans">
              ALMASOR
            </div>
            <div className="text-xs text-[#82b8a3] font-medium tracking-tight">
              Performance hub
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav id="sidebar-nav" className="px-3 py-4 space-y-1.5">
          <button
            id="nav-overview"
            onClick={() => onSelectTab('overview')}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-150 ${
              activeTab === 'overview'
                ? 'bg-[#c5eed9] text-[#0d2a21] shadow-sm'
                : 'text-[#96bdae] hover:text-white hover:bg-[#153e31]'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Overview</span>
          </button>

          <button
            id="nav-performance"
            onClick={() => onSelectTab('performance')}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-150 ${
              activeTab === 'performance'
                ? 'bg-[#c5eed9] text-[#0d2a21] shadow-sm'
                : 'text-[#96bdae] hover:text-white hover:bg-[#153e31]'
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>Performance</span>
          </button>

          <button
            id="nav-vendors"
            onClick={() => onSelectTab('vendors')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-150 ${
              activeTab === 'vendors'
                ? 'bg-[#c5eed9] text-[#0d2a21] shadow-sm'
                : 'text-[#96bdae] hover:text-white hover:bg-[#153e31]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Users className="w-4 h-4 shrink-0" />
              <span>Vendors</span>
            </div>
            {vendorCount > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'vendors'
                    ? 'bg-[#0d2a21] text-emerald-200'
                    : 'bg-[#18493a] text-emerald-300'
                }`}
              >
                {vendorCount}
              </span>
            )}
          </button>

          <div className="pt-5 pb-2 px-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#5d8b7a]">
              Raw Data & Logic
            </p>
          </div>

          <button
            id="nav-raw-data"
            onClick={() => onSelectTab('raw_data')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-150 ${
              activeTab === 'raw_data'
                ? 'bg-[#c5eed9] text-[#0d2a21] shadow-sm'
                : 'text-[#96bdae] hover:text-white hover:bg-[#153e31]'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Database className="w-4 h-4 shrink-0" />
              <span>JO Activated Sheet</span>
            </div>
            {recordCount > 0 && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'raw_data'
                    ? 'bg-[#0d2a21] text-emerald-200'
                    : 'bg-[#18493a] text-emerald-300'
                }`}
              >
                {recordCount}
              </span>
            )}
          </button>

          <button
            id="nav-formula-guide"
            onClick={() => onSelectTab('formula_guide')}
            className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-150 ${
              activeTab === 'formula_guide'
                ? 'bg-[#c5eed9] text-[#0d2a21] shadow-sm'
                : 'text-[#96bdae] hover:text-white hover:bg-[#153e31]'
            }`}
          >
            <Calculator className="w-4 h-4 shrink-0" />
            <span>Formula Engine</span>
          </button>
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-5 border-t border-[#143e31]/80 text-xs text-[#719d8d] space-y-1">
        <div className="flex items-center justify-between font-medium">
          <span>Territory:</span>
          <span className="text-white font-semibold">Albay • Sorsogon • Masbate</span>
        </div>
        <div className="flex items-center justify-between font-medium">
          <span>Cycle:</span>
          <span className="text-emerald-400 font-semibold">Sep 1–30, 2026</span>
        </div>
      </div>
    </aside>
  );
};
