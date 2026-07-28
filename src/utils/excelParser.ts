import * as XLSX from 'xlsx';
import { DRELineKey, DRETransaction, ExcelImportConfig, ProjectContract, SpreadsheetPreset, TransactionStatus } from '../types/dre';

export type { SpreadsheetPreset } from '../types/dre';

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
 * Universal Multilingual Date Parser supporting Brazilian (DD/MM/YYYY) and Excel US formats (M/D/YY)
 */
export function parseExcelDateYM(dateVal: any, fallbackYear = 2024): { ym: string; year: number; month: number } {
  if (dateVal === undefined || dateVal === null || String(dateVal).trim() === '') {
    return { ym: `${fallbackYear}-01`, year: fallbackYear, month: 1 };
  }

  // 1. JS Date Objects (from cellDates: true)
  if (typeof dateVal === 'object' && dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    const y = dateVal.getUTCFullYear();
    const m = dateVal.getUTCMonth() + 1;
    const year = y < 2010 ? fallbackYear : y;
    return { ym: `${year}-${String(m).padStart(2, '0')}`, year, month: m };
  }

  const str = String(dateVal).trim();

  // 2. Numeric Excel Serial Dates (e.g. 46082 = 2026-03, 45170 = 2023-09)
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

  // 3. ISO Date (YYYY-MM-DD or YYYY-MM)
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const year = y < 2010 ? fallbackYear : y;
    return { ym: `${year}-${String(m).padStart(2, '0')}`, year, month: m };
  }

  // 4. Multilingual Month Names (e.g. Sep/2023, Set/2023, Sep-23, Mai-24)
  const monthNamesMap: Record<string, number> = {
    jan: 1, january: 1, janeiro: 1, enero: 1,
    fev: 2, feb: 2, february: 2, fevereiro: 2, febrero: 2,
    mar: 3, march: 3, marco: 3, março: 3, marzo: 3,
    abr: 4, apr: 4, april: 4, abril: 4,
    mai: 5, may: 5, maio: 5, mayo: 5,
    jun: 6, june: 6, junho: 6, junio: 6,
    jul: 7, july: 7, julho: 7, julio: 7,
    ago: 8, aug: 8, august: 8, agosto: 8,
    set: 9, sep: 9, sept: 9, september: 9, setembro: 9, septiembre: 9,
    out: 10, oct: 10, october: 10, outubro: 10, octubre: 10,
    nov: 11, november: 11, novembro: 11, noviembre: 11,
    dez: 12, dec: 12, december: 12, dezembro: 12, diciembre: 12,
  };

  const lowerStr = str.toLowerCase();
  for (const [monthName, monthNum] of Object.entries(monthNamesMap)) {
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

  // 5. Slash / Dash Dates (handles both BR DD/MM/YYYY and US M/D/YY from Excel formatting)
  const slashMatch = str.match(/^(\d{1,2})[/.-](\d{1,2})([/.-](\d{2,4}))?/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const yearRaw = slashMatch[4];

    let year = fallbackYear;
    if (yearRaw) {
      const yVal = parseInt(yearRaw, 10);
      year = yearRaw.length === 2 ? 2000 + yVal : yVal;
      if (year < 2010) year = fallbackYear;
    }

    let month = 1;
    if (p1 <= 12 && p2 > 12) {
      // US format M/D/YYYY (e.g. 9/18/2023)
      month = p1;
    } else if (p1 > 12 && p2 <= 12) {
      // BR format DD/MM/YYYY (e.g. 18/09/2023)
      month = p2;
    } else if (p1 <= 12 && p2 <= 12) {
      // Ambiguous e.g. 9/1/23 (September 1st in US Excel M/D/YY format) vs 01/09/2023 (1st of Sept in BR)
      if (p2 === 1 && p1 > 1) {
        month = p1;
      } else {
        month = p2;
      }
    }

    return { ym: `${year}-${String(month).padStart(2, '0')}`, year, month };
  }

  return { ym: `${fallbackYear}-01`, year: fallbackYear, month: 1 };
}

/**
 * Combines separate Year cell (Col B) and Month cell (Col C) into YYYY-MM format
 */
