import React from 'react';
import { Targets } from '../types';

interface MtdVsTargetAlmasorProps {
  runningFiberX: number;
  runningSmeMRC: number;
  runningBida: number;
  targets: Targets;
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

export const MtdVsTargetAlmasor: React.FC<MtdVsTargetAlmasorProps> = ({
  runningFiberX,
  runningSmeMRC,
  runningBida,
  targets,
}) => {
  const fiberXProgress = calcProgress(runningFiberX, targets.fiberX);
  const smeProgress = calcProgress(runningSmeMRC, targets.sme);
  const bidaProgress = calcProgress(runningBida, targets.bida);

  return (
    <section className="mb-7" id="mtd-vs-target-almasor">
      <div className="mb-3">
        <h2 className="text-xl font-bold text-[#123b31]">
          MTD VS TARGET — ALMASOR
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Monthly running performance against target.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* FIBERX */}
        <div className="bg-white border border-[#dcece6] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider px-3 py-1 rounded-full bg-[#dff7ec] text-[#0a684d] border border-[#b5e6d0]">
                FTTH
              </span>
              <h3 className="text-lg font-bold text-[#005e47]">FIBERX</h3>
            </div>

            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider font-semibold text-gray-400">
                RUNNING (MTD)
              </div>
              <div className="text-4xl font-extrabold text-[#123b31] mt-1">
                {formatCount(runningFiberX)}
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-4 text-sm">
              <span className="text-gray-500 font-medium">TARGET</span>
              <span className="font-bold text-gray-700">{formatCount(targets.fiberX)}</span>
            </div>

            <div className="mt-2.5 h-2.5 w-full bg-[#edf2f0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0aa37a] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, fiberXProgress))}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-5 pt-3 border-t border-[#f0f5f2] text-sm">
            <span className="text-gray-500 font-medium">PROGRESS</span>
            <span className="text-base font-bold text-[#0a684d]">
              {formatPercent(fiberXProgress)}
            </span>
          </div>
        </div>

        {/* SME */}
        <div className="bg-white border border-[#dcece6] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider px-3 py-1 rounded-full bg-[#e8f4fc] text-[#0d6efd] border border-[#cfe2ff]">
                ENTERPRISE MRC
              </span>
              <h3 className="text-lg font-bold text-[#005e47]">SME</h3>
            </div>

            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider font-semibold text-gray-400">
                RUNNING (MTD)
              </div>
              <div className="text-4xl font-extrabold text-[#123b31] mt-1">
                {formatPeso(runningSmeMRC)}
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-4 text-sm">
              <span className="text-gray-500 font-medium">TARGET</span>
              <span className="font-bold text-gray-700">{formatPeso(targets.sme)}</span>
            </div>

            <div className="mt-2.5 h-2.5 w-full bg-[#edf2f0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0aa37a] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, smeProgress))}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-5 pt-3 border-t border-[#f0f5f2] text-sm">
            <span className="text-gray-500 font-medium">PROGRESS</span>
            <span className="text-base font-bold text-[#0a684d]">
              {formatPercent(smeProgress)}
            </span>
          </div>
        </div>

        {/* BIDA */}
        <div className="bg-white border border-[#dcece6] rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider px-3 py-1 rounded-full bg-[#fef3c7] text-[#92400e] border border-[#fde68a]">
                AFFORDABLE
              </span>
              <h3 className="text-lg font-bold text-[#005e47]">BIDA</h3>
            </div>

            <div className="mt-5">
              <div className="text-xs uppercase tracking-wider font-semibold text-gray-400">
                RUNNING (MTD)
              </div>
              <div className="text-4xl font-extrabold text-[#123b31] mt-1">
                {formatCount(runningBida)}
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-4 text-sm">
              <span className="text-gray-500 font-medium">TARGET</span>
              <span className="font-bold text-gray-700">{formatCount(targets.bida)}</span>
            </div>

            <div className="mt-2.5 h-2.5 w-full bg-[#edf2f0] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0aa37a] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, bidaProgress))}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-5 pt-3 border-t border-[#f0f5f2] text-sm">
            <span className="text-gray-500 font-medium">PROGRESS</span>
            <span className="text-base font-bold text-[#0a684d]">
              {formatPercent(bidaProgress)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
