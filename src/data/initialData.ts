import { JORecord, Province, SliType, PackageCategory } from '../types';

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
  reportDate: '14 Sep 2026',
  daysElapsed: 14,
  daysInMonth: 30,
  activatedYesterday: 9,
  activatedToday: 6,
  fsoi: 12,
  openJOsCloseout: 0,
  openJOsActivation: 0,
};

// Seed dataset generator matching exact counts from Photo 1 & 2:
// Evaluated using: Column G (Province), Column S (SLI Type), Column AA (Month Activated), Column AC (Package)
//
// Verified Counts from Photo 1 & 2:
// ALBAY:    62 Inhouse + 103 MSA = 165 FiberX | SME: ₱27,843 (4 Inhouse, 6 MSA)
// SORSOGON: 38 Inhouse +  30 MSA =  68 FiberX | SME: ₱32,048 (2 Inhouse, 3 MSA) | BIDA: 2
// MASBATE:  38 Inhouse +  36 MSA =  74 FiberX | SME: ₱8,099  (2 Inhouse, 0 MSA)
// TOTAL FIBERX: 138 Inhouse + 169 MSA = 307
// TOTAL SME: ₱67,990.00 (17 packages) | VAT EX (12%): ₱59,831.20
// TOTAL BIDA: 2
// GRAND TOTAL ACTIVATED JOS: 326 records
export function generateInitialRecords(): JORecord[] {
  const records: JORecord[] = [];
  let idCounter = 1;

  const cityPool: Record<Province, string[]> = {
    ALBAY: ['CITY OF LEGAZPI', 'CITY OF TABACO', 'CITY OF LIGAO', 'GUINOBATAN', 'DARAGA', 'POLANGUI', 'CAMALIG', 'SANTO DOMINGO', 'PIO DURAN'],
    SORSOGON: ['CITY OF SORSOGON', 'CASTILLA', 'PILAR', 'BULAN', 'GUBAT', 'IROSIN', 'JUBAN', 'BARCELONA', 'BULUSAN', 'MAGALLANES'],
    MASBATE: ['MASBATE CITY', 'AROROY', 'MOBO', 'MILAGROS', 'BALENO', 'DIMASALANG', 'USON', 'CAWAYAN'],
  };

  const fiberXPackages = [
    'FIBERX',
    'FIBERX 1500',
    'FIBERX 1250',
    'SUPER FIBERX MAX',
    'FIBERX 1500 100M',
    'FIBERX NETFLIX',
  ];

  // Deterministic generator helper for FiberX records
  function addFiberXGroup(
    vendor: string,
    vendorType: SliType,
    province: Province,
    count: number,
    codePrefix: string
  ) {
    const cities = cityPool[province];
    for (let i = 0; i < count; i++) {
      const city = cities[i % cities.length];
      const pkg = fiberXPackages[(idCounter + i) % fiberXPackages.length];
      const day = ((i * 2 + idCounter) % 30) + 1;
      const dateStr = `2026-09-${day.toString().padStart(2, '0')}`;
      const napId = ((i + 1) * 7) % 89 + 1;
      const portId = (i % 8) + 1;
      const sla = 16 + ((i * 4) % 18);

      records.push({
        id: `jo-${idCounter++}`,
        joNumber: `${codePrefix}${3700000 + idCounter}`,
        stateOrProvince: province,
        city,
        barangayName: `Zone ${(i % 12) + 1} Poblacion`,
        packageName: 'FIBERX',
        category: 'FIBERX',
        napCode: `${province.substring(0, 3)}001 LP${napId} NP P${portId}-O`,
        napPort: `P${portId}-O`,
        crew: vendorType === 'INHOUSE' ? 'RV069-' : 'RV115-',
        cpeSerialNo: `48575443${(10000 + idCounter).toString(16).toUpperCase()}`,
        agentCode: `${vendor} Rep ${(i % 5) + 1}`,
        sliSystemCheckCrewCode: vendorType === 'INHOUSE' ? 'RAVENOUS SLR' : vendor,
        sli: vendor,
        sliType: vendorType,
        vendor,
        vendorType,
        activationDate: dateStr,
        closingDate: dateStr,
        monthActivated: 'September',
        status: 'Activated',
        amount: 1500,
        slaHours: sla,
      });
    }
  }

  // --- 1. ALBAY FIBERX: Exactly 62 INHOUSE, 103 MSA -> Total 165 ---
  // Inhouse Albay (62):
  addFiberXGroup('INHOUSE - SALES AGENT', 'INHOUSE', 'ALBAY', 22, 'R');
  addFiberXGroup('RAVENOUS SLI', 'INHOUSE', 'ALBAY', 17, 'R');
  addFiberXGroup('INHOUSE - BUSINESS CENTER', 'INHOUSE', 'ALBAY', 12, 'J');
  addFiberXGroup('INHOUSE - TECHNICAL DEPARTMENT', 'INHOUSE', 'ALBAY', 7, 'R');
  addFiberXGroup('INHOUSE - SME', 'INHOUSE', 'ALBAY', 3, 'R');
  addFiberXGroup('TELEDIGISALES', 'INHOUSE', 'ALBAY', 1, 'R');

  // MSA Albay (103):
  addFiberXGroup('A. NARVAEZ STORE', 'MSA', 'ALBAY', 33, 'R');
  addFiberXGroup('SERAPH TRUCKING SERVICES', 'MSA', 'ALBAY', 22, 'R');
  addFiberXGroup('BRYTH', 'MSA', 'ALBAY', 20, 'R');
  addFiberXGroup('SBAS', 'MSA', 'ALBAY', 15, 'R');
  addFiberXGroup('DOMINGUIANO ENTERPRISE', 'MSA', 'ALBAY', 7, 'R');
  addFiberXGroup('TOUKON', 'MSA', 'ALBAY', 6, 'R');

  // --- 2. SORSOGON FIBERX: Exactly 38 INHOUSE, 30 MSA -> Total 68 ---
  // Inhouse Sorsogon (38):
  addFiberXGroup('RAVENOUS SLI', 'INHOUSE', 'SORSOGON', 14, 'R');
  addFiberXGroup('INHOUSE - SALES AGENT', 'INHOUSE', 'SORSOGON', 9, 'R');
  addFiberXGroup('INHOUSE - BUSINESS CENTER', 'INHOUSE', 'SORSOGON', 9, 'J');
  addFiberXGroup('INHOUSE - TECHNICAL DEPARTMENT', 'INHOUSE', 'SORSOGON', 3, 'R');
  addFiberXGroup('INHOUSE - SME', 'INHOUSE', 'SORSOGON', 2, 'R');
  addFiberXGroup('TELEDIGISALES', 'INHOUSE', 'SORSOGON', 1, 'R');

  // MSA Sorsogon (30):
  addFiberXGroup('A. NARVAEZ STORE', 'MSA', 'SORSOGON', 24, 'R');
  addFiberXGroup('SERAPH TRUCKING SERVICES', 'MSA', 'SORSOGON', 5, 'R');
  addFiberXGroup('BRYTH', 'MSA', 'SORSOGON', 1, 'R');

  // --- 3. MASBATE FIBERX: Exactly 38 INHOUSE, 36 MSA -> Total 74 ---
  // Inhouse Masbate (38):
  addFiberXGroup('INHOUSE - BUSINESS CENTER', 'INHOUSE', 'MASBATE', 10, 'J');
  addFiberXGroup('INHOUSE - TECHNICAL DEPARTMENT', 'INHOUSE', 'MASBATE', 9, 'R');
  addFiberXGroup('RAVENOUS SLI', 'INHOUSE', 'MASBATE', 7, 'R');
  addFiberXGroup('INHOUSE - SALES AGENT', 'INHOUSE', 'MASBATE', 4, 'R');
  addFiberXGroup('INHOUSE - SME', 'INHOUSE', 'MASBATE', 4, 'R');
  addFiberXGroup('TELEDIGISALES', 'INHOUSE', 'MASBATE', 3, 'R');
  addFiberXGroup('ONLINE APPLICATION', 'INHOUSE', 'MASBATE', 1, 'R');

  // MSA Masbate (36):
  addFiberXGroup('A. NARVAEZ STORE', 'MSA', 'MASBATE', 15, 'R');
  addFiberXGroup('SERAPH TRUCKING SERVICES', 'MSA', 'MASBATE', 11, 'R');
  addFiberXGroup('BRYTH', 'MSA', 'MASBATE', 9, 'R');
  addFiberXGroup('SBAS', 'MSA', 'MASBATE', 1, 'R');

  // --- 4. SME PACKAGES: Exactly ₱67,990.00 across 17 packages ---
  // Using exact Column G (Province), Column S (SLI Type), Column AA (Month Activated), Column AC (Package), Column AE (MRC)
  
  // Albay Inhouse SME (4 packages = ₱16,948.00):
  const albayInhouseSme = [
    { jo: 'R3740007', pkg: 'SME', amt: 1449, vendor: 'INHOUSE - TECHNICAL DEPARTMENT', crew: 'Karl Justin Mora Morada Eclarinal', day: 12 },
    { jo: 'R3740015', pkg: 'SME', amt: 11000, vendor: 'INHOUSE - SME', crew: 'Mediavillo, Jonel Miraflor', day: 7 },
    { jo: 'R3740016', pkg: 'SME', amt: 2000, vendor: 'INHOUSE - BUSINESS CENTER', crew: 'INHOUSE - BC', day: 8 },
    { jo: 'R3740017', pkg: 'SME', amt: 2499, vendor: 'INHOUSE - TECHNICAL DEPARTMENT', crew: 'Mediavillo, Jonel Miraflor', day: 10 },
  ];
  albayInhouseSme.forEach((s) => {
    records.push({
      id: `jo-${idCounter++}`,
      joNumber: s.jo,
      stateOrProvince: 'ALBAY',
      city: 'CITY OF LEGAZPI',
      barangayName: 'Central Commercial Hub',
      packageName: s.pkg,
      category: 'SME',
      napCode: 'ALBSME LP01 P2-O',
      napPort: 'P2-O',
      crew: s.crew,
      cpeSerialNo: `48575443${(20000 + idCounter).toString(16).toUpperCase()}`,
      agentCode: `${s.vendor} Rep`,
      sliSystemCheckCrewCode: s.crew,
      sli: s.vendor,
      sliType: 'INHOUSE',
      vendor: s.vendor,
      vendorType: 'INHOUSE',
      activationDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      closingDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      monthActivated: 'September',
      status: 'Activated',
      amount: s.amt,
      slaHours: 24,
    });
  });

  // Albay MSA SME (6 packages = ₱10,895.00):
  const albayMsaSme = [
    { jo: 'R3740004', pkg: 'SME', amt: 1599, vendor: 'SBAS', crew: 'ALVIN B. SARCAUGA', day: 3 },
    { jo: 'R3740005', pkg: 'SME', amt: 2499, vendor: 'SBAS', crew: 'ALVIN B. SARCAUGA', day: 13 },
    { jo: 'R3740006', pkg: 'SME', amt: 2000, vendor: 'SBAS', crew: 'ALVIN B. SARCAUGA', day: 7 },
    { jo: 'R3740008', pkg: 'SME', amt: 1599, vendor: 'TOUKON', crew: 'Richard Arimado', day: 11 },
    { jo: 'R3740009', pkg: 'SME', amt: 1599, vendor: 'BRYTH', crew: 'Allan Bonina', day: 2 },
    { jo: 'R3740010', pkg: 'SME', amt: 1599, vendor: 'A. NARVAEZ STORE', crew: 'Felix Andes', day: 5 },
  ];
  albayMsaSme.forEach((s) => {
    records.push({
      id: `jo-${idCounter++}`,
      joNumber: s.jo,
      stateOrProvince: 'ALBAY',
      city: 'DARAGA',
      barangayName: 'Market Commercial Area',
      packageName: s.pkg,
      category: 'SME',
      napCode: 'ALBSME LP04 P4-O',
      napPort: 'P4-O',
      crew: s.crew,
      cpeSerialNo: `48575443${(20000 + idCounter).toString(16).toUpperCase()}`,
      agentCode: `${s.vendor} Rep`,
      sliSystemCheckCrewCode: s.crew,
      sli: s.vendor,
      sliType: 'MSA',
      vendor: s.vendor,
      vendorType: 'MSA',
      activationDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      closingDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      monthActivated: 'September',
      status: 'Activated',
      amount: s.amt,
      slaHours: 22,
    });
  });

  // Sorsogon Inhouse SME (2 packages = ₱3,599.00):
  const sorsogonInhouseSme = [
    { jo: 'R3740001', pkg: 'SME', amt: 1599, vendor: 'INHOUSE - BUSINESS CENTER', crew: 'Dometita, Lance', day: 11 },
    { jo: 'R3740012', pkg: 'SME', amt: 2000, vendor: 'INHOUSE - SALES AGENT', crew: 'Salvador Monde Salvador Mondejar', day: 10 },
  ];
  sorsogonInhouseSme.forEach((s) => {
    records.push({
      id: `jo-${idCounter++}`,
      joNumber: s.jo,
      stateOrProvince: 'SORSOGON',
      city: 'CITY OF SORSOGON',
      barangayName: 'Piot Commercial Area',
      packageName: s.pkg,
      category: 'SME',
      napCode: 'SORSME LP02 P1-O',
      napPort: 'P1-O',
      crew: s.crew,
      cpeSerialNo: `48575443${(20000 + idCounter).toString(16).toUpperCase()}`,
      agentCode: `${s.vendor} Rep`,
      sliSystemCheckCrewCode: s.crew,
      sli: s.vendor,
      sliType: 'INHOUSE',
      vendor: s.vendor,
      vendorType: 'INHOUSE',
      activationDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      closingDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      monthActivated: 'September',
      status: 'Activated',
      amount: s.amt,
      slaHours: 26,
    });
  });

  // Sorsogon MSA SME (3 packages = ₱28,449.00):
  // Col G: SORSOGON, Col S: MSA, Col AA: September, Col AC: SME, Col AE: MRC
  const sorsogonMsaSme = [
    { jo: 'R3740002', pkg: 'SME', amt: 21000, vendor: 'DOMINGUIANO ENTERPRISE', crew: 'Fuentes, Jessica', day: 7 },
    { jo: 'R3740003', pkg: 'SME', amt: 1449, vendor: 'DOMINGUIANO ENTERPRISE', crew: 'Fuentes, Jessica', day: 8 },
    { jo: 'R3740013', pkg: 'SME', amt: 6000, vendor: 'DOMINGUIANO ENTERPRISE', crew: 'Ernesto Roman', day: 10 },
  ];
  sorsogonMsaSme.forEach((s) => {
    records.push({
      id: `jo-${idCounter++}`,
      joNumber: s.jo,
      stateOrProvince: 'SORSOGON',
      city: 'GUBAT',
      barangayName: 'Bulacao Commercial Area',
      packageName: s.pkg,
      category: 'SME',
      napCode: 'SORSME LP05 P3-O',
      napPort: 'P3-O',
      crew: s.crew,
      cpeSerialNo: `48575443${(20000 + idCounter).toString(16).toUpperCase()}`,
      agentCode: `${s.vendor} Rep`,
      sliSystemCheckCrewCode: s.crew,
      sli: s.vendor,
      sliType: 'MSA',
      vendor: s.vendor,
      vendorType: 'MSA',
      activationDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      closingDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      monthActivated: 'September',
      status: 'Activated',
      amount: s.amt,
      slaHours: 24,
    });
  });

  // Masbate Inhouse SME (2 packages = ₱8,099.00):
  const masbateInhouseSme = [
    { jo: 'R3740011', pkg: 'SME', amt: 6000, vendor: 'RAVENOUS SLI', crew: 'Gallarte, Jomar', day: 9 },
    { jo: 'R3740014', pkg: 'SME', amt: 2099, vendor: 'INHOUSE - BUSINESS CENTER', crew: 'Bondad, Marvin Cabug', day: 1 },
  ];
  masbateInhouseSme.forEach((s) => {
    records.push({
      id: `jo-${idCounter++}`,
      joNumber: s.jo,
      stateOrProvince: 'MASBATE',
      city: 'MASBATE CITY',
      barangayName: 'Port Commercial Center',
      packageName: s.pkg,
      category: 'SME',
      napCode: 'MASSME LP01 P2-O',
      napPort: 'P2-O',
      crew: s.crew,
      cpeSerialNo: `48575443${(20000 + idCounter).toString(16).toUpperCase()}`,
      agentCode: `${s.vendor} Rep`,
      sliSystemCheckCrewCode: s.crew,
      sli: s.vendor,
      sliType: 'INHOUSE',
      vendor: s.vendor,
      vendorType: 'INHOUSE',
      activationDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      closingDate: `2026-09-${s.day.toString().padStart(2, '0')}`,
      monthActivated: 'September',
      status: 'Activated',
      amount: s.amt,
      slaHours: 24,
    });
  });

  // --- 5. BIDA PACKAGES: Exactly 2 in Sorsogon Inhouse ---
  records.push(
    {
      id: `jo-${idCounter++}`,
      joNumber: `BID3791001`,
      stateOrProvince: 'SORSOGON',
      city: 'CITY OF SORSOGON',
      barangayName: 'San Juan Poblacion',
      packageName: 'BIDA FIBER 888',
      category: 'BIDA',
      napCode: 'SORBIDA LP01 P1-O',
      napPort: 'P1-O',
      crew: 'RV057-',
      cpeSerialNo: `48575443BID01`,
      agentCode: 'INHOUSE - SALES AGENT Rep',
      sliSystemCheckCrewCode: 'RAVENOUS SLR',
      sli: 'INHOUSE - SALES AGENT',
      sliType: 'INHOUSE',
      vendor: 'INHOUSE - SALES AGENT',
      vendorType: 'INHOUSE',
      activationDate: '2026-09-08',
      closingDate: '2026-09-08',
      monthActivated: 'September',
      status: 'Activated',
      amount: 888,
      slaHours: 19,
    },
    {
      id: `jo-${idCounter++}`,
      joNumber: `BID3791002`,
      stateOrProvince: 'SORSOGON',
      city: 'CASTILLA',
      barangayName: 'Cumadcad Central',
      packageName: 'BIDA FIBER 888',
      category: 'BIDA',
      napCode: 'SORBIDA LP03 P4-O',
      napPort: 'P4-O',
      crew: 'RV057-',
      cpeSerialNo: `48575443BID02`,
      agentCode: 'INHOUSE - SALES AGENT Rep',
      sliSystemCheckCrewCode: 'RAVENOUS SLR',
      sli: 'INHOUSE - SALES AGENT',
      sliType: 'INHOUSE',
      vendor: 'INHOUSE - SALES AGENT',
      vendorType: 'INHOUSE',
      activationDate: '2026-09-12',
      closingDate: '2026-09-12',
      monthActivated: 'September',
      status: 'Activated',
      amount: 888,
      slaHours: 21,
    }
  );

  return records;
}
