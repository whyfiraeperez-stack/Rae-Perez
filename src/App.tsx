import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewTab } from './components/OverviewTab';
import { VendorsTab } from './components/VendorsTab';
import { PerformanceTab } from './components/PerformanceTab';
import { RawDataTab } from './components/RawDataTab';
import { FormulaGuideTab } from './components/FormulaGuideTab';
import { ImportExcelModal } from './components/ImportExcelModal';
import { AddRecordModal } from './components/AddRecordModal';
import { SalesDashboard } from './components/SalesDashboard';
import { GroupingMatrixView } from './components/GroupingMatrixView';
import { generateInitialRecords, INITIAL_DAILY_METRICS } from './data/initialData';
import { computeDashboardMetrics } from './utils/calculations';
import { JORecord, VendorSummary, SyncSourceInfo } from './types';
import { DateFilterMode, getAvailableMonths, formatDateDisplay, normalizeDate } from './utils/dateCountingEngine';
import { Menu, X } from 'lucide-react';

export default function App() {
  const [records, setRecords] = useState<JORecord[]>(() => generateInitialRecords());
  const [dailyMetrics, setDailyMetrics] = useState(INITIAL_DAILY_METRICS);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [dateMode, setDateMode] = useState<DateFilterMode>('specific_date');
  const [selectedDate, setSelectedDate] = useState('September 15, 2026');
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(8); // 8 = September (0-indexed)
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [targetVendorForAdd, setTargetVendorForAdd] = useState<string | undefined>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [syncSourceInfo, setSyncSourceInfo] = useState<SyncSourceInfo | null>({
    fileName: 'ALMASOR_SLI_MONITORING.xlsx',
    sheetName: 'JO ACTIVATED',
    isScreenshotSample: true,
    lastSyncTime: '01:00 PM',
    rowCount: 44,
  });

  // Fetch shared records from server so all users see identical synced data
  const fetchSharedRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/records');
      if (res.ok) {
        const data = await res.json();
        if (data.hasCustomData && Array.isArray(data.records) && data.records.length > 0) {
          setRecords(data.records);
          if (data.syncSourceInfo) {
            setSyncSourceInfo(data.syncSourceInfo);
          }
        }
      }
    } catch (err) {
      console.warn('Could not load shared server records:', err);
    }
  }, []);

  useEffect(() => {
    fetchSharedRecords();
    const interval = setInterval(fetchSharedRecords, 10000);
    return () => clearInterval(interval);
  }, [fetchSharedRecords]);

  const saveToServer = async (newRecords: JORecord[], sourceInfo?: SyncSourceInfo | null) => {
    try {
      await fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: newRecords,
          syncSourceInfo: sourceInfo,
        }),
      });
    } catch (err) {
      console.warn('Could not persist records to server:', err);
    }
  };

  // Dynamically compute metrics from records using COUNTIFS and runrate formulas
  const metrics = useMemo(() => {
    return computeDashboardMetrics(records, dailyMetrics.daysElapsed, dailyMetrics.daysInMonth);
  }, [records, dailyMetrics]);

  const availableMonths = useMemo(() => {
    return getAvailableMonths(records);
  }, [records]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    const parsed = normalizeDate(newDate);
    if (parsed) {
      setSelectedYear(parsed.getFullYear());
      setSelectedMonth(parsed.getMonth());
    }
  };

  const handleMonthChange = (year: number, month: number) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    // Keep date within that month (e.g. day 14 or day 1)
    setSelectedDate(formatDateDisplay(new Date(year, month, 14)));
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSharedRecords();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const handleImportRecords = (newRecords: JORecord[], replaceAll: boolean, sourceInfo?: SyncSourceInfo) => {
    const updated = replaceAll ? newRecords : [...records, ...newRecords];
    setRecords(updated);
    if (sourceInfo) {
      setSyncSourceInfo(sourceInfo);
    }
    saveToServer(updated, sourceInfo || syncSourceInfo);
  };

  const handleResetToPhotoData = () => {
    const seed = generateInitialRecords();
    setRecords(seed);
    const defaultInfo: SyncSourceInfo = {
      fileName: 'ALMASOR_SLI_MONITORING.xlsx',
      sheetName: 'JO ACTIVATED',
      isScreenshotSample: true,
      lastSyncTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      rowCount: 44,
    };
    setSyncSourceInfo(defaultInfo);
    fetch('/api/records/reset', { method: 'POST' }).catch(() => {});
  };

  const handleAddRecord = (record: JORecord) => {
    const updated = [record, ...records];
    setRecords(updated);
    saveToServer(updated, syncSourceInfo);
  };

  const handleDeleteVendor = (vendorName: string) => {
    if (window.confirm(`Are you sure you want to delete all activations for ${vendorName}?`)) {
      const updated = records.filter((r) => r.vendor !== vendorName);
      setRecords(updated);
      saveToServer(updated, syncSourceInfo);
    }
  };

  const handleAddVendorRecord = (vendorName?: string) => {
    setTargetVendorForAdd(vendorName);
    setIsAddRecordOpen(true);
  };

  const handleSyncLiveGoogleSheet = (newRecords: JORecord[], sourceInfo: SyncSourceInfo) => {
    setRecords(newRecords);
    setSyncSourceInfo(sourceInfo);
    saveToServer(newRecords, sourceInfo);
  };

  return (
    <div className="min-h-screen bg-[#f8faf9] flex flex-col md:flex-row font-sans text-[#143e2f]">
      {/* Mobile Header Bar */}
      <div className="md:hidden bg-[#0d2a21] text-white p-4 flex items-center justify-between border-b border-[#143e31]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#34d399] flex items-center justify-center text-[#0d2a21] font-bold">
            <svg
              className="w-5 h-5"
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
          <span className="font-extrabold text-sm tracking-wide">ALMASOR</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg border border-[#1b4e3e] text-emerald-300 hover:bg-[#143e31]"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0d2a21] border-b border-[#143e31] px-4 py-3 space-y-1">
          <button
            onClick={() => {
              setActiveTab('overview');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${
              activeTab === 'overview' ? 'bg-[#c5eed9] text-[#0d2a21]' : 'text-emerald-100'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => {
              setActiveTab('grouping_matrix');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${
              activeTab === 'grouping_matrix' ? 'bg-[#c5eed9] text-[#0d2a21]' : 'text-emerald-100'
            }`}
          >
            Grouping Engine (Raw)
          </button>
          <button
            onClick={() => {
              setActiveTab('performance');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${
              activeTab === 'performance' ? 'bg-[#c5eed9] text-[#0d2a21]' : 'text-emerald-100'
            }`}
          >
            Performance
          </button>
          <button
            onClick={() => {
              setActiveTab('vendors');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${
              activeTab === 'vendors' ? 'bg-[#c5eed9] text-[#0d2a21]' : 'text-emerald-100'
            }`}
          >
            Vendors ({metrics.vendorSummaries.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('raw_data');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${
              activeTab === 'raw_data' ? 'bg-[#c5eed9] text-[#0d2a21]' : 'text-emerald-100'
            }`}
          >
            JO Activated Sheet ({records.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('formula_guide');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold ${
              activeTab === 'formula_guide' ? 'bg-[#c5eed9] text-[#0d2a21]' : 'text-emerald-100'
            }`}
          >
            Formula Engine (COUNTIFS)
          </button>
          <button
            onClick={() => {
              setActiveTab('live_sync');
              setMobileMenuOpen(false);
            }}
            className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between ${
              activeTab === 'live_sync' ? 'bg-[#c5eed9] text-[#0d2a21]' : 'text-emerald-100'
            }`}
          >
            <span>Google Sheet Sync</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500 text-emerald-950">LIVE</span>
          </button>
        </div>
      )}

      {/* Desktop Sidebar matching Photo 1 */}
      <div className="hidden md:block">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          recordCount={records.length}
          vendorCount={metrics.vendorSummaries.length}
        />
      </div>

      {/* Main Content View */}
      <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl overflow-y-auto space-y-7">
        <Header
          dateMode={dateMode}
          onChangeDateMode={setDateMode}
          selectedDate={selectedDate}
          onChangeDate={handleDateChange}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          onChangeMonth={handleMonthChange}
          availableMonths={availableMonths}
          onRefresh={handleRefresh}
          onOpenImport={() => setIsImportOpen(true)}
          onOpenAddRecord={() => {
            setTargetVendorForAdd(undefined);
            setIsAddRecordOpen(true);
          }}
          onOpenLiveSync={() => setActiveTab('live_sync')}
          recordCount={records.length}
          vendorCount={metrics.vendorSummaries.length}
          isRefreshing={isRefreshing}
          syncSourceInfo={syncSourceInfo}
          fiberXCount={metrics.fiberXCount}
          smeCount={metrics.smeCount}
          bidaCount={metrics.bidaCount}
        />

        {/* Tab Views */}
        {activeTab === 'overview' && (
          <OverviewTab
            metrics={metrics}
            records={records}
            dateMode={dateMode}
            onChangeDateMode={setDateMode}
            selectedDate={selectedDate}
            onChangeDate={handleDateChange}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onChangeMonth={handleMonthChange}
            availableMonths={availableMonths}
            onNavigateToVendors={() => setActiveTab('vendors')}
            onNavigateToRawData={() => setActiveTab('raw_data')}
          />
        )}

        {activeTab === 'grouping_matrix' && (
          <GroupingMatrixView
            aggregates={metrics}
            fileName={syncSourceInfo?.fileName}
            sheetName={syncSourceInfo?.sheetName}
            isSynced={!syncSourceInfo?.isScreenshotSample}
          />
        )}

        {activeTab === 'performance' && (
          <PerformanceTab
            metrics={metrics}
            dailyMetrics={dailyMetrics}
          />
        )}

        {activeTab === 'vendors' && (
          <VendorsTab
            vendorSummaries={metrics.vendorSummaries}
            onAddVendorRecord={handleAddVendorRecord}
            onDeleteVendor={handleDeleteVendor}
          />
        )}

        {activeTab === 'raw_data' && (
          <RawDataTab
            records={records}
            syncSourceInfo={syncSourceInfo}
            onOpenAddModal={() => {
              setTargetVendorForAdd(undefined);
              setIsAddRecordOpen(true);
            }}
            onOpenImportModal={() => setIsImportOpen(true)}
          />
        )}

        {activeTab === 'formula_guide' && (
          <FormulaGuideTab metrics={metrics} />
        )}

        {activeTab === 'live_sync' && (
          <SalesDashboard
            onSyncToDashboard={handleSyncLiveGoogleSheet}
          />
        )}
      </main>

      {/* Modals */}
      <ImportExcelModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportRecords={handleImportRecords}
        onResetToPhotoData={handleResetToPhotoData}
      />

      <AddRecordModal
        isOpen={isAddRecordOpen}
        onClose={() => setIsAddRecordOpen(false)}
        onAddRecord={handleAddRecord}
        defaultVendor={targetVendorForAdd}
      />
    </div>
  );
}
