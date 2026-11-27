import React from 'react';
import { Targets } from '../types';

export interface ProvinceRunningData {
  fiberXCount: number;
  smeMRC: number;
  bidaCount: number;
}

interface MtdVsTargetProvinceProps {
  provinceMetrics: {
    ALBAY: ProvinceRunningData;
    MASBATE: ProvinceRunningData;
    SORSOGON: ProvinceRunningData;
  };
  targetsByProvince: {
    ALBAY: Targets;
    MASBATE: Targets;
    SORSOGON: Targets;
  };
}

function formatCount(val: number): string {
  return Math.round(val || 0).toLocaleString('en-PH');
}

function formatPeso(val: number): string {
  return `₱${Math.round(val || 0).toLocaleString('en-PH')}`;
}

function formatPercent(val: number): string {
  if (!Number.isFinite(val) || isNaN(val) || val <= 0) {
    return '0.00%';
  }
  return `${val.toFixed(2)}%`;
}

function calcProgress(actual: number, target: number): number {
  if (!Number.isFinite(target) || target <= 0) return 0;
  if (!Number.isFinite(actual) || actual <= 0) return 0;
  return (actual / target) * 100;
}

export const MtdVsTargetProvince: React.FC<MtdVsTargetProvinceProps> = ({
  provinceMetrics,
  targetsByProvince,
}) => {
  const provinces: Array<{ key: 'ALBAY' | 'MASBATE' | 'SORSOGON'; label: string }> = [
    { key: 'ALBAY', label: 'ALBAY' },
    { key: 'MASBATE', label: 'MASBATE' },
    { key: 'SORSOGON', label: 'SORSOGON' },
  ];

  return (
    <section className="mb-7" id="mtd-vs-target-by-province">
      <div className="mb-3">
        <h2 className="text-xl font-bold uppercase tracking-tight text-[#123b31]">
          MTD VS TARGET — BY PROVINCE
        </h2>
        <p className="text-sm text-gray-500 mt-0.5 font-medium">
          Albay | Masbate | Sorsogon • Provincial performance against target
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {provinces.map(({ key, label }) => {
          const metrics = provinceMetrics[key] || { fiberXCount: 0, smeMRC: 0, bidaCount: 0 };
          const targets = targetsByProvince[key] || { fiberX: 0, sme: 0, bida: 0 };

          const fiberXProgress = calcProgress(metrics.fiberXCount, targets.fiberX);
          const smeProgress = calcProgress(metrics.smeMRC, targets.sme);
          const bidaProgress = calcProgress(metrics.bidaCount, targets.bida);

          return (
            <div
              key={key}
              className="bg-white border border-[#dcece6] rounded-2xl p-5 shadow-sm flex flex-col justify-between"
            >
              {/* Province Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#f0f5f2]">
                <h3 className="text-lg font-bold text-[#005e47] tracking-wide">
                  {label}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#e8f8f0] text-[#0b684e] font-medium border border-[#c9ebdd]">
                  Provincial Target
                </span>
              </div>

              <div className="space-y-4 mt-4">
                {/* FIBERX */}
                <div className="p-3 bg-[#fbfdfc] rounded-xl border border-[#edf3f0]">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-700">FIBERX</span>
                    <span className="text-[#0a684d] font-bold text-sm">
                      {formatPercent(fiberXProgress)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-gray-400 block font-medium">RUNNING</span>
                      <span className="text-sm font-bold text-gray-800">
                        {formatCount(metrics.fiberXCount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">TARGET</span>
                      <span className="text-sm font-bold text-gray-600">
                        {formatCount(targets.fiberX)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full bg-[#e6edea] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0aa37a] rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, fiberXProgress))}%` }}
                    />
                  </div>
                </div>

                {/* SME */}
                <div className="p-3 bg-[#fbfdfc] rounded-xl border border-[#edf3f0]">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-700">SME</span>
                    <span className="text-[#0a684d] font-bold text-sm">
                      {formatPercent(smeProgress)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-gray-400 block font-medium">RUNNING MRC</span>
                      <span className="text-sm font-bold text-gray-800">
                        {formatPeso(metrics.smeMRC)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">TARGET</span>
                      <span className="text-sm font-bold text-gray-600">
                        {formatPeso(targets.sme)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full bg-[#e6edea] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0aa37a] rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, smeProgress))}%` }}
                    />
                  </div>
                </div>

                {/* BIDA */}
                <div className="p-3 bg-[#fbfdfc] rounded-xl border border-[#edf3f0]">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-gray-700">BIDA</span>
                    <span className="text-[#0a684d] font-bold text-sm">
                      {formatPercent(bidaProgress)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-gray-400 block font-medium">RUNNING</span>
                      <span className="text-sm font-bold text-gray-800">
                        {formatCount(metrics.bidaCount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 block font-medium">TARGET</span>
                      <span className="text-sm font-bold text-gray-600">
                        {formatCount(targets.bida)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 h-1.5 w-full bg-[#e6edea] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0aa37a] rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, bidaProgress))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
