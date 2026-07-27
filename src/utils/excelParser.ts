import * as XLSX from 'xlsx';
import { DRELineKey, DRETransaction, ExcelImportConfig, ProjectContract, TransactionStatus } from '../types/dre';

export interface ParsedSheetPreview {
  sheetName: string;
  totalRows: number;
  totalCols: number;
  previewRows: any[][];
  headers: { index: number; colLetter: string; sampleVal: string }[];
}

export function parseExcelFileSheets(fileBuffer: ArrayBuffer): { sheetNames: string[]; workbook: XLSX.WorkBook } {
  const workbook = XLSX.read(fileBuffer, { type: 'array', cellDates: true });
  return { sheetNames: workbook.SheetNames, workbook };
}

/**
 * Universal Date Parser for Excel Cells
 */
export function parseExcelDateYM(dateVal: any, fallbackYear = 2024): { ym: string; year: number; month: number } {
  if (dateVal === undefined || dateVal === null || String(dateVal).trim() === '') {
    return { ym: `${fallbackYear}-01`, year: fallbackYear, month: 1 };
  }

  if (typeof dateVal === 'object' && dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const y = dateVal.getUTCFullYear();
    const m = dateVal.getUTCMonth() + 1;
    const year = y < 2010 ? fallbackYear : y;
    return { ym: `${year}-${String(m).padStart(2, '0')}`, year, month: m };
  }

  const str = String(dateVal).trim();
  const numSerial = typeof dateVal === 'number' ? dateVal : parseFloat(str);
  if (!isNaN(numSerial) && numSerial > 30000 && numSerial < 60000 && !str.includes('/') && !str.includes('-')) {
    const utcDays = Math.floor(numSerial - 25569);
    const utcValue = utcDays * 86400;
    const dateObj = new Date(utcValue * 1000);
    const y = dateObj.getUTCFullYear();
    const m = dateObj.getUTCMonth() + 1;
    const year = y < 2010 ? fallbackYear : y;
    return { ym: `${year}-${String(m).padStart(2, '0')}`, year, month: m };
  }

  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const year = y < 2010 ? fallbackYear : y;
    return { ym: `${year}-${String(m).padStart(2, '0')}`, year, month: m };
  }

  const ptMonths: Record<string, number> = {
    jan: 1, janeiro: 1,
    fev: 2, fevereiro: 2,
    mar: 3, marco: 3, março: 3,
    abr: 4, abril: 4,
    mai: 5, maio: 5,
    jun: 6, junho: 6,
    jul: 7, julho: 7,
    ago: 8, agosto: 8,
    set: 9, setembro: 9,
    out: 10, outubro: 10,
    nov: 11, novembro: 11,
    dez: 12, dezembro: 12,
  };

  const lowerStr = str.toLowerCase();
  for (const [monthName, monthNum] of Object.entries(ptMonths)) {
    if (lowerStr.includes(monthName)) {
      const yearMatch = str.match(/\b(20\d{2}|\d{2})\b/);
      let year = fallbackYear;
      if (yearMatch) {
        const parsedY = parseInt(yearMatch[1], 10);
        year = yearMatch[1].length === 2 ? 2000 + parsedY : parsedY;
        if (year < 2010) year = fallbackYear;
      }
      return { ym: `${year}-${String(monthNum).padStart(2, '0')}`, year, month: monthNum };
    }
  }

  const slashMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})([/.-](\d{2,4}))?/);
  if (slashMatch) {
    const part1 = parseInt(slashMatch[1], 10);
    const part2 = parseInt(slashMatch[2], 10);
    const part4 = slashMatch[4];

    if (part4) {
      let year = parseInt(part4, 10);
      if (part4.length === 2) year += 2000;
      if (year < 2010) year = fallbackYear;
      const month = part2;
      return { ym: `${year}-${String(month).padStart(2, '0')}`, year, month };
    } else {
      let month = part1;
      if (part1 <= 31 && part2 <= 12) {
        month = part2;
      }
      return { ym: `${fallbackYear}-${String(month).padStart(2, '0')}`, year: fallbackYear, month };
    }
  }

  return { ym: `${fallbackYear}-01`, year: fallbackYear, month: 1 };
}