export function parseYearAndMonthStr(yearVal: any, monthVal: any, fallbackYear = 2025): string {
  const yearNum = parseInt(String(yearVal || '').replace(/\D/g, ''), 10) || fallbackYear;
  const strM = String(monthVal || '').toLowerCase().trim();

  const monthNamesMap: Record<string, number> = {
    jan: 1, january: 1, janeiro: 1,
    fev: 2, feb: 2, february: 2, fevereiro: 2,
    mar: 3, march: 3, marco: 3, março: 3,
    abr: 4, apr: 4, april: 4, abril: 4,
    mai: 5, may: 5, maio: 5,
    jun: 6, june: 6, junho: 6,
    jul: 7, july: 7, julho: 7,
    ago: 8, aug: 8, august: 8, agosto: 8,
    set: 9, sep: 9, sept: 9, september: 9, setembro: 9,
    out: 10, oct: 10, october: 10, outubro: 10,
    nov: 11, november: 11, novembro: 11,
    dez: 12, dec: 12, december: 12, dezembro: 12,
  };

  let monthNum = 1;
  for (const [mName, mNum] of Object.entries(monthNamesMap)) {
    if (strM.includes(mName)) {
      monthNum = mNum;
      break;
    }
  }

  const numM = parseInt(strM, 10);
  if (!isNaN(numM) && numM >= 1 && numM <= 12) {
    monthNum = numM;
  }

  return `${yearNum}-${String(monthNum).padStart(2, '0')}`;
}

/**
 * Smart Preset Detector for Refactored Spreadsheets
 */
