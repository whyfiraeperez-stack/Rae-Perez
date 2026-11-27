import React, { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { JORecord, Province, SliType, PackageCategory } from '../types';

interface AddRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddRecord: (record: JORecord) => void;
  defaultVendor?: string;
}

export const AddRecordModal: React.FC<AddRecordModalProps> = ({
  isOpen,
  onClose,
  onAddRecord,
  defaultVendor,
}) => {
  const [joNumber, setJoNumber] = useState(`R37${Math.floor(10000 + Math.random() * 90000)}`);
  const [province, setProvince] = useState<Province>('SORSOGON');
  const [city, setCity] = useState('CITY OF SORSOGON');
  const [barangay, setBarangay] = useState('San Juan');
  const [packageName, setPackageName] = useState('FIBERX 1500 100M');
  const [category, setCategory] = useState<PackageCategory>('FIBERX');
  const [vendor, setVendor] = useState(defaultVendor || 'A. NARVAEZ STORE');
  const [sliType, setSliType] = useState<SliType>('MSA');
  const [amount, setAmount] = useState('2000');
  const [crew, setCrew] = useState('RV115-');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRecord: JORecord = {
      id: `jo-manual-${Date.now()}`,
      joNumber,
      stateOrProvince: province,
      city: city.toUpperCase(),
      barangayName: barangay.toUpperCase(),
      packageName,
      category,
      napCode: `${province.substring(0, 3)}001 LP01`,
      napPort: 'P1-O',
      crew,
      cpeSerialNo: `48575443${Math.random().toString(16).substring(2, 7).toUpperCase()}`,
      agentCode: `${vendor} Rep`,
      sliSystemCheckCrewCode: sliType === 'INHOUSE' ? 'RAVENOUS SLR' : vendor,
      sli: vendor,
      sliType,
      vendor,
      vendorType: sliType,
      activationDate: new Date().toISOString().split('T')[0],
      status: 'Activated',
      amount: category === 'SME' ? parseFloat(amount) || 2000 : undefined,
      slaHours: 20,
    };

    onAddRecord(newRecord);
    onClose();
  };

  const handlePackageChange = (pkg: string) => {
    setPackageName(pkg);
    if (pkg.includes('BIZ') || pkg.includes('SME') || pkg.includes('FlexiBiz') || pkg.includes('BizeDge')) {
      setCategory('SME');
    } else if (pkg.includes('BIDA')) {
      setCategory('BIDA');
    } else {
      setCategory('FIBERX');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-[#dce7e1] max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#edf3ef] pb-3">
          <div>
            <h3 className="text-lg font-bold text-[#103728]">
              Add Activated JO Record
            </h3>
            <p className="text-xs text-[#597c6e]">
              Syncs to &apos;JO ACTIVATED&apos; and recalculates live COUNTIFS
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                JO Number
              </label>
              <input
                type="text"
                required
                value={joNumber}
                onChange={(e) => setJoNumber(e.target.value)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] font-mono focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                Province / Territory
              </label>
              <select
                value={province}
                onChange={(e) => setProvince(e.target.value as Province)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] font-semibold focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="ALBAY">ALBAY</option>
                <option value="SORSOGON">SORSOGON</option>
                <option value="MASBATE">MASBATE</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                City / Municipality
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] focus:outline-hidden focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                Barangay
              </label>
              <input
                type="text"
                required
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] focus:outline-hidden focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                Package
              </label>
              <select
                value={packageName}
                onChange={(e) => handlePackageChange(e.target.value)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] font-semibold focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="FIBERX 1500 100M">FIBERX 1500 100M</option>
                <option value="SUPER FIBERX MAX">SUPER FIBERX MAX</option>
                <option value="FIBERX 1250 100M">FIBERX 1250 100M</option>
                <option value="SUPER FIBERX UP">SUPER FIBERX UP</option>
                <option value="BizeDge 2100">BizeDge 2100 (SME)</option>
                <option value="MICROBIZ MAX">MICROBIZ MAX (SME)</option>
                <option value="FlexiBiz 2000">FlexiBiz 2000 (SME)</option>
                <option value="BIDA FIBER 888">BIDA FIBER 888</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PackageCategory)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] font-semibold focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="FIBERX">FIBERX</option>
                <option value="SME">SME</option>
                <option value="BIDA">BIDA</option>
                <option value="S2S">S2S</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                Vendor
              </label>
              <select
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] font-semibold focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="A. NARVAEZ STORE">A. NARVAEZ STORE (MSA)</option>
                <option value="INHOUSE - SALES AGENT">INHOUSE - SALES AGENT</option>
                <option value="SERAPH TRUCKING SERVICES">SERAPH TRUCKING SERVICES (MSA)</option>
                <option value="RAVENOUS SLI">RAVENOUS SLI (MSA)</option>
                <option value="INHOUSE - BUSINESS CENTER">INHOUSE - BUSINESS CENTER</option>
                <option value="BRYTH">BRYTH (MSA)</option>
                <option value="SBAS">SBAS (MSA)</option>
                <option value="INHOUSE - TECHNICAL DEPARTMENT">INHOUSE - TECHNICAL DEPARTMENT</option>
                <option value="INHOUSE - SME">INHOUSE - SME</option>
                <option value="DOMINGUIANO ENTERPRISE">DOMINGUIANO ENTERPRISE (MSA)</option>
                <option value="TOUKON">TOUKON (MSA)</option>
                <option value="TELEDIGISALES">TELEDIGISALES</option>
                <option value="ONLINE APPLICATION">ONLINE APPLICATION</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                SLI Type
              </label>
              <select
                value={sliType}
                onChange={(e) => setSliType(e.target.value as SliType)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] font-semibold focus:outline-hidden focus:border-emerald-600 cursor-pointer"
              >
                <option value="INHOUSE">INHOUSE</option>
                <option value="MSA">MSA</option>
              </select>
            </div>
          </div>

          {category === 'SME' && (
            <div>
              <label className="block font-semibold text-[#184232] mb-1">
                SME Amount (₱)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-[#f8faf9] border border-[#d4e3dc] rounded-xl px-3 py-2 text-[#103728] font-bold focus:outline-hidden focus:border-emerald-600"
              />
            </div>
          )}

          <div className="pt-3 border-t border-[#edf3ef] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#144c38] hover:bg-[#0e3c2c] text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Record Activation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