/**
 * Dedicated Parser for INFORMAÇÕES_PROJETOS.xlsx
 */
export function parseProjectsInfoSheet(workbook: XLSX.WorkBook): ProjectContract[] {
  const prazoSheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes('prazo')) || workbook.SheetNames[0];
  const custoSheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes('custo')) || workbook.SheetNames[1];

  const prazoSheet = workbook.Sheets[prazoSheetName];
  const custoSheet = workbook.Sheets[custoSheetName];

  if (!prazoSheet && !custoSheet) return [];

  const plazoRows: any[][] = prazoSheet ? XLSX.utils.sheet_to_json(prazoSheet, { header: 1, raw: false }) : [];
  const custoRows: any[][] = custoSheet ? XLSX.utils.sheet_to_json(custoSheet, { header: 1, raw: false }) : [];

  const projectsMap: Record<string, Partial<ProjectContract>> = {};

  const formatExcelDateStr = (rawVal: any, defaultStr = '2024-01-01') => {
    if (!rawVal) return defaultStr;
    const parsed = parseExcelDateYM(rawVal);
    return `${parsed.ym}-01`;
  };

  const parseNum = (val: any) => {
    if (val === undefined || val === null || val === 'N/A') return 0;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
    return isNaN(n) ? 0 : n;
  };

  // 1. Process Prazo Obras
  for (let i = 1; i < plazoRows.length; i++) {
    const r = plazoRows[i];
    if (!r || !r[0]) continue;
    const name = String(r[0]).trim();
    if (name.toLowerCase() === 'obra' || name.toLowerCase().includes('total')) continue;

    const startDate = formatExcelDateStr(r[1], '2023-01-01');
    const baselineEnd = formatExcelDateStr(r[2], '2025-12-01');
    const replannedEnd = formatExcelDateStr(r[4] || r[2], baselineEnd);
    const actualEnd = r[5] ? formatExcelDateStr(r[5]) : undefined;

    const initialMonths = parseNum(r[3]) || 24;
    const realMonths = parseNum(r[10]) || initialMonths;

    projectsMap[name] = {
      id: `proj-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name,
      type: 'Terceiros',
      startDate,
      baselineEndDate: baselineEnd,
      replannedEndDate: replannedEnd,
      actualEndDate: actualEnd,
      initialMonths,
      realMonths,
      contractValue: parseNum(r[18]),
      contractNotes: r[16] ? String(r[16]).trim() : undefined,
      multaPercent: parseNum(r[17]),
      valorMulta: parseNum(r[20]),
      estimatedMonthlyTeamCost: 28000,
    };
  }

  // 2. Process Custo Obras
  for (let i = 1; i < custoRows.length; i++) {
    const r = custoRows[i];
    if (!r || !r[0]) continue;
    const name = String(r[0]).trim();
    if (name.toLowerCase() === 'obra' || name.toLowerCase().includes('total')) continue;

    if (!projectsMap[name]) {
      projectsMap[name] = {
        id: `proj-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name,
        startDate: '2023-01-01',
        baselineEndDate: '2025-12-01',
        replannedEndDate: '2025-12-01',
        initialMonths: 24,
        realMonths: 24,
        estimatedMonthlyTeamCost: 28000,
      };
    }

    const p = projectsMap[name];
    const rawType = String(r[1] || '').toLowerCase();
    p.type = rawType.includes('interna') ? 'Interna' : 'Terceiros';

    p.orcamentoRasoReajustado = parseNum(r[2]);
    p.projecaoRasoAtual = parseNum(r[3]);
    p.resultadoRasoAtual = parseNum(r[4]);
    p.orcamentoTotalReajustado = parseNum(r[5]);
    p.projectedCostAtCompletion = parseNum(r[6]);
    p.resultAtCompletion = parseNum(r[7]);
    p.premioEconomia = parseNum(r[8]);
    p.bandaPercent = parseNum(r[11]);
    p.clausulaCusto = r[12] ? String(r[12]).trim() : undefined;

    if (!p.contractValue || p.contractValue === 0) {
      p.contractValue = p.orcamentoTotalReajustado || p.projectedCostAtCompletion || 10000000;
    }
  }

  return Object.values(projectsMap) as ProjectContract[];
}