export function detectSpreadsheetPreset(workbook: XLSX.WorkBook): SpreadsheetPreset {
  const sheetNames = workbook.SheetNames;

  // 1. Check INFORMAÇÕES_PROJETOS
  const hasPrazo = sheetNames.some((s) => s.toLowerCase().includes('prazo'));
  const hasCusto = sheetNames.some((s) => s.toLowerCase().includes('custo'));
  if (hasPrazo && hasCusto) {
    return {
      preset: 'INFORMAÇÕES_PROJETOS',
      mode: 'projects_register',
      presetTitle: 'Cadastro de Projetos (INFORMAÇÕES_PROJETOS.xlsx)',
      presetDescription: 'Detecção Automática: Planilha oficial com cadastro, prazos, orçamentos, cláusulas e estimativa de equipe por mês.',
    };
  }

  // 2. Check Custo de MO POR PROJETO (Sheet 'Custo de equipe' or 'Planilha1' with DESCRICAO_PROJETO)
  const custoEquipeSheet = sheetNames.find((s) => s.toLowerCase().includes('custo de equipe') || s.toLowerCase().includes('equipe'));
  if (custoEquipeSheet || (sheetNames.includes('Planilha1') && sheetNames.some((s) => s.toLowerCase().includes('custo')))) {
    const targetSheet = custoEquipeSheet || sheetNames.find((s) => s.toLowerCase().includes('custo')) || sheetNames[0];
    return {
      preset: 'CUSTO_MO_POR_PROJETO',
      mode: 'financial_transactions',
      sheetName: targetSheet,
      startRow: 5,
      projectCol: '0',
      dateCol: '2',
      dreLineCol: '5',
      amountCol: '4',
      status: 'realizado',
      presetTitle: 'Custo Real de Mão de Obra de Equipe (Custo de MO POR PROJETO.xlsx)',
      presetDescription: 'Detecção Automática: Tabela com Ano (Col B) + Mês (Col C), Categoria (Col F) e Valor (Col E).',
    };
  }

  // 3. Inspect individual sheet headers for database formats
  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    if (!rows || rows.length === 0) continue;

    const h0 = (rows[0] || []).map((v) => String(v || '').toLowerCase().trim());
    const h1 = (rows[1] || []).map((v) => String(v || '').toLowerCase().trim());

    // Check PREVISAO DRE OBRAS (Obra | Mês | Conta DRE | Previsto inicial)
    if (
      (h0.includes('obra') && h0.includes('mês') && (h0.includes('conta dre') || h0.includes('previsto inicial'))) ||
      (h1.includes('obra') && h1.includes('mês') && (h1.includes('conta dre') || h1.includes('previsto inicial')))
    ) {
      const h = h0.includes('obra') ? h0 : h1;
      const startRow = h0.includes('obra') ? 2 : 3;
      return {
        preset: 'PREVISAO_DRE_OBRAS',
        mode: 'financial_transactions',
        sheetName,
        startRow,
        projectCol: String(h.indexOf('obra')),
        dateCol: String(h.indexOf('mês')),
        dreLineCol: String(h.indexOf('conta dre') !== -1 ? h.indexOf('conta dre') : h.indexOf('conta')),
        amountCol: String(h.indexOf('previsto inicial') !== -1 ? h.indexOf('previsto inicial') : 3),
        status: 'previsto_inicial',
        presetTitle: 'Previsão Inicial DRE por Obra (Banco de Dados)',
        presetDescription: 'Detecção Automática: Formato tabela com Obra, Mês, Conta DRE e Previsto Inicial.',
      };
    }

    // Check RECEITAS MO ADM / Banco_Cobrancas (Obra | Data de cobrança | Medido Piemonte | Categoria)
    if (
      (h0.includes('obra') && h0.includes('data de cobrança')) ||
      (h1.includes('obra') && h1.includes('data de cobrança')) ||
      sheetName.toLowerCase().includes('cobranca') ||
      sheetName.toLowerCase().includes('mo_adm')
    ) {
      const h = h0.includes('obra') ? h0 : h1;
      const startRow = h0.includes('obra') ? 2 : 3;
      const amountIdx = h.indexOf('medido piemonte') !== -1 ? h.indexOf('medido piemonte') : h.indexOf('valor') !== -1 ? h.indexOf('valor') : 2;
      return {
        preset: 'RECEITAS_MO_ADM',
        mode: 'financial_transactions',
        sheetName,
        startRow,
        projectCol: String(h.indexOf('obra') !== -1 ? h.indexOf('obra') : 0),
        dateCol: String(h.indexOf('data de cobrança') !== -1 ? h.indexOf('data de cobrança') : 1),
        amountCol: String(amountIdx),
        dreLineCol: String(h.indexOf('categoria') !== -1 ? h.indexOf('categoria') : 3),
        status: 'realizado',
        presetTitle: 'Banco de Cobranças de Equipe / Receitas MO ADM',
        presetDescription: 'Detecção Automática: Medições e cobranças de mão de obra de equipe por competência.',
      };
    }

    // Check RECEITAS TAXA ADM (Multi-sheet ou Banco de Dados)
    if (
      sheetName.toLowerCase().includes('banco de dados') ||
      sheetName.toLowerCase().includes('receitas taxa') ||
      sheetNames.includes('Unna') ||
      sheetNames.includes('Qoya') ||
      sheetNames.includes('Pace')
    ) {
      const h = h0.includes('projeto') ? h0 : h1;
      const startRow = h0.includes('projeto') ? 2 : 3;
      const dateIdx = h.indexOf('mês') !== -1 ? h.indexOf('mês') : h.indexOf('mes') !== -1 ? h.indexOf('mes') : h.indexOf('data') !== -1 ? h.indexOf('data') : 4;
      const projIdx = h.indexOf('projeto') !== -1 ? h.indexOf('projeto') : 0;
      const amountIdx = h.indexOf('valor cobrado') !== -1 ? h.indexOf('valor cobrado') : h.indexOf('valor') !== -1 ? h.indexOf('valor') : 2;
      const lineIdx = h.indexOf('tipologia') !== -1 ? h.indexOf('tipologia') : 1;

      const isMulti = !sheetName.toLowerCase().includes('banco de dados') && sheetNames.includes('Unna');

      return {
        preset: 'RECEITAS_TAXA_ADM_BD',
        mode: 'financial_transactions',
        sheetName,
        startRow,
        projectCol: String(projIdx),
        dateCol: String(dateIdx),
        dreLineCol: String(lineIdx),
        amountCol: String(amountIdx),
        status: 'realizado',
        presetTitle: 'Banco de Dados de Taxas de Administração (RECEITAS TAXA ADM.xlsx)',
        presetDescription: 'Detecção Automática: Tabela com Projeto, Tipologia, Valor Cobrado e Mês (Coluna 4).',
        isMultiSheetTaxaAdm: isMulti,
      };
    }
  }

  return {
    preset: 'CUSTOM_GENERIC',
    mode: 'financial_transactions',
    presetTitle: 'Planilha Genérica Mapeável',
    presetDescription: 'Selecione o tipo de lista ou matriz horizontal para mapear as colunas.',
  };
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
    if (val === undefined || val === null || val === 'N/A' || val === '') return 0;
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
    const replannedEnd = r[5] ? formatExcelDateStr(r[5]) : baselineEnd;
    const actualEndRaw = r[7] ? formatExcelDateStr(r[7]) : undefined;
    const actualEnd = actualEndRaw && actualEndRaw >= startDate ? actualEndRaw : replannedEnd;

    const mesInicial = parseNum(r[3]) || 24;
    const mesCvco = parseNum(r[4]);
    const mesEntregaUnidades = parseNum(r[6]);
    const maxMonths = Math.max(mesInicial, mesCvco, mesEntregaUnidades);

    const custoEquipeMensal = parseNum(r[9]);
    const prazoOrcamentoStr = r[10] ? String(r[10]).trim() : String(mesInicial);
    const custoOrcamentoEquipe = parseNum(r[11]);
    const pagamentoMultaVal = parseNum(r[13]);
    const riscoMultaVal = parseNum(r[17]);

    projectsMap[name] = {
      id: `proj-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name,
      type: 'Terceiros',
      startDate,
      baselineEndDate: baselineEnd,
      replannedEndDate: replannedEnd,
      actualEndDate: actualEnd,
      initialMonths: mesInicial,
      realMonths: maxMonths,
      contractValue: parseNum(r[16]) || parseNum(r[18]),
      contractNotes: r[14] ? String(r[14]).trim() : undefined,
      multaPercent: parseNum(r[15]),
      valorMulta: riscoMultaVal,
      estimatedMonthlyTeamCost: custoEquipeMensal || 28000,
      mesInicial,
      mesCvco,
      mesEntregaUnidades,
      diasAtraso: parseNum(r[8]),
      custoEquipeMensal,
      prazoOrcamentoStr,
      custoOrcamentoEquipe,
      pagamentoMultaVal,
      riscoMultaVal,
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
    p.estouroContratada = parseNum(r[9]);
    p.bandaPercent = parseNum(r[11]);
    p.clausulaCusto = r[12] ? String(r[12]).trim() : undefined;

    if (!p.contractValue || p.contractValue === 0) {
      p.contractValue = p.orcamentoTotalReajustado || p.projectedCostAtCompletion || 10000000;
    }
  }

  return Object.values(projectsMap) as ProjectContract[];
}

/**
 * Dedicated Parser for Custo de MO POR PROJETO.xlsx
 * Combines Col B (Ano) + Col C (Mês) and reads Col F (Categoria -> CUSTO EQUIPE)
 */
export function parseCustoMoPorProjeto(
  workbook: XLSX.WorkBook,
  fileName: string = 'Custo de MO POR PROJETO.xlsx',
  currentDateStr: string = new Date().toISOString().slice(0, 7)
): DRETransaction[] {
  const sheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes('custo de equipe') || s.toLowerCase().includes('equipe')) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
  if (rawData.length < 4) return [];

  const transactions: DRETransaction[] = [];

  for (let i = 4; i < rawData.length; i++) {
    const r = rawData[i];
    if (!r || !r[0]) continue;

    const projName = String(r[0]).trim();
    if (projName.toLowerCase().includes('total') || projName.toLowerCase().includes('resultado')) continue;

    const yearVal = r[1]; // Col B (Ano)
    const monthVal = r[2]; // Col C (Mês)
    const amountVal = r[4] !== undefined ? r[4] : r[3]; // Col E (Valor)
    const categoryVal = r[5] ? String(r[5]).trim() : 'CUSTO EQUIPE'; // Col F (Categoria)

    if (amountVal === undefined || amountVal === null) continue;
    const parsedAmount = Math.abs(parseFloat(String(amountVal).replace(/[^0-9.-]+/g, '')) || 0);

    if (parsedAmount > 0) {
      const formattedDate = parseYearAndMonthStr(yearVal, monthVal);
      const dreKey = suggestDRELineKey(categoryVal);
      const finalKey: DRELineKey = dreKey !== 'ignore' ? dreKey : 'custos_equipe';

      let finalStatus: TransactionStatus = 'realizado';
      let isAutoForecast = false;
      if (formattedDate > currentDateStr) {
        finalStatus = 'projetado';
        isAutoForecast = true;
      }

      transactions.push({
        id: `custo-mo-${projName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${formattedDate}-${i}`,
        project: projName,
        date: formattedDate,
        dreLineKey: finalKey,
        amount: parsedAmount,
        status: finalStatus,
        isAutoForecast,
        description: `Custo Real de MO de Equipe (${projName})`,
        sourceFile: fileName,
        sourceSheet: sheetName,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return transactions;
}

/**
 * Dedicated Parser for Multi-Sheet RECEITAS TAXA ADM.xlsx
 */
export function parseMultiSheetReceitasTaxaAdm(
  workbook: XLSX.WorkBook,
  fileName: string = 'RECEITAS TAXA ADM.xlsx',
  currentDateStr: string = new Date().toISOString().slice(0, 7)
): DRETransaction[] {
  const transactions: DRETransaction[] = [];
  const excludedSheets = ['incc - di', 'incc - m', 'banco de dados', 'resumo consolidado', 'leia-me'];

  workbook.SheetNames.forEach((sheetName) => {
    if (excludedSheets.includes(sheetName.toLowerCase().trim())) return;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
    if (rawData.length < 2) return;

    const projectName = sheetName.trim();

    for (let rIdx = 2; rIdx < rawData.length; rIdx++) {
      const row = rawData[rIdx];
      if (!row || row.length === 0) continue;

      const dateCell = row[0];
      const amountCell = row[3] || row[2] || row[4];

      if (!dateCell || !amountCell) continue;

      const parsedAmount = Math.abs(parseFloat(String(amountCell).replace(/[^0-9.-]+/g, '')) || 0);
      if (parsedAmount > 0) {
        const parsedDate = parseExcelDateYM(dateCell, 2024);
        const formattedDate = parsedDate.ym;

        let finalStatus: TransactionStatus = 'realizado';
        let isAutoForecast = false;

        if (formattedDate > currentDateStr) {
          finalStatus = 'projetado';
          isAutoForecast = true;
        }

        transactions.push({
          id: `taxa-${projectName}-${formattedDate}-${rIdx}`,
          project: projectName,
          date: formattedDate,
          dreLineKey: 'receita_taxa_adm',
          amount: parsedAmount,
          status: finalStatus,
          isAutoForecast,
          description: `Receita Taxa de Adm (${projectName})`,
          sourceFile: fileName,
          sourceSheet: sheetName,
          createdAt: new Date().toISOString(),
        });
      }
    }
  });

  return transactions;
}

/**
 * Generate Estimated Team Cost Transactions from Project Register (Prazo Obras Cols D, E, G, J)
 */
export function generateEstimatedTeamCostTransactions(
  projects: ProjectContract[],
  currentDateStr: string = new Date().toISOString().slice(0, 7)
): DRETransaction[] {
  const transactions: DRETransaction[] = [];

  projects.forEach((p) => {
    const custoMensal = p.custoEquipeMensal || p.estimatedMonthlyTeamCost || 0;
    if (custoMensal <= 0 || !p.startDate) return;

    const parsed = parseExcelDateYM(p.startDate, 2023);

    const mesD = p.mesInicial || p.initialMonths || 0;
    const mesE = p.mesCvco || 0;
    const mesG = p.mesEntregaUnidades || 0;
    const maxMonths = Math.max(mesD, mesE, mesG) || p.realMonths || p.initialMonths || 24;

    let [y, m] = [parsed.year, parsed.month];

    for (let step = 0; step < maxMonths; step++) {
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const isFuture = ym > currentDateStr;

      transactions.push({
        id: `est-team-${p.id || p.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${ym}`,
        project: p.name,
        date: ym,
        dreLineKey: 'custos_equipe',
        amount: custoMensal,
        status: isFuture ? 'projetado' : 'realizado',
        isAutoForecast: isFuture,
        description: `Custo Estimado Mensal de Equipe (Cronograma ${p.name})`,
        sourceFile: 'INFORMAÇÕES_PROJETOS.xlsx',
        sourceSheet: 'Prazo Obras',
        createdAt: new Date().toISOString(),
      });

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  });

  return transactions;
}

/**
 * Generate Estouro Contratada Transactions for Last Month of Projects
 */
export function generateEstouroTransactions(
  projects: ProjectContract[],
  currentDateStr: string = new Date().toISOString().slice(0, 7)
): DRETransaction[] {
  const transactions: DRETransaction[] = [];

  projects.forEach((p) => {
    if (p.estouroContratada && Math.abs(p.estouroContratada) > 0) {
      const endRaw = p.actualEndDate || p.replannedEndDate || p.baselineEndDate || '2025-12-01';
      const parsed = parseExcelDateYM(endRaw);
      const lastMonthStr = parsed.ym;

      let finalStatus: TransactionStatus = 'realizado';
      let isAutoForecast = false;

      if (lastMonthStr > currentDateStr) {
        finalStatus = 'projetado';
        isAutoForecast = true;
      }

      transactions.push({
        id: `estouro-${p.id || p.name.toLowerCase()}-${lastMonthStr}`,
        project: p.name,
        date: lastMonthStr,
        dreLineKey: 'estouro_contratada',
        amount: Math.abs(p.estouroContratada),
        status: finalStatus,
        isAutoForecast,
        description: `Estouro de Custo Suportado pela Contratada no Término (${p.name})`,
        sourceFile: 'INFORMAÇÕES_PROJETOS.xlsx',
        sourceSheet: 'Custo Obras',
        createdAt: new Date().toISOString(),
      });
    }
  });

  return transactions;
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

  if (lower.includes('estouro') && lower.includes('contratada')) return 'estouro_contratada';
  if (lower.includes('irpj') || lower.includes('csll') || lower.includes('imposto de renda')) return 'irpj_csll';
  if (lower.includes('permuta')) return 'permuta_taxa_adm';
  if (lower.includes('taxa de adm') || lower.includes('taxa adm') || lower.includes('receita adm') || lower.includes('receitas adm')) return 'receita_taxa_adm';
  if (lower.includes('mo adm') || lower.includes('mão de obra adm') || lower.includes('equipe adm') || lower.includes('receita mo')) return 'receita_mo_adm';
  if (lower.includes('assistência') && lower.includes('receita')) return 'receita_assistencia';
  if (lower.includes('imposto') || lower.includes('pis') || lower.includes('iss') || lower.includes('cofins') || lower.includes('tributo')) return 'impostos';
  if (lower.includes('assistência') && (lower.includes('despesa') || lower.includes('custo'))) return 'despesa_assistencia';
  if (lower.includes('equipe') || lower.includes('mão de obra') || lower.includes('mo') || lower.includes('salário') || lower.includes('folha') || lower.includes('custo equipe')) return 'custos_equipe';
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

export function processExcelImport(
  workbook: XLSX.WorkBook,
  config: ExcelImportConfig,
  currentDateStr: string = new Date().toISOString().slice(0, 7)
): DRETransaction[] {
  // 1. Check if Custo de MO POR PROJETO.xlsx
  const isCustoMoSheet = workbook.SheetNames.some((s) => s.toLowerCase().includes('custo de equipe') || s.toLowerCase().includes('equipe')) || config.fileName.toLowerCase().includes('custo de mo');
  if (isCustoMoSheet) {
    return parseCustoMoPorProjeto(workbook, config.fileName, currentDateStr);
  }

  // 2. Check if RECEITAS TAXA ADM multi-sheet file (legacy)
  const isMultiSheetTaxaAdm = config.isMultiSheetTaxaAdm || (workbook.SheetNames.includes('Unna') && workbook.SheetNames.includes('Qoya') && !workbook.SheetNames.includes('Banco de Dados'));
  if (isMultiSheetTaxaAdm) {
    return parseMultiSheetReceitasTaxaAdm(workbook, config.fileName, currentDateStr);
  }

  const sheet = workbook.Sheets[config.sheetName];
  if (!sheet) return [];

  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

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

  for (let rowIdx = startIdx; rowIdx < endIdx; rowIdx++) {
    const row = rawData[rowIdx];
    if (!row || row.length === 0) continue;

    const dateCellData = config.mapping.dateCol !== undefined && config.mapping.dateCol !== '' ? getCellData(rowIdx, parseInt(config.mapping.dateCol, 10)) : { rawVal: null, formattedVal: null };
    const dateVal = dateCellData.rawVal || dateCellData.formattedVal || (config.mapping.dateCol ? row[parseInt(config.mapping.dateCol, 10)] : null);

    const amountVal = config.mapping.amountCol !== undefined && config.mapping.amountCol !== '' ? row[parseInt(config.mapping.amountCol, 10)] : null;
    const projectVal = config.mapping.projectCol !== undefined && config.mapping.projectCol !== '' ? row[parseInt(config.mapping.projectCol, 10)] : config.preselectedProject;
    const statusVal = config.mapping.statusCol !== undefined && config.mapping.statusCol !== '' ? row[parseInt(config.mapping.statusCol, 10)] : config.preselectedStatus || 'realizado';
    const dreLineVal = config.mapping.dreLineCol !== undefined && config.mapping.dreLineCol !== '' ? row[parseInt(config.mapping.dreLineCol, 10)] : '';
    const descVal = config.mapping.descriptionCol !== undefined && config.mapping.descriptionCol !== '' ? row[parseInt(config.mapping.descriptionCol, 10)] : '';

    if (!amountVal && amountVal !== 0) continue;
    const parsedAmount = Math.abs(parseFloat(String(amountVal).replace(/[^0-9.-]+/g, '')));
    if (isNaN(parsedAmount) || parsedAmount === 0) continue;

    const mappedKey = resolveLineKey(dreLineVal);

    if (mappedKey === 'ignore') continue;

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
  }

  return transactions;
}
