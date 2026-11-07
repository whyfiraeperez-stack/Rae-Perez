import { JORecord, Province, SliType, PackageCategory } from '../types';

export interface GroupCombinationResult {
  key: string;
  province: string;
  sliType: string;
  packageName: string;
  monthActivated: string;
  count: number;
  totalMrc: number;
  category: PackageCategory;
}

export interface GroupingFilters {
  province?: string; // 'ALL' or specific province
  sliType?: string;  // 'ALL' or specific sliType
  packageName?: string; // 'ALL' or specific package
  monthActivated?: string; // 'ALL' or specific month
}

/**
 * The Authoritative Counting Engine for Almasor Performance Hub.
 * Uses the raw 'JO ACTIVATED' rows as the ONLY source of truth.
 *
 * The raw-data columns:
 * - Column G  = STATEORPROVINCE
 * - Column S  = SLI TYPE
 * - Column AA = MONTH ACTIVATED
 * - Column AC = PACKAGE
 *
 * Replaces any report-sheet cell references (such as C5, B8, C9, D7).
 * For every row in JO ACTIVATED:
 * 1. Read STATEORPROVINCE from column G
 * 2. Read SLI TYPE from column S
 * 3. Read MONTH ACTIVATED from column AA
 * 4. Read PACKAGE from column AC
 * 5. Create a unique grouping key:
 *    STATEORPROVINCE | SLI TYPE | PACKAGE | MONTH ACTIVATED
 * 6. Increment the count for that combination.
 */
export function groupAndCountJOActivated(records: JORecord[]): {
  combinations: GroupCombinationResult[];
  totalRecords: number;
  totalFiberX: number;
  totalSmeCount: number;
  totalSmeMrc: number;
  totalBidaCount: number;
  totalS2sCount: number;
  provinces: string[];
  sliTypes: string[];
  packages: string[];
  months: string[];
  filterResults: (filters: GroupingFilters) => {
    filteredCombinations: GroupCombinationResult[];
    totalCount: number;
    totalMrc: number;
  };
} {
  const map = new Map<string, GroupCombinationResult>();

  const provinceSet = new Set<string>();
  const sliTypeSet = new Set<string>();
  const packageSet = new Set<string>();
  const monthSet = new Set<string>();

  let totalFiberX = 0;
  let totalSmeCount = 0;
  let totalSmeMrc = 0;
  let totalBidaCount = 0;
  let totalS2sCount = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r) continue;

    // Step 1: Read STATEORPROVINCE from Column G
    const rawProv = (r.stateOrProvince || 'ALBAY').trim().toUpperCase();
    const province = rawProv || 'ALBAY';

    // Step 2: Read SLI TYPE from Column S
    const rawSli = (r.sliType || r.vendorType || 'INHOUSE').trim().toUpperCase();
    const sliType = rawSli.includes('MSA') ? 'MSA' : 'INHOUSE';

    // Step 3: Read MONTH ACTIVATED from Column AA
    const rawMonth = (r.monthActivated || 'September').trim();
    const monthActivated = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1).toLowerCase();

    // Step 4: Read PACKAGE from Column AC
    const rawPkg = (r.packageName || r.category || 'FIBERX').trim();
    // Normalize package identifier while preserving raw package name
    let packageName = rawPkg;
    const pkgUpper = rawPkg.toUpperCase();

    // Determine category
    let category: PackageCategory = 'FIBERX';
    if (pkgUpper === 'FIBERX' || pkgUpper.includes('FIBERX') || pkgUpper.includes('SUPER FIBERX')) {
      category = 'FIBERX';
      packageName = 'FIBERX';
    } else if (pkgUpper === 'SME' || pkgUpper.includes('BIZ') || pkgUpper.includes('SME') || pkgUpper.includes('MICRO') || pkgUpper.includes('BUSINESS')) {
      category = 'SME';
      packageName = 'SME';
    } else if (pkgUpper === 'BIDA' || pkgUpper.includes('BIDA')) {
      category = 'BIDA';
      packageName = 'BIDA';
    } else if (pkgUpper === 'S2S' || pkgUpper.includes('SURF')) {
      category = 'S2S';
      packageName = 'S2S';
    }

    // Step 5: Create unique grouping key:
    // STATEORPROVINCE | SLI TYPE | PACKAGE | MONTH ACTIVATED
    const key = `${province} | ${sliType} | ${packageName} | ${monthActivated}`;

    // Collect unique values for dynamic filter dropdowns
    provinceSet.add(province);
    sliTypeSet.add(sliType);
    packageSet.add(packageName);
    monthSet.add(monthActivated);

    const mrc = typeof r.amount === 'number' && !isNaN(r.amount) ? r.amount : 0;

    // Step 6: Increment count for that combination
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalMrc += mrc;
    } else {
      map.set(key, {
        key,
        province,
        sliType,
        packageName,
        monthActivated,
        count: 1,
        totalMrc: mrc,
        category,
      });
    }

    // Overall Category counters
    if (category === 'FIBERX') {
      totalFiberX++;
    } else if (category === 'SME') {
      totalSmeCount++;
      totalSmeMrc += mrc;
    } else if (category === 'BIDA') {
      totalBidaCount++;
    } else if (category === 'S2S') {
      totalS2sCount++;
    }
  }

  // Convert map to array sorted by Province, then SLI Type, then Package
  const combinations = Array.from(map.values()).sort((a, b) => {
    if (a.province !== b.province) return a.province.localeCompare(b.province);
    if (a.sliType !== b.sliType) return a.sliType.localeCompare(b.sliType);
    if (a.packageName !== b.packageName) return a.packageName.localeCompare(b.packageName);
    return a.monthActivated.localeCompare(b.monthActivated);
  });

  // Dynamic filter function
  const filterResults = (filters: GroupingFilters) => {
    const filteredCombinations = combinations.filter((c) => {
      if (filters.province && filters.province !== 'ALL' && c.province !== filters.province) {
        return false;
      }
      if (filters.sliType && filters.sliType !== 'ALL' && c.sliType !== filters.sliType) {
        return false;
      }
      if (filters.packageName && filters.packageName !== 'ALL' && c.packageName !== filters.packageName) {
        return false;
      }
      if (filters.monthActivated && filters.monthActivated !== 'ALL' && c.monthActivated.toLowerCase() !== filters.monthActivated.toLowerCase()) {
        return false;
      }
      return true;
    });

    const totalCount = filteredCombinations.reduce((acc, curr) => acc + curr.count, 0);
    const totalMrc = filteredCombinations.reduce((acc, curr) => acc + curr.totalMrc, 0);

    return { filteredCombinations, totalCount, totalMrc };
  };

  return {
    combinations,
    totalRecords: records.length,
    totalFiberX,
    totalSmeCount,
    totalSmeMrc,
    totalBidaCount,
    totalS2sCount,
    provinces: Array.from(provinceSet).sort(),
    sliTypes: Array.from(sliTypeSet).sort(),
    packages: Array.from(packageSet).sort(),
    months: Array.from(monthSet).sort(),
    filterResults,
  };
}
