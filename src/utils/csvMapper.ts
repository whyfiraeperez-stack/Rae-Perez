import { JORecord, Province, SliType, PackageCategory } from '../types';
import { normalizeVendorName } from './calculations';

/**
 * Maps raw rows parsed by PapaParse (from Google Sheet CSV)
 * into typed JORecord objects compatible with the Almasor Dashboard.
 */
export function mapCsvRowsToJORecords(rows: any[]): JORecord[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  return rows
    .map((row, idx): JORecord | null => {
      if (!row || typeof row !== 'object') return null;

      // Helper to find value from row by checking various possible header keys
      const findVal = (keywords: string[]): string => {
        const keys = Object.keys(row);
        for (const k of keys) {
          const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const kw of keywords) {
            if (cleanK === kw || cleanK.includes(kw)) {
              const val = row[k];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                return String(val).trim();
              }
            }
          }
        }
        return '';
      };

      const rawProvince = findVal(['stateorprovince', 'province', 'state']).toUpperCase();
      let province: Province = 'ALBAY';
      if (rawProvince.includes('SOR')) province = 'SORSOGON';
      else if (rawProvince.includes('MAS')) province = 'MASBATE';
      else if (rawProvince.includes('ALB')) province = 'ALBAY';

      const pkgRaw = findVal(['packagename', 'package', 'pkg', 'plan']);
      const pkgUpper = pkgRaw.toUpperCase();

      let category: PackageCategory = 'FIBERX';
      if (
        pkgUpper.includes('BIZ') ||
        pkgUpper.includes('SME') ||
        pkgUpper.includes('MICRO') ||
        pkgUpper.includes('ENTERPRISE')
      ) {
        category = 'SME';
      } else if (pkgUpper.includes('BIDA')) {
        category = 'BIDA';
      } else if (pkgUpper.includes('S2S') || pkgUpper.includes('SURF')) {
        category = 'S2S';
      } else if (pkgUpper.includes('FIBERX') || pkgUpper.includes('TIME OF DAY') || pkgUpper.includes('AIR')) {
        category = 'FIBERX';
      }

      const rawSliType = findVal(['slitype', 'channel', 'type']).toUpperCase();
      let sliType: SliType = rawSliType.includes('MSA') || rawSliType.includes('OUTSOURCE') ? 'MSA' : 'INHOUSE';

      const vendorRaw = findVal(['vendorname', 'vendor', 'contractor', 'wfmsliname', 'sliname']);
      const vendor = normalizeVendorName(vendorRaw, sliType);

      // Determine vendorType accurately based on canonical vendor
      const vUpper = vendor.toUpperCase();
      let vendorType: SliType = sliType;
      if (
        vUpper.includes('INHOUSE') ||
        vUpper.includes('TELEDIGI') ||
        vUpper.includes('ONLINE APPLICATION') ||
        vUpper.includes('RAVENOUS')
      ) {
        vendorType = 'INHOUSE';
      } else if (
        vUpper.includes('STORE') ||
        vUpper.includes('ENTERPRISE') ||
        vUpper.includes('NARVAEZ') ||
        vUpper.includes('DOMINGUIANO') ||
        vUpper.includes('SERAPH') ||
        vUpper.includes('BRYTH') ||
        vUpper.includes('SBAS') ||
        vUpper.includes('TOUKON')
      ) {
        vendorType = 'MSA';
      }

      const rawMrc = findVal(['mrc', 'amount', 'monthlyfee', 'price', 'revenue']);
      const cleanMrcNum = parseFloat(rawMrc.replace(/[^0-9.]/g, '')) || 0;

      // Extract amount for SME if applicable
      let amount: number | undefined = undefined;
      if (category === 'SME') {
        if (cleanMrcNum > 0) {
          amount = cleanMrcNum;
        } else {
          // Extract from package name e.g. "BIZ 3500"
          const match = pkgRaw.match(/\d{4,5}/);
          amount = match ? parseInt(match[0], 10) : 3500;
        }
      }

      const joNumber = findVal(['jono', 'jonumber', 'jo#', 'orderid']) || `JO-GS-${idx + 1}`;
      const city = findVal(['city', 'municipality']) || (province === 'ALBAY' ? 'LEGAZPI' : province === 'SORSOGON' ? 'SORSOGON CITY' : 'MASBATE CITY');
      const barangay = findVal(['barangayname', 'barangay', 'brgy']) || 'Poblacion';
      const joDate = findVal(['jodate', 'activationdate', 'date']) || '2026-09-14';

      return {
        id: `gsheet-${idx}-${Date.now()}`,
        joNumber,
        stateOrProvince: province,
        city,
        barangayName: barangay,
        packageName: pkgRaw || (category === 'FIBERX' ? 'FIBERX 1500' : category === 'SME' ? 'BIZ 3500' : 'BIDA FIBER 888'),
        category,
        napCode: `${province.substring(0, 3)}001`,
        napPort: 'P1-O',
        crew: findVal(['crew', 'installer']) || (vendorType === 'INHOUSE' ? 'RV069-' : 'RV115-'),
        cpeSerialNo: `48575443${String(idx).padStart(4, '0')}`,
        agentCode: `${vendor} Rep`,
        sliSystemCheckCrewCode: vendor,
        sli: vendor,
        sliType: vendorType,
        vendor,
        vendorType,
        activationDate: joDate,
        status: 'Activated',
        amount,
      };
    })
    .filter((r): r is JORecord => r !== null);
}
