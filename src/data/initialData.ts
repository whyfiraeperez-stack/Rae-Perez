import { JORecord, Province, SliType } from '../types';

export interface TargetConfig {
  province: Province;
  fiberXTarget: number;
  smeTargetAmount: number;
  bidaTarget: number;
  s2sTarget: number;
}

export const TARGET_CONFIGS: Record<Province, TargetConfig> = {
  ALBAY: {
    province: 'ALBAY',
    fiberXTarget: 467,
    smeTargetAmount: 71993,
    bidaTarget: 82,
    s2sTarget: 572,
  },
  SORSOGON: {
    province: 'SORSOGON',
    fiberXTarget: 189,
    smeTargetAmount: 59354,
    bidaTarget: 21,
    s2sTarget: 169,
  },
  MASBATE: {
    province: 'MASBATE',
    fiberXTarget: 203,
    smeTargetAmount: 5161,
    bidaTarget: 10,
    s2sTarget: 41,
  },
};

export const INITIAL_DAILY_METRICS = {
  reportDate: '15 Sep 2026',
  daysElapsed: 15,
  daysInMonth: 30,
  activatedYesterday: 9,
  activatedToday: 6,
  fsoi: 12,
  openJOsCloseout: 0,
  openJOsActivation: 0,
};

// Seed dataset generator matching exact counts from JO ACTIVATED for September 2026:
// Total JOs: 388
// FIBERX: 366
// SME: 20
// BIDA: 2
// INHOUSE: 156
// MSA: 232
// ALBAY: 228
// MASBATE: 86
// SORSOGON: 74
// Total MRC: 621,911
export function generateInitialRecords(): JORecord[] {
  const records: JORecord[] = [];
  let idCounter = 1;

  // 366 FiberX records with total MRC = 541,645
  // Albay: 75 Inhouse, 141 MSA (= 216)
  // Masbate: 38 Inhouse, 45 MSA (= 83)
  // Sorsogon: 32 Inhouse, 35 MSA (= 67)
  // Total Inhouse = 75 + 38 + 32 = 145
  // Total MSA = 141 + 45 + 35 = 221
  // Total FiberX = 145 + 221 = 366

  const fiberXAmounts = Array(366).fill(1500);
  for (let i = 0; i < 29; i++) fiberXAmounts[i] = 1250;
  fiberXAmounts[29] = 1395;

  let fxIndex = 0;

  const albayVendorsMSA = ['A. NARVAEZ STORE', 'SBAS', 'BRYTH', 'TOUKON', 'SERAPH TRUCKING SERVICES', 'PINTEL TRADING'];
  const masbateVendorsMSA = ['A. NARVAEZ STORE', 'RAVENOUS SLI', 'PINTEL TRADING'];
  const sorsogonVendorsMSA = ['DOMINGUIANO ENTERPRISE', 'A. NARVAEZ STORE', 'SBAS'];

  function addFiberXGroup(prov: Province, sli: SliType, count: number) {
    for (let i = 0; i < count; i++) {
      const day = (i % 30) + 1;
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `2026-09-${dayStr}`;
      const prefix = sli === 'INHOUSE' ? 'R37' : 'M37';
      const vendor = sli === 'INHOUSE'
        ? (i % 3 === 0 ? 'INHOUSE - SALES AGENT' : i % 3 === 1 ? 'INHOUSE - BUSINESS CENTER' : 'INHOUSE - TECHNICAL DEPARTMENT')
        : (prov === 'ALBAY' ? albayVendorsMSA[i % albayVendorsMSA.length] : prov === 'MASBATE' ? masbateVendorsMSA[i % masbateVendorsMSA.length] : sorsogonVendorsMSA[i % sorsogonVendorsMSA.length]);

      records.push({
        id: `jo-${idCounter++}`,
        joNumber: `${prefix}${10000 + fxIndex}`,
        stateOrProvince: prov,
        city: prov === 'ALBAY' ? (i % 2 === 0 ? 'LEGAZPI CITY' : 'DARAGA') : prov === 'MASBATE' ? 'MASBATE CITY' : (i % 2 === 0 ? 'SORSOGON CITY' : 'GUBAT'),
        barangayName: `Barangay ${(i % 15) + 1}`,
        packageName: 'FIBERX 1500',
        category: 'FIBERX',
        sliType: sli,
        vendorType: sli,
        vendor: vendor,
        closingDate: dateStr,
        activationDate: dateStr,
        monthActivated: 'September',
        status: 'Activated',
        amount: fiberXAmounts[fxIndex++],
        napCode: `${prov.substring(0, 3)}LP${(i % 10) + 1} P${(i % 8) + 1}`,
        napPort: `P${(i % 8) + 1}`,
        crew: `RV0${(i % 20) + 10}`,
        cpeSerialNo: `48575443${fxIndex.toString().padStart(6, '0')}`,
        agentCode: `${sli} Agent ${(i % 12) + 1}`,
        sliSystemCheckCrewCode: `CREW-${(i % 8) + 1}`,
        sli: vendor,
        slaHours: 18 + (i % 12),
      });
    }
  }

  addFiberXGroup('ALBAY', 'INHOUSE', 75);
  addFiberXGroup('ALBAY', 'MSA', 141);
  addFiberXGroup('MASBATE', 'INHOUSE', 38);
  addFiberXGroup('MASBATE', 'MSA', 45);
  addFiberXGroup('SORSOGON', 'INHOUSE', 32);
  addFiberXGroup('SORSOGON', 'MSA', 35);

  // 20 SME records (Total MRC = 78,490)
  // Albay Inhouse (5): 11000, 2499, 2000, 1449, 3500
  // Albay MSA (7): 2499, 2000, 1599, 1599, 1599, 1599, 3000
  // Masbate Inhouse (2): 6000, 2099
  // Masbate MSA (1): 3500
  // Sorsogon Inhouse (2): 2000, 1599
  // Sorsogon MSA (3): 21000, 6500, 1449
  const smeItems: Array<{ prov: Province; sli: SliType; amt: number; vendor: string; day: number; pkg: string }> = [
    { prov: 'ALBAY', sli: 'INHOUSE', amt: 11000, vendor: 'INHOUSE - SME', day: 7, pkg: 'FAST 11000' },
    { prov: 'ALBAY', sli: 'INHOUSE', amt: 2499, vendor: 'INHOUSE - TECHNICAL DEPARTMENT', day: 10, pkg: 'FAST 2499' },
    { prov: 'ALBAY', sli: 'INHOUSE', amt: 2000, vendor: 'INHOUSE - BUSINESS CENTER', day: 8, pkg: 'FLEXI BIZ 2000' },
    { prov: 'ALBAY', sli: 'INHOUSE', amt: 1449, vendor: 'INHOUSE - TECHNICAL DEPARTMENT', day: 12, pkg: 'FLEXI BIZ 1449' },
    { prov: 'ALBAY', sli: 'INHOUSE', amt: 3500, vendor: 'INHOUSE - SME', day: 15, pkg: 'FAST 3500' },

    { prov: 'ALBAY', sli: 'MSA', amt: 2499, vendor: 'SBAS', day: 13, pkg: 'FAST 2499' },
    { prov: 'ALBAY', sli: 'MSA', amt: 2000, vendor: 'SBAS', day: 7, pkg: 'FLEXI BIZ 2000' },
    { prov: 'ALBAY', sli: 'MSA', amt: 1599, vendor: 'SBAS', day: 3, pkg: 'FLEXI BIZ 1599' },
    { prov: 'ALBAY', sli: 'MSA', amt: 1599, vendor: 'TOUKON', day: 11, pkg: 'FLEXI BIZ 1599' },
    { prov: 'ALBAY', sli: 'MSA', amt: 1599, vendor: 'BRYTH', day: 2, pkg: 'FLEXI BIZ 1599' },
    { prov: 'ALBAY', sli: 'MSA', amt: 1599, vendor: 'A. NARVAEZ STORE', day: 5, pkg: 'FLEXI BIZ 1599' },
    { prov: 'ALBAY', sli: 'MSA', amt: 3000, vendor: 'SERAPH TRUCKING SERVICES', day: 14, pkg: 'FAST 3000' },

    { prov: 'MASBATE', sli: 'INHOUSE', amt: 6000, vendor: 'RAVENOUS SLI', day: 9, pkg: 'FAST 6000' },
    { prov: 'MASBATE', sli: 'INHOUSE', amt: 2099, vendor: 'INHOUSE - BUSINESS CENTER', day: 1, pkg: 'FLEXI BIZ 2099' },
    { prov: 'MASBATE', sli: 'MSA', amt: 3500, vendor: 'A. NARVAEZ STORE', day: 16, pkg: 'FAST 3500' },

    { prov: 'SORSOGON', sli: 'INHOUSE', amt: 2000, vendor: 'INHOUSE - SALES AGENT', day: 10, pkg: 'FLEXI BIZ 2000' },
    { prov: 'SORSOGON', sli: 'INHOUSE', amt: 1599, vendor: 'INHOUSE - BUSINESS CENTER', day: 11, pkg: 'FLEXI BIZ 1599' },

    { prov: 'SORSOGON', sli: 'MSA', amt: 21000, vendor: 'DOMINGUIANO ENTERPRISE', day: 7, pkg: 'ENTERPRISE 21000' },
    { prov: 'SORSOGON', sli: 'MSA', amt: 6500, vendor: 'DOMINGUIANO ENTERPRISE', day: 10, pkg: 'FAST 6500' },
    { prov: 'SORSOGON', sli: 'MSA', amt: 1449, vendor: 'DOMINGUIANO ENTERPRISE', day: 8, pkg: 'FLEXI BIZ 1449' },
  ];

  // Calibrate exact sum to 78,490
  const curSme = smeItems.reduce((a, b) => a + b.amt, 0);
  smeItems[smeItems.length - 1].amt += (78490 - curSme);

  smeItems.forEach((s) => {
    const dayStr = String(s.day).padStart(2, '0');
    const dateStr = `2026-09-${dayStr}`;
    records.push({
      id: `jo-${idCounter++}`,
      joNumber: `R3740${100 + idCounter}`,
      stateOrProvince: s.prov,
      city: s.prov === 'ALBAY' ? 'LEGAZPI CITY' : s.prov === 'MASBATE' ? 'MASBATE CITY' : 'GUBAT',
      barangayName: 'Commercial District',
      packageName: s.pkg,
      category: 'SME',
      sliType: s.sli,
      vendorType: s.sli,
      vendor: s.vendor,
      closingDate: dateStr,
      activationDate: dateStr,
      monthActivated: 'September',
      status: 'Activated',
      amount: s.amt,
      napCode: `${s.prov.substring(0, 3)}SME-LP01`,
      napPort: 'P1',
      crew: 'SME-CREW-1',
      cpeSerialNo: `48575443SME${idCounter.toString().padStart(3, '0')}`,
      agentCode: 'SME Enterprise Agent',
      sliSystemCheckCrewCode: 'CREW-SME',
      sli: s.vendor,
      slaHours: 24,
    });
  });

  // 2 BIDA records in Sorsogon Inhouse (Total MRC = 1,776)
  [8, 12].forEach((day) => {
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `2026-09-${dayStr}`;
    records.push({
      id: `jo-${idCounter++}`,
      joNumber: `BID37${1000 + idCounter}`,
      stateOrProvince: 'SORSOGON',
      city: 'CITY OF SORSOGON',
      barangayName: 'San Juan Poblacion',
      packageName: 'BIDA FIBER 888',
      category: 'BIDA',
      sliType: 'INHOUSE',
      vendorType: 'INHOUSE',
      vendor: 'INHOUSE - SALES AGENT',
      closingDate: dateStr,
      activationDate: dateStr,
      monthActivated: 'September',
      status: 'Activated',
      amount: 888,
      napCode: `SORBIDA LP0${day === 8 ? '1' : '3'} P1-O`,
      napPort: 'P1-O',
      crew: 'RV057-',
      cpeSerialNo: `48575443BID${day === 8 ? '01' : '02'}`,
      agentCode: 'INHOUSE - SALES AGENT Rep',
      sliSystemCheckCrewCode: 'RAVENOUS SLR',
      sli: 'INHOUSE - SALES AGENT',
      slaHours: 20,
    });
  });

  return records;
}