export function getSheetPreview(workbook: XLSX.WorkBook, sheetName: string, maxRows = 35): ParsedSheetPreview {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return { sheetName, totalRows: 0, totalCols: 0, previewRows: [], headers: [] };
  }

  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
  const totalRows = range.e.r + 1;
  const totalCols = range.e.c + 1;

  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
  const previewRows = rawData.slice(0, maxRows);

  const headers: { index: number; colLetter: string; sampleVal: string }[] = [];
  for (let c = 0; c < totalCols; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    let sampleVal = '';
    for (let r = 0; r < Math.min(20, previewRows.length); r++) {
      if (previewRows[r] && previewRows[r][c] !== undefined && previewRows[r][c] !== null && String(previewRows[r][c]).trim() !== '') {
        sampleVal = String(previewRows[r][c]).trim();
        break;
      }
    }
    headers.push({ index: c, colLetter, sampleVal: sampleVal || `Coluna ${colLetter}` });
  }

  return {
    sheetName,
    totalRows,
    totalCols,
    previewRows,
    headers,
  };
}

export function suggestDRELineKey(labelStr: string): DRELineKey | 'ignore' {
  if (!labelStr || typeof labelStr !== 'string') return 'ignore';
  const lower = labelStr.toLowerCase().trim();
  if (!lower) return 'ignore';

  if (
    lower.includes('total') ||
    lower.includes('subtotal') ||
    lower.includes('saldo') ||
    lower.includes('resultado') ||
    lower.includes('margem') ||
    lower.includes('lucro') ||
    lower.includes('receita líquida') ||
    lower.includes('receita liquida') ||
    lower.includes('resumo') ||
    lower.includes('consolidado')
  ) {
    return 'ignore';
  }

  if (lower.includes('irpj') || lower.includes('csll') || lower.includes('imposto de renda')) return 'irpj_csll';
  if (lower.includes('permuta')) return 'permuta_taxa_adm';
  if (lower.includes('taxa de adm') || lower.includes('taxa adm') || lower.includes('receita adm')) return 'receita_taxa_adm';
  if (lower.includes('mo adm') || lower.includes('mão de obra adm') || lower.includes('equipe adm') || lower.includes('receita mo')) return 'receita_mo_adm';
  if (lower.includes('assistência') && lower.includes('receita')) return 'receita_assistencia';
  if (lower.includes('imposto') || lower.includes('pis') || lower.includes('iss') || lower.includes('cofins') || lower.includes('tributo')) return 'impostos';
  if (lower.includes('assistência') && (lower.includes('despesa') || lower.includes('custo'))) return 'despesa_assistencia';
  if (lower.includes('equipe') || lower.includes('mão de obra') || lower.includes('mo') || lower.includes('salário') || lower.includes('folha')) return 'custos_equipe';
  if (lower.includes('deslocamento') || lower.includes('viagem') || lower.includes('combustível') || lower.includes('logística')) return 'custos_deslocamento';
  if (lower.includes('adm pie') || lower.includes('despesa adm') || lower.includes('escritório')) return 'despesas_adm_pie';

  return 'receita_taxa_adm';
}

export function extractUniqueDRELabels(
  workbook: XLSX.WorkBook,
  config: ExcelImportConfig
): { label: string; suggestedKey: DRELineKey | 'ignore' }[] {
  const sheet = workbook.Sheets[config.sheetName];
  if (!sheet) return [];

  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  const startRowIdx = Math.max(0, config.startRow - 1);
  const endRowIdx = config.endRow ? Math.min(rawData.length, config.endRow) : rawData.length;

  const labelSet = new Set<string>();

  for (let r = startRowIdx; r < endRowIdx; r++) {
    const row = rawData[r];
    if (!row || row.length === 0) continue;

    let labelVal = '';
    if (config.mapping.dreLineCol !== undefined && config.mapping.dreLineCol !== '') {
      const colIdx = parseInt(config.mapping.dreLineCol, 10);
      labelVal = row[colIdx] !== undefined ? String(row[colIdx]).trim() : '';
    } else {
      labelVal = String(row[1] || row[0] || '').trim();
    }

    if (labelVal && labelVal.length > 1) {
      labelSet.add(labelVal);
    }
  }

  const result: { label: string; suggestedKey: DRELineKey | 'ignore' }[] = [];
  labelSet.forEach((label) => {
    result.push({
      label,
      suggestedKey: suggestDRELineKey(label),
    });
  });

  return result;
}

export function parseViabilidadeMatrixSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  fileName: string = 'DRE PREVISTO PROJETO GRANDLODGE.xlsx',
  currentDateStr: string = new Date().toISOString().slice(0, 7)
): { transactions: DRETransaction[]; projectInfo?: Partial<ProjectContract> } {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { transactions: [] };

  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
  if (rawData.length < 35) return { transactions: [] };

  let projectName = 'GRAND LODGE';
  let contractVal = 46239533.55;
  let durationMonths = 27;
  let startDateStr = '2026-05-11';

  rawData.forEach((row) => {
    if (!row || row.length < 2) return;
    const label = String(row[1] || '').trim();
    const val = row[2];

    if (label.includes('OBRA:')) {
      projectName = String(row[2] || row[3] || 'GRAND LODGE').trim();
    } else if (label.includes('R$ Raso de Obra')) {
      contractVal = parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || contractVal;
    } else if (label.includes('Prazo Obra')) {
      durationMonths = parseInt(String(val)) || durationMonths;
    } else if (label.includes('Data início Obra')) {
      startDateStr = String(val).slice(0, 10);
    }
  });

  const monthRowIdx = 33;
  const monthCols: { colIdx: number; dateYM: string }[] = [];

  if (rawData[monthRowIdx]) {
    let currentYear = 2026;
    let prevMonth = 0;

    rawData[monthRowIdx].forEach((cellVal, colIdx) => {
      if (colIdx >= 4 && cellVal) {
        const parsed = parseExcelDateYM(cellVal, currentYear);
        if (parsed.month < prevMonth) {
          currentYear += 1;
        }
        prevMonth = parsed.month;
        const ym = `${currentYear}-${String(parsed.month).padStart(2, '0')}`;
        monthCols.push({ colIdx, dateYM: ym });
      }
    });
  }

  const transactions: DRETransaction[] = [];
  const lineMap: { labelMatch: string; key: DRELineKey }[] = [
    { labelMatch: 'Receita Taxa de Adm', key: 'receita_taxa_adm' },
    { labelMatch: 'Permuta Taxa de Adm', key: 'permuta_taxa_adm' },
    { labelMatch: 'Receita MO Adm', key: 'receita_mo_adm' },
    { labelMatch: 'Receita Assistência', key: 'receita_assistencia' },
    { labelMatch: 'Impostos', key: 'impostos' },
    { labelMatch: 'Despesa Assistência', key: 'despesa_assistencia' },
    { labelMatch: 'Custos Equipe', key: 'custos_equipe' },
    { labelMatch: 'Custos Deslocamento', key: 'custos_deslocamento' },
    { labelMatch: 'Despesas Adm Pie', key: 'despesas_adm_pie' },
  ];

  for (let r = 34; r < Math.min(60, rawData.length); r++) {
    const row = rawData[r];
    if (!row) continue;
    const lineLabel = String(row[1] || row[0] || '').trim();

    const matched = lineMap.find((item) => lineLabel.toLowerCase().includes(item.labelMatch.toLowerCase()));
    if (matched) {
      monthCols.forEach(({ colIdx, dateYM }) => {
        const val = row[colIdx];
        if (val !== undefined && val !== null) {
          const numVal = Math.abs(parseFloat(String(val).replace(/[^0-9.-]+/g, '')) || 0);
          if (numVal > 0) {
            let status: TransactionStatus = 'previsto_inicial';
            let isAutoForecast = false;

            transactions.push({
              id: `mat-${projectName}-${matched.key}-${dateYM}-${colIdx}`,
              project: projectName,
              date: dateYM,
              dreLineKey: matched.key,
              amount: numVal,
              status,
              isAutoForecast,
              description: `Matriz Viabilidade Base - ${matched.labelMatch}`,
              sourceFile: fileName,
              sourceSheet: sheetName,
              createdAt: new Date().toISOString(),
            });
          }
        }
      });
    }
  }

  return {
    transactions,
    projectInfo: {
      name: projectName,
      contractValue: contractVal,
      initialMonths: durationMonths,
      startDate: startDateStr,
    },
  };
}

