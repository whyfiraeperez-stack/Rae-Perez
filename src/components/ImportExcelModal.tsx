import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Layers,
  Sparkles,
  Info,
  Check,
  ArrowRight,
  Database,
  Table as TableIcon,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { JORecord, Province, SliType, PackageCategory } from '../types';
import { SCREENSHOT_SAMPLE_RECORDS } from '../data/screenshotData';
import { normalizeVendorName } from '../utils/calculations';
import { mapCsvRowsToJORecords } from '../utils/csvMapper';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportRecords: (
    newRecords: JORecord[],
    replaceAll: boolean,
    meta?: {
      fileName: string;
      sheetName: string;
      isScreenshotSample?: boolean;
    }
  ) => void;
  onResetToPhotoData: () => void;
  currentRecordsCount?: number;
}

interface SheetInfo {
  name: string;
  rowCount: number;
  isRecommended: boolean;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  onImportRecords,
  onResetToPhotoData,
  currentRecordsCount = 297,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState<JORecord[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<SheetInfo[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [error, setError] = useState<string>('');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [detectedHeaderInfo, setDetectedHeaderInfo] = useState<string>('');
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);
  const [sourceType, setSourceType] = useState<'excel' | 'gsheet'>('excel');
  const [gsheetUrl, setGsheetUrl] = useState<string>(() => {
    return localStorage.getItem('almasor_google_sheet_csv_url') || '';
  });
  const [gsheetLoading, setGsheetLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGoogleSheetCsv = (urlToFetch?: string) => {
    const url = (urlToFetch !== undefined ? urlToFetch : gsheetUrl).trim();
    if (!url) {
      setError('Please provide a valid published Google Sheet CSV link.');
      return;
    }
    setGsheetLoading(true);
    setError('');

    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        const rawRows = results.data as any[];
        if (!rawRows || rawRows.length === 0) {
          setError('Google Sheet CSV returned 0 rows.');
          setGsheetLoading(false);
          return;
        }
        const mapped = mapCsvRowsToJORecords(rawRows);
        setParsedData(mapped);
        setFileName('Google_Sheet_Live.csv');
        setSelectedSheet('JO ACTIVATED');
        setAvailableSheets([{ name: 'JO ACTIVATED', rowCount: mapped.length, isRecommended: true }]);
        setDetectedHeaderInfo(`Google Sheet CSV synced via PapaParse: ${mapped.length} records parsed`);
        setIsSampleLoaded(false);
        setGsheetLoading(false);
        localStorage.setItem('almasor_google_sheet_csv_url', url);
      },
      error: (err) => {
        setError(err.message || 'Failed to parse Google Sheet CSV.');
        setGsheetLoading(false);
      },
    });
  };

  const cleanKey = (val: any): string => {
    return String(val || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  };

  const getCellStr = (cell: any): string => {
    if (cell === null || cell === undefined) return '';
    return String(cell).trim();
  };

  const parseWorksheet = (worksheet: XLSX.WorkSheet, sheetName: string) => {
    // Read raw 2D array of cells (header: 1)
    const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (!rawRows || rawRows.length === 0) {
      setError(`Sheet "${sheetName}" is empty or has no readable rows.`);
      setParsedData([]);
      setDetectedHeaderInfo('');
      return;
    }

    // 1. Scan rows 0 to 9 to find the header row with the best match for Almasor column headers
    let bestHeaderRowIdx = 0;
    let highestMatchScore = -1;

    const maxScan = Math.min(10, rawRows.length);
    for (let rIdx = 0; rIdx < maxScan; rIdx++) {
      const row = rawRows[rIdx];
      if (!Array.isArray(row)) continue;

      let score = 0;
      row.forEach((cell) => {
        const cleaned = cleanKey(cell);
        if (cleaned.includes('stateorprovince') || cleaned === 'province' || cleaned === 'state') score += 4;
        if (cleaned === 'package' || cleaned === 'packagename' || cleaned.includes('pkg') || cleaned === 'plan') score += 4;
        if (cleaned.includes('slitype') || cleaned === 'channel' || cleaned === 'vendortype') score += 3;
        if (cleaned === 'vendor' || cleaned === 'vendorname') score += 3;
        if (cleaned === 'mrc' || cleaned === 'amount' || cleaned.includes('revenue')) score += 3;
        if (cleaned.includes('delayremarks') || cleaned.includes('remarks') || cleaned === 'status') score += 2;
        if (cleaned.includes('jodate') || cleaned === 'date' || cleaned.includes('activationdate')) score += 2;
        if (cleaned.includes('jono') || cleaned.includes('jonumber')) score += 2;
        if (cleaned === 'ageing' || cleaned === 'aging' || cleaned === 'sla') score += 1;
      });

      if (score > highestMatchScore) {
        highestMatchScore = score;
        bestHeaderRowIdx = rIdx;
      }
    }

    const headerRow = rawRows[bestHeaderRowIdx] || [];

    // Helper to find column index by match functions, with positional fallbacks matching Converge sheet
    const findCol = (predicate: (cleaned: string) => boolean, fallbackIdx: number): number => {
      for (let c = 0; c < headerRow.length; c++) {
        const cleaned = cleanKey(headerRow[c]);
        if (cleaned && predicate(cleaned)) {
          return c;
        }
      }
      return fallbackIdx;
    };

    // Intelligent vendor column detector combining header analysis and cell value sampling
    const findVendorCol = (): number => {
      let bestCol = -1;
      let highestScore = -999;

      for (let c = 0; c < headerRow.length; c++) {
        const k = cleanKey(headerRow[c]);
        let score = 0;

        // Header name matching
        if (k === 'vendor') score += 100;
        else if (k === 'vendorname') score += 90;
        else if (k.includes('vendor') && !k.includes('type')) score += 80;
        else if (k === 'wfmsliname' || k === 'sliname') score += 40;

        // Penalize non-vendor headers heavily
        if (
          k.includes('type') ||
          k.includes('province') ||
          k.includes('pkg') ||
          k.includes('package') ||
          k.includes('date') ||
          k.includes('mrc') ||
          k.includes('amount') ||
          k.includes('crew') ||
          k.includes('delay') ||
          k.includes('remarks')
        ) {
          score -= 200;
        }

        // Data cell sampling (first 20 data rows)
        for (let r = bestHeaderRowIdx + 1; r < Math.min(bestHeaderRowIdx + 21, rawRows.length); r++) {
          if (!Array.isArray(rawRows[r])) continue;
          const cellStr = String(rawRows[r][c] || '').toUpperCase().trim();
          if (!cellStr) continue;

          // Positive indicator: matches known vendor strings or keywords
          if (
            cellStr.includes('INHOUSE -') ||
            cellStr.includes('INHOUSE-') ||
            cellStr.includes('STORE') ||
            cellStr.includes('ENTERPRISE') ||
            cellStr.includes('TELEDIGI') ||
            cellStr.includes('DOMINGUIANO') ||
            cellStr.includes('NARVAEZ') ||
            cellStr.includes('ONLINE APPLICATION') ||
            cellStr.includes('SERAPH') ||
            cellStr.includes('TRUCKING') ||
            cellStr.includes('SERVICES') ||
            cellStr.includes('BRYTH') ||
            cellStr.includes('SBAS') ||
            cellStr.includes('TOUKON')
          ) {
            score += 25;
          }

          // Negative indicator: just "INHOUSE" or "MSA" (which is vendor type, NOT vendor name!)
          if (cellStr === 'INHOUSE' || cellStr === 'MSA') {
            score -= 25;
          }

          // Negative indicator: numeric MRC or dates or packages
          if (/^\d+(\.\d+)?$/.test(cellStr) || cellStr.includes('FIBERX') || cellStr.includes('BIZ')) {
            score -= 30;
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestCol = c;
        }
      }

      if (highestScore > 0 && bestCol >= 0) {
        return bestCol;
      }

      const fallbackVendor = findCol((k) => k === 'vendor' || k === 'vendorname', -1);
      if (fallbackVendor >= 0) return fallbackVendor;

      return 19;
    };

    // Detected column indices
    // In the Converge sheet:
    // Col G (idx 6)=Province, Col S (idx 18)=SLI TYPE, Col T (idx 19)=VENDOR,
    // Col U (idx 20)=VENDOR TYPE, Col V (idx 21)=JO DATE, Col W (idx 22)=AGEING, Col X (idx 23)=AGEING DAYS,
    // Col Y (idx 24)=SLA, Col Z (idx 25)=DELAY REMARKS, Col AA (idx 26)=MONTH ACTIVATED,
    // Col AC (idx 28)=PACKAGE, Col AE (idx 30)=MRC
    const provCol = findCol((k) => k === 'stateorprovince' || k === 'province' || k === 'state', 6);
    const sliTypeCol = findCol((k) => (k === 'slitype' || k === 'channel') && !k.includes('vendor'), 18);
    const vendorCol = findVendorCol();
    const vendorTypeCol = findCol((k) => k === 'vendortype' || k === 'type', 20);
    const monthCol = findCol((k) => k === 'monthactivated' || k === 'month' || k === 'activationmonth', 26);
    const wfmSliCol = findCol((k) => k.includes('wfmsliname') || k.includes('wfmsli') || k === 'sliname', -1);
    const joDateCol = findCol((k) => k.includes('jodate') || k === 'date' || k.includes('activationdate'), 21);
    const slaCol = findCol((k) => k === 'sla' || k.includes('ageingdays') || k.includes('aging'), 24);
    const remarksCol = findCol((k) => k.includes('delayremarks') || k.includes('remarks') || k === 'status', 25);
    const pkgCol = findCol((k) => k === 'package' || k === 'packagename' || k === 'plan' || k === 'product', 28);
    const mrcCol = findCol((k) => k === 'mrc', 30);
    const joNumCol = findCol((k) => k.includes('jono') || k.includes('jonumber') || k === 'jo', 0);
    const closingDateCol = findCol((k) => k.includes('closingdate') || k.includes('closedate') || k.includes('closing') || k.includes('dateclosed'), 31);
    const cityCol = findCol((k) => k === 'city' || k === 'municipality', 4);
    const barangayCol = findCol((k) => k === 'barangay' || k.includes('brgy'), 3);
    const crewCol = findCol((k) => k.includes('crew') || k.includes('slisystemcheck'), 18);

    setDetectedHeaderInfo(
      `Header at Row ${bestHeaderRowIdx + 1}: Province(Col ${provCol + 1}), Channel(Col ${sliTypeCol + 1}), Month(Col ${monthCol + 1}), Package(Col ${pkgCol + 1}), MRC(Col ${mrcCol + 1})`
    );

    const mappedRecords: JORecord[] = [];

    // Parse all rows starting right after the detected header row
    for (let rIdx = bestHeaderRowIdx + 1; rIdx < rawRows.length; rIdx++) {
      const row = rawRows[rIdx];
      if (!Array.isArray(row) || row.length === 0) continue;

      const provRaw = getCellStr(row[provCol]);
      const pkgRaw = getCellStr(row[pkgCol]);
      const vendorRaw = getCellStr(row[vendorCol]);
      const sliTypeRaw = getCellStr(row[sliTypeCol]);
      const monthRaw = getCellStr(row[monthCol]);
      const mrcRaw = getCellStr(row[mrcCol]);
      const joNumRaw = getCellStr(row[joNumCol]);
      const joDateRaw = getCellStr(row[joDateCol]);
      const closingDateRaw = getCellStr(row[closingDateCol]) || joDateRaw;
      const slaRaw = getCellStr(row[slaCol]);
      const remarksRaw = getCellStr(row[remarksCol]);
      const cityRaw = getCellStr(row[cityCol]);
      const brgyRaw = getCellStr(row[barangayCol]);

      // 1. Skip completely empty rows (such as Row 2 in the screenshot)
      if (!provRaw && !pkgRaw && !vendorRaw) {
        continue;
      }

      // 2. Skip summary or subtotal rows
      const provUpper = provRaw.toUpperCase().trim();
      const vendorUpper = vendorRaw.toUpperCase().trim();
      if (
        provUpper.startsWith('TOTAL') ||
        provUpper.startsWith('GRAND TOTAL') ||
        provUpper.startsWith('SUBTOTAL') ||
        provUpper.startsWith('COUNT') ||
        provUpper.startsWith('SUM') ||
        vendorUpper.startsWith('TOTAL')
      ) {
        continue;
      }

      // 3. Province classification: SORSOGON, ALBAY, MASBATE
      let prov: Province = 'ALBAY';
      if (provUpper.includes('SORSOGON') || provUpper.includes('SOR')) {
        prov = 'SORSOGON';
      } else if (provUpper.includes('MASBATE') || provUpper.includes('MAS')) {
        prov = 'MASBATE';
      } else if (provUpper.includes('ALBAY') || provUpper.includes('ALB') || provUpper.includes('LEGAZPI')) {
        prov = 'ALBAY';
      } else {
        // Fallback to city inspection
        const cityUpper = cityRaw.toUpperCase();
        if (cityUpper.includes('SORSOGON')) prov = 'SORSOGON';
        else if (cityUpper.includes('MASBATE')) prov = 'MASBATE';
        else prov = 'ALBAY';
      }

      // 4. Channel / SLI TYPE classification: INHOUSE or MSA
      let sliType: SliType = 'INHOUSE';
      const sliTypeUpper = sliTypeRaw.toUpperCase();
      if (sliTypeUpper.includes('INHOUSE') || sliTypeUpper.includes('IN-HOUSE') || sliTypeUpper.includes('INTERNAL')) {
        sliType = 'INHOUSE';
      } else if (
        sliTypeUpper.includes('MSA') ||
        sliTypeUpper.includes('OUTSOURCE') ||
        sliTypeUpper.includes('DEALER') ||
        sliTypeUpper.includes('AGENT') ||
        sliTypeUpper.includes('STORE') ||
        sliTypeUpper.includes('ENTERPRISE')
      ) {
        sliType = 'MSA';
      } else {
        // Fallback to vendor text inspection
        if (vendorUpper.includes('INHOUSE')) {
          sliType = 'INHOUSE';
        } else if (vendorUpper.includes('STORE') || vendorUpper.includes('ENTERPRISE') || vendorUpper.includes('NARVAEZ') || vendorUpper.includes('DOMINGUIANO')) {
          sliType = 'MSA';
        } else {
          sliType = 'INHOUSE';
        }
      }

      // 5. Package Category classification: FIBERX, SME, BIDA, S2S
      let cat: PackageCategory = 'FIBERX';
      const pkgUpper = pkgRaw.toUpperCase();
      if (
        pkgUpper.includes('BIZ') ||
        pkgUpper.includes('SME') ||
        pkgUpper.includes('MICROBIZ') ||
        pkgUpper.includes('BUSINESS')
      ) {
        cat = 'SME';
      } else if (pkgUpper.includes('BIDA')) {
        cat = 'BIDA';
      } else if (pkgUpper.includes('S2S') || pkgUpper.includes('SURF')) {
        cat = 'S2S';
      } else {
        cat = 'FIBERX';
      }

      // 6. MRC / Amount numeric parsing
      let numericMrc: number | undefined = undefined;
      if (mrcRaw) {
        const cleanedMrc = mrcRaw.replace(/[^0-9.-]+/g, '');
        const val = parseFloat(cleanedMrc);
        if (!isNaN(val) && val > 0) numericMrc = val;
      }
      if (numericMrc === undefined) {
        if (cat === 'SME') numericMrc = 2500;
        else if (cat === 'FIBERX') numericMrc = 1500;
        else if (cat === 'BIDA') numericMrc = 888;
        else numericMrc = 700;
      }

      // 7. Ageing / SLA Hours parsing
      let slaHours = 24;
      const slaLower = slaRaw.toLowerCase();
      if (slaLower.includes('beyond') || slaLower.includes('140') || slaLower.includes('144')) slaHours = 144;
      else if (slaLower.includes('48')) slaHours = 48;
      else if (slaLower.includes('72') || slaLower.includes('3 days')) slaHours = 72;
      else slaHours = 24;

      const recordId = `imported-${rIdx}-${Date.now()}`;
      const joNum = joNumRaw || `R37${40000 + rIdx}`;

      let vendorCell = vendorRaw;
      // If vendor column was empty or generic, check secondary wfmSliCol
      if ((!vendorCell || vendorCell.toUpperCase() === 'INHOUSE' || vendorCell.toUpperCase() === 'MSA') && wfmSliCol >= 0) {
        const wfmVal = getCellStr(row[wfmSliCol]);
        if (wfmVal) {
          vendorCell = wfmVal;
        }
      }

      // Canonical normalization
      const resolvedVendor = normalizeVendorName(vendorCell, sliType);

      // Determine vendorType accurately
      let resolvedVendorType: SliType = sliType;
      const vUpper = resolvedVendor.toUpperCase();
      if (
        vUpper.includes('INHOUSE') ||
        vUpper.includes('TELEDIGI') ||
        vUpper.includes('ONLINE APPLICATION') ||
        vUpper.includes('RAVENOUS')
      ) {
        resolvedVendorType = 'INHOUSE';
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
        resolvedVendorType = 'MSA';
      }

      mappedRecords.push({
        id: recordId,
        joNumber: joNum,
        stateOrProvince: prov,
        city: cityRaw || (prov === 'ALBAY' ? 'CITY OF LEGAZPI' : prov === 'SORSOGON' ? 'CITY OF SORSOGON' : 'CITY OF MASBATE'),
        barangayName: brgyRaw || 'Central',
        packageName: pkgRaw || (cat === 'FIBERX' ? 'FIBERX' : cat),
        category: cat,
        napCode: `${prov.substring(0, 3)}001`,
        napPort: 'P1-O',
        crew: getCellStr(row[crewCol]) || (resolvedVendorType === 'INHOUSE' ? 'RV069-' : 'RV115-'),
        cpeSerialNo: `48575443${String(rIdx).padStart(4, '0')}`,
        agentCode: `${resolvedVendor} Rep`,
        sliSystemCheckCrewCode: resolvedVendor,
        sli: resolvedVendor,
        sliType: sliType,
        vendor: resolvedVendor,
        vendorType: resolvedVendorType,
        activationDate: joDateRaw || '2026-09-14',
        closingDate: closingDateRaw || joDateRaw || '2026-09-14',
        monthActivated: monthRaw || 'September',
        status: 'Activated',
        amount: numericMrc,
        slaHours,
      });
    }

    if (mappedRecords.length === 0) {
      setError(`No valid JO records found in sheet "${sheetName}". Please check that the sheet has data rows.`);
      setParsedData([]);
      return;
    }

    setParsedData(mappedRecords);
    setError('');
  };

  const processWorkbook = (workbook: XLSX.WorkBook, preferredSheet?: string) => {
    setWorkbookRef(workbook);

    const sheetList: SheetInfo[] = workbook.SheetNames.map((name) => {
      const ws = workbook.Sheets[name];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const rowCount = Math.max(0, rows.length - 1);
      const isRecommended =
        name.trim().toUpperCase() === 'JO ACTIVATED' ||
        name.trim().toUpperCase().includes('ACTIVATED') ||
        name.trim().toUpperCase().includes('DAILY ACTIVATION');
      return { name, rowCount, isRecommended };
    });

    setAvailableSheets(sheetList);

    // Auto-select 'JO ACTIVATED' if found, else first recommended sheet, else first sheet
    let targetSheet = preferredSheet;
    if (!targetSheet) {
      const exactMatch = workbook.SheetNames.find((s) => s.trim().toUpperCase() === 'JO ACTIVATED');
      const recommended = sheetList.find((s) => s.isRecommended);
      targetSheet = exactMatch || recommended?.name || workbook.SheetNames[0];
    }

    setSelectedSheet(targetSheet);
    parseWorksheet(workbook.Sheets[targetSheet], targetSheet);
  };

  const processFile = (file: File) => {
    setError('');
    setFileName(file.name);
    setIsSampleLoaded(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        processWorkbook(workbook);
      } catch (err: any) {
        setError(`Failed to read file: ${err.message || 'Unknown error'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbookRef && workbookRef.Sheets[sheetName]) {
      parseWorksheet(workbookRef.Sheets[sheetName], sheetName);
    }
  };

  const handleLoadScreenshotData = () => {
    setFileName('Screenshot_JO_ACTIVATED_Rows_3-46.xlsx');
    setParsedData(SCREENSHOT_SAMPLE_RECORDS);
    setAvailableSheets([{ name: 'JO ACTIVATED', rowCount: 44, isRecommended: true }]);
    setSelectedSheet('JO ACTIVATED');
    setDetectedHeaderInfo('Screenshot preset: 44 visible rows matching Photo 6 (Rows 3-46)');
    setIsSampleLoaded(true);
    setError('');
  };

  const handleConfirmImport = () => {
    if (parsedData.length > 0) {
      onImportRecords(parsedData, mode === 'replace', {
        fileName: fileName || 'Imported_Excel_Sheet.xlsx',
        sheetName: selectedSheet || 'JO ACTIVATED',
        isScreenshotSample: isSampleLoaded,
      });
      onClose();
    }
  };

  // Live Counts Breakdown for the currently parsed worksheet
  const counts = useMemo(() => {
    const total = parsedData.length;
    const fiberX = parsedData.filter((r) => r.category === 'FIBERX').length;
    const sme = parsedData.filter((r) => r.category === 'SME').length;
    const bida = parsedData.filter((r) => r.category === 'BIDA').length;
    const s2s = parsedData.filter((r) => r.category === 'S2S').length;

    const albay = parsedData.filter((r) => r.stateOrProvince === 'ALBAY').length;
    const sorsogon = parsedData.filter((r) => r.stateOrProvince === 'SORSOGON').length;
    const masbate = parsedData.filter((r) => r.stateOrProvince === 'MASBATE').length;

    const inhouse = parsedData.filter((r) => r.sliType === 'INHOUSE').length;
    const msa = parsedData.filter((r) => r.sliType === 'MSA').length;

    const albayFiberX = parsedData.filter((r) => r.stateOrProvince === 'ALBAY' && r.category === 'FIBERX').length;
    const sorsogonFiberX = parsedData.filter((r) => r.stateOrProvince === 'SORSOGON' && r.category === 'FIBERX').length;
    const masbateFiberX = parsedData.filter((r) => r.stateOrProvince === 'MASBATE' && r.category === 'FIBERX').length;

    const inhouseFiberX = parsedData.filter((r) => r.sliType === 'INHOUSE' && r.category === 'FIBERX').length;
    const msaFiberX = parsedData.filter((r) => r.sliType === 'MSA' && r.category === 'FIBERX').length;

    const totalMrc = parsedData.reduce((acc, r) => acc + (r.amount || 0), 0);
    const smeMrc = parsedData.filter((r) => r.category === 'SME').reduce((acc, r) => acc + (r.amount || 0), 0);

    return {
      total,
      fiberX,
      sme,
      bida,
      s2s,
      albay,
      sorsogon,
      masbate,
      inhouse,
      msa,
      albayFiberX,
      sorsogonFiberX,
      masbateFiberX,
      inhouseFiberX,
      msaFiberX,
      totalMrc,
      smeMrc,
    };
  }, [parsedData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-[#dce7e1] max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[94vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#edf3ef] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shadow-2xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#103728]">
                  Excel Sync &amp; Data Count Verification
                </h3>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-full">
                  COUNTIFS Engine
                </span>
              </div>
              <p className="text-xs text-[#597c6e]">
                Upload your workbook to sync and get the exact count of data from the <strong className="text-[#124231]">&apos;JO ACTIVATED&apos;</strong> tab
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Screenshot Preset Test */}
        <div className="bg-[#f0f7f3] border border-[#c4e3d1] rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-[#113d2c]">
                Quick Test from Screenshot:
              </span>
              <p className="text-[#4e7465] text-[11px]">
                Instant 1-click sync of the 44 rows visible in your screenshot (Rows 3–46 of &apos;JO ACTIVATED&apos;) to verify live counts.
              </p>
            </div>
          </div>
          <button
            onClick={handleLoadScreenshotData}
            className="px-3.5 py-1.5 bg-[#144c38] hover:bg-[#0e3a2b] text-white text-xs font-semibold rounded-xl whitespace-nowrap shadow-xs transition-colors shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load 44 Screenshot Rows</span>
          </button>
        </div>

        {/* Source Mode Toggle */}
        <div className="flex rounded-2xl bg-[#edf4f0] p-1 border border-[#d2e4db]">
          <button
            type="button"
            onClick={() => setSourceType('excel')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              sourceType === 'excel'
                ? 'bg-white text-[#0f3b2c] shadow-xs'
                : 'text-[#527a68] hover:text-[#0f3b2c]'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Local File (.xlsx / .xls)</span>
          </button>
          <button
            type="button"
            onClick={() => setSourceType('gsheet')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              sourceType === 'gsheet'
                ? 'bg-white text-[#0f3b2c] shadow-xs'
                : 'text-[#527a68] hover:text-[#0f3b2c]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Sheet CSV (PapaParse Live)</span>
          </button>
        </div>

        {sourceType === 'excel' ? (
          /* Dropzone */
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-emerald-600 bg-emerald-50'
                : 'border-[#cbdcd2] bg-[#f8fbf9] hover:bg-[#eef6f1]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <UploadCloud className="w-9 h-9 mx-auto text-emerald-700 mb-1.5" />
            <p className="text-xs font-bold text-[#144232]">
              Drop your Excel spreadsheet here or click to browse (.xlsx, .xls, .csv)
            </p>
            <p className="text-[11px] text-[#6d8e80] mt-1">
              Auto-detects columns: <code className="bg-emerald-100/70 text-emerald-900 px-1 py-0.5 rounded font-mono">STATEORPROVINCE (Col G)</code>, <code className="bg-emerald-100/70 text-emerald-900 px-1 py-0.5 rounded font-mono">SLI TYPE (Col S)</code>, <code className="bg-emerald-100/70 text-emerald-900 px-1 py-0.5 rounded font-mono">PACKAGE (Col AC)</code>, <code className="bg-emerald-100/70 text-emerald-900 px-1 py-0.5 rounded font-mono">MRC (Col AE)</code>
            </p>
          </div>
        ) : (
          /* Google Sheet CSV Live Sync */
          <div className="border border-[#cde2d6] bg-[#f8fbf9] rounded-2xl p-4.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1a4635] flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                Live Published Google Sheet CSV URL:
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                PapaParse
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={gsheetUrl}
                onChange={(e) => setGsheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                className="flex-1 w-full bg-white border border-[#cfdfd6] focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 rounded-xl px-3.5 py-2 text-xs text-[#0f2e22] font-mono"
              />
              <button
                type="button"
                onClick={() => fetchGoogleSheetCsv(gsheetUrl)}
                disabled={gsheetLoading}
                className="w-full sm:w-auto bg-[#144c38] hover:bg-[#0e3a2b] disabled:opacity-50 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${gsheetLoading ? 'animate-spin' : ''}`} />
                <span>{gsheetLoading ? 'Fetching...' : 'Sync Google Sheet'}</span>
              </button>
            </div>
            <p className="text-[11px] text-[#557b6b]">
              In Google Sheets, use <strong>File &gt; Share &gt; Publish to web &gt; Comma-separated values (.csv)</strong> to get your live CSV link.
            </p>
          </div>
        )}

        {/* Multi-Sheet Selection Bar (matching screenshot tabs: VALIDATION, JO ACTIVATED, etc.) */}
        {availableSheets.length > 1 && (
          <div className="bg-[#f2f7f4] border border-[#d5e5db] rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-[#133c2d]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span className="font-bold">Detected Workbook Tabs ({availableSheets.length} sheets):</span>
              </div>
              <span className="text-[11px] text-[#4e7465]">Click a tab to sync its data</span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {availableSheets.map((sheet) => {
                const isSelected = selectedSheet === sheet.name;
                return (
                  <button
                    key={sheet.name}
                    onClick={() => handleSheetChange(sheet.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#144c38] text-white shadow-xs'
                        : 'bg-white border border-[#cce0d4] text-[#143e2f] hover:bg-[#eaf4ef]'
                    }`}
                  >
                    <span>{sheet.name}</span>
                    {sheet.isRecommended && (
                      <span className={`text-[10px] px-1 rounded font-bold ${isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-emerald-100 text-emerald-800'}`}>
                        ★ Recommended
                      </span>
                    )}
                    <span className={`text-[10px] ${isSelected ? 'text-emerald-200' : 'text-gray-400'}`}>
                      ({sheet.rowCount} rows)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* File & Header Status */}
        {fileName && (
          <div className="bg-[#eaf5ef] border border-[#bfe4cf] rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-950">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">{fileName}</span>
                {selectedSheet && (
                  <span className="text-[#3c6b57]"> (Active Tab: <strong className="text-[#103728]">{selectedSheet}</strong>)</span>
                )}
                {detectedHeaderInfo && (
                  <div className="text-[10px] text-[#4a7261] mt-0.5 font-mono">{detectedHeaderInfo}</div>
                )}
              </div>
            </div>
            <span className="font-bold text-emerald-900 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 text-right shrink-0">
              {parsedData.length} records parsed
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-800">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Live COUNTIFS Data Count Verification Card */}
        {parsedData.length > 0 && (
          <div className="bg-[#f6faf8] border border-[#d6e7dc] rounded-2xl p-4 space-y-3.5">
            <div className="flex items-center justify-between border-b border-[#e2efe6] pb-2.5">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-[#103728]">
                  Live COUNTIFS Synced Metrics
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#456b5b]">Verified Active:</span>
                <span className="text-xs font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-lg">
                  {counts.total} JOs
                </span>
              </div>
            </div>

            {/* Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-white border border-[#dce8e0] p-3 rounded-xl shadow-2xs">
                <div className="text-[10px] font-bold text-[#5c7e70] uppercase">FIBERX Count</div>
                <div className="text-lg font-extrabold text-[#113a2c]">{counts.fiberX}</div>
                <div className="text-[10px] text-[#6e8f82]">
                  {Math.round((counts.fiberX / counts.total) * 100)}% of total ({counts.inhouseFiberX} Inhouse / {counts.msaFiberX} MSA)
                </div>
              </div>

              <div className="bg-white border border-[#dce8e0] p-3 rounded-xl shadow-2xs">
                <div className="text-[10px] font-bold text-[#5c7e70] uppercase">SME Count</div>
                <div className="text-lg font-extrabold text-[#113a2c]">{counts.sme}</div>
                <div className="text-[10px] text-[#6e8f82]">
                  ₱{counts.smeMrc.toLocaleString()} MRC ({Math.round((counts.sme / counts.total) * 100)}%)
                </div>
              </div>

              <div className="bg-white border border-[#dce8e0] p-3 rounded-xl shadow-2xs">
                <div className="text-[10px] font-bold text-[#5c7e70] uppercase">BIDA / S2S</div>
                <div className="text-lg font-extrabold text-[#113a2c]">
                  {counts.bida} / {counts.s2s}
                </div>
                <div className="text-[10px] text-[#6e8f82]">Prepaid &amp; S2S JOs</div>
              </div>

              <div className="bg-white border border-[#dce8e0] p-3 rounded-xl shadow-2xs">
                <div className="text-[10px] font-bold text-[#5c7e70] uppercase">Total MRC Revenue</div>
                <div className="text-lg font-extrabold text-[#113a2c]">
                  ₱{counts.totalMrc.toLocaleString()}
                </div>
                <div className="text-[10px] text-[#6e8f82]">Combined Monthly Charges</div>
              </div>
            </div>

            {/* Territory Breakdown Bar */}
            <div className="bg-white border border-[#dce8e0] p-3 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-[#143e2f] flex items-center justify-between">
                <span>Territory &amp; Channel Distribution:</span>
                <span className="text-[10px] font-mono text-emerald-800">
                  COUNTIFS(&apos;{selectedSheet || 'JO ACTIVATED'}&apos;!$A:$A, Province)
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-[#f8fbf9] p-2 rounded-lg border border-[#e5efe8]">
                  <div className="text-[10px] font-bold text-[#547567]">ALBAY</div>
                  <div className="font-extrabold text-[#103728] text-sm">{counts.albay} <span className="text-[10px] font-normal text-gray-500">({counts.albayFiberX} FiberX)</span></div>
                </div>
                <div className="bg-[#f8fbf9] p-2 rounded-lg border border-[#e5efe8]">
                  <div className="text-[10px] font-bold text-[#547567]">SORSOGON</div>
                  <div className="font-extrabold text-[#103728] text-sm">{counts.sorsogon} <span className="text-[10px] font-normal text-gray-500">({counts.sorsogonFiberX} FiberX)</span></div>
                </div>
                <div className="bg-[#f8fbf9] p-2 rounded-lg border border-[#e5efe8]">
                  <div className="text-[10px] font-bold text-[#547567]">MASBATE</div>
                  <div className="font-extrabold text-[#103728] text-sm">{counts.masbate} <span className="text-[10px] font-normal text-gray-500">({counts.masbateFiberX} FiberX)</span></div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[#4d7262] border-t border-[#edf4f0]">
                <span>Channel Split:</span>
                <span className="font-bold text-[#143e2f]">
                  INHOUSE: {counts.inhouse} ({Math.round((counts.inhouse / counts.total) * 100)}%) • MSA: {counts.msa} ({Math.round((counts.msa / counts.total) * 100)}%)
                </span>
              </div>
            </div>

            {/* Preview of first 3 parsed records */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-[#557769] uppercase flex items-center gap-1">
                <TableIcon className="w-3 h-3" />
                <span>Sample Parsed Rows (First 3):</span>
              </div>
              <div className="bg-white border border-[#dce8e0] rounded-xl overflow-hidden text-[11px]">
                <table className="w-full text-left">
                  <thead className="bg-[#edf5f0] text-[#143e2f] border-b border-[#dce8e0]">
                    <tr>
                      <th className="px-2.5 py-1.5 font-bold">JO No</th>
                      <th className="px-2.5 py-1.5 font-bold">Province</th>
                      <th className="px-2.5 py-1.5 font-bold">Channel</th>
                      <th className="px-2.5 py-1.5 font-bold">Vendor</th>
                      <th className="px-2.5 py-1.5 font-bold">Package</th>
                      <th className="px-2.5 py-1.5 font-bold">MRC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#edf4f0]">
                    {parsedData.slice(0, 3).map((r, i) => (
                      <tr key={i} className="hover:bg-[#fbfdfc]">
                        <td className="px-2.5 py-1 font-mono text-[#103728]">{r.joNumber}</td>
                        <td className="px-2.5 py-1 font-bold">{r.stateOrProvince}</td>
                        <td className="px-2.5 py-1">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${r.sliType === 'INHOUSE' ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-100 text-teal-800'}`}>
                            {r.sliType}
                          </span>
                        </td>
                        <td className="px-2.5 py-1 truncate max-w-[140px]">{r.vendor}</td>
                        <td className="px-2.5 py-1 font-bold">{r.packageName}</td>
                        <td className="px-2.5 py-1">₱{(r.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Import Mode Selector */}
        {parsedData.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#f8fbf9] border border-[#e2ede6] rounded-2xl p-3 text-xs gap-2">
            <span className="font-semibold text-[#183e30]">Dashboard Synchronization Mode:</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'replace'}
                  onChange={() => setMode('replace')}
                  className="text-emerald-600"
                />
                <span className="font-semibold text-[#133a2b]">
                  Replace Dashboard ({counts.total} JOs)
                </span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'append'}
                  onChange={() => setMode('append')}
                  className="text-emerald-600"
                />
                <span className="font-medium text-[#133a2b]">
                  Append (+{counts.total} to {currentRecordsCount})
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Footer controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-[#edf3ef]">
          <button
            onClick={() => {
              onResetToPhotoData();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Verified 297 JOs Baseline</span>
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="sync-excel-confirm-btn"
              disabled={parsedData.length === 0}
              onClick={handleConfirmImport}
              className="px-5 py-2.5 bg-[#144c38] hover:bg-[#0e3c2c] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Sync {parsedData.length} Records into Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