export function processExcelImport(
  workbook: XLSX.WorkBook,
  config: ExcelImportConfig,
  currentDateStr: string = new Date().toISOString().slice(0, 7)
): DRETransaction[] {
  const sheet = workbook.Sheets[config.sheetName];
  if (!sheet) return [];

  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });
  const isAutoMatrixViabilidade = rawData.some((r) => r && r[1] && String(r[1]).includes('R$ Raso de Obra'));

  if (isAutoMatrixViabilidade) {
    const res = parseViabilidadeMatrixSheet(workbook, config.sheetName, config.fileName, currentDateStr);
    return res.transactions;
  }

  const transactions: DRETransaction[] = [];

  const getCellData = (r: number, c: number): { rawVal: any; formattedVal: any } => {
    const cellRef = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[cellRef];
    if (cell) {
      return { rawVal: cell.v, formattedVal: cell.w || cell.v };
    }
    if (rawData[r] && rawData[r][c] !== undefined) {
      return { rawVal: rawData[r][c], formattedVal: rawData[r][c] };
    }
    return { rawVal: null, formattedVal: null };
  };

  const resolveLineKey = (labelStr: any): DRELineKey | 'ignore' => {
    const str = String(labelStr || '').trim();
    if (!str) return config.preselectedDRELine || 'ignore';

    if (config.mapping.lineCategoryMapping && config.mapping.lineCategoryMapping[str] !== undefined) {
      return config.mapping.lineCategoryMapping[str];
    }

    const suggested = suggestDRELineKey(str);
    if (suggested !== 'ignore') return suggested;

    return config.preselectedDRELine || 'ignore';
  };

  const parseStatus = (statusVal: any, preselected: TransactionStatus = 'realizado'): TransactionStatus => {
    if (!statusVal) return preselected;
    const str = String(statusVal).toLowerCase();
    if (str.includes('via') || str.includes('base') || str.includes('previsto_inicial')) return 'previsto_inicial';
    if (str.includes('proj') || str.includes('futuro') || str.includes('prev')) return 'projetado';
    return 'realizado';
  };

  if (config.mapping.dateColMode === 'range' && config.mapping.startDateCol !== undefined && config.mapping.endDateCol !== undefined) {
    const startCol = parseInt(config.mapping.startDateCol, 10);
    const endCol = parseInt(config.mapping.endDateCol, 10);
    const dateHeaderRowIdx = Math.max(0, (config.mapping.dateHeaderRow || config.startRow - 1) - 1);

    const startRowIdx = Math.max(0, config.startRow - 1);
    const endRowIdx = config.endRow ? Math.min(rawData.length, config.endRow) : rawData.length;

    const colDates: Record<number, string> = {};
    let runningYear = 2024;
    let prevMonth = 0;

    const firstCellData = getCellData(dateHeaderRowIdx, startCol);
    const initialParsed = parseExcelDateYM(firstCellData.rawVal || firstCellData.formattedVal, 2024);
    runningYear = initialParsed.year;

    for (let c = startCol; c <= endCol; c++) {
      const cellData = getCellData(dateHeaderRowIdx, c);
      const parsed = parseExcelDateYM(cellData.rawVal || cellData.formattedVal, runningYear);

      if (prevMonth === 12 && parsed.month === 1) {
        runningYear += 1;
      } else if (parsed.year > runningYear && parsed.year >= 2010) {
        runningYear = parsed.year;
      }

      prevMonth = parsed.month;
      const formattedYM = `${runningYear}-${String(parsed.month).padStart(2, '0')}`;
      colDates[c] = formattedYM;
    }

    for (let r = startRowIdx; r < endRowIdx; r++) {
      const row = rawData[r];
      if (!row || row.length === 0) continue;

      const projectVal = config.mapping.projectCol ? getCellData(r, parseInt(config.mapping.projectCol, 10)).formattedVal : config.preselectedProject;
      const statusVal = config.mapping.statusCol ? getCellData(r, parseInt(config.mapping.statusCol, 10)).formattedVal : config.preselectedStatus || 'realizado';
      const dreLineVal = config.mapping.dreLineCol ? getCellData(r, parseInt(config.mapping.dreLineCol, 10)).formattedVal : getCellData(r, 1).formattedVal || getCellData(r, 0).formattedVal;
      const descVal = config.mapping.descriptionCol ? getCellData(r, parseInt(config.mapping.descriptionCol, 10)).formattedVal : '';

      const mappedKey = resolveLineKey(dreLineVal);

      if (mappedKey === 'ignore') continue;

      for (let c = startCol; c <= endCol; c++) {
        const amountCell = getCellData(r, c).formattedVal;
        if (amountCell !== undefined && amountCell !== null && String(amountCell).trim() !== '') {
          const parsedAmount = Math.abs(parseFloat(String(amountCell).replace(/[^0-9.-]+/g, '')) || 0);
          if (parsedAmount > 0) {
            const formattedDate = colDates[c] || '2024-01';

            let finalStatus: TransactionStatus = parseStatus(statusVal, config.preselectedStatus || 'realizado');
            let isAutoForecast = false;

            if (finalStatus === 'realizado' && formattedDate > currentDateStr) {
              finalStatus = 'projetado';
              isAutoForecast = true;
            }

            transactions.push({
              id: `range-${Date.now()}-${r}-${c}-${Math.random().toString(36).substr(2, 4)}`,
              project: String(projectVal || 'Geral').trim(),
              date: formattedDate,
              dreLineKey: mappedKey,
              amount: parsedAmount,
              status: finalStatus,
              isAutoForecast,
              description: String(descVal || `Linha "${dreLineVal}"`).trim(),
              sourceFile: config.fileName,
              sourceSheet: config.sheetName,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
    }

    return transactions;
  }

  const startIdx = Math.max(0, config.startRow - 1);
  const endIdx = config.endRow ? Math.min(rawData.length, config.endRow) : rawData.length;
  const dataRows = rawData.slice(startIdx, endIdx);

  dataRows.forEach((row, rowIdx) => {
    if (!row || row.length === 0) return;

    const dateVal = config.mapping.dateCol ? row[parseInt(config.mapping.dateCol, 10)] : null;
    const amountVal = config.mapping.amountCol ? row[parseInt(config.mapping.amountCol, 10)] : null;
    const projectVal = config.mapping.projectCol ? row[parseInt(config.mapping.projectCol, 10)] : config.preselectedProject;
    const statusVal = config.mapping.statusCol ? row[parseInt(config.mapping.statusCol, 10)] : config.preselectedStatus || 'realizado';
    const dreLineVal = config.mapping.dreLineCol ? row[parseInt(config.mapping.dreLineCol, 10)] : '';
    const descVal = config.mapping.descriptionCol ? row[parseInt(config.mapping.descriptionCol, 10)] : '';

    if (!amountVal && amountVal !== 0) return;
    const parsedAmount = parseFloat(String(amountVal).replace(/[^0-9.-]+/g, ''));
    if (isNaN(parsedAmount)) return;

    const mappedKey = resolveLineKey(dreLineVal);

    if (mappedKey === 'ignore') return;

    const parsedDate = parseExcelDateYM(dateVal, 2024);
    const formattedDate = parsedDate.ym;

    let finalStatus: TransactionStatus = parseStatus(statusVal, config.preselectedStatus || 'realizado');
    let isAutoForecast = false;

    if (finalStatus === 'realizado' && formattedDate > currentDateStr) {
      finalStatus = 'projetado';
      isAutoForecast = true;
    }

    transactions.push({
      id: `imp-${Date.now()}-${rowIdx}-${Math.random().toString(36).substr(2, 4)}`,
      project: String(projectVal || 'Geral').trim(),
      date: formattedDate,
      dreLineKey: mappedKey,
      amount: parsedAmount,
      status: finalStatus,
      isAutoForecast,
      description: String(descVal || `Importado de ${config.fileName}`).trim(),
      sourceFile: config.fileName,
      sourceSheet: config.sheetName,
      createdAt: new Date().toISOString(),
    });
  });

  return transactions;
}
