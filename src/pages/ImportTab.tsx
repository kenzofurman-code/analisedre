import React, { useState } from 'react';
import {
  getSheetPreview,
  parseExcelFileSheets,
  processExcelImport,
  extractUniqueDRELabels,
  parseProjectsInfoSheet,
  detectSpreadsheetPreset,
  SpreadsheetPreset,
  ParsedSheetPreview,
} from '../utils/excelParser';
import { DRELineKey, DRETransaction, ExcelImportConfig, ProjectContract, TransactionStatus } from '../types/dre';
import { DRE_LINE_DEFINITIONS } from '../constants/dreStructure';
import {
  FileUp,
  Table,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  FileSpreadsheet,
  LayoutGrid,
  ListOrdered,
  SlidersHorizontal,
  XCircle,
  Building2,
  Briefcase,
  Layers,
  Zap,
  Sparkles,
} from 'lucide-react';
import * as XLSX from 'xlsx';

export type ImportCategoryMode = 'projects_register' | 'financial_transactions';
export type SpreadsheetType = 'tabular' | 'horizontal_matrix';

interface ImportTabProps {
  projects: ProjectContract[];
  onImportComplete: (newTransactions: DRETransaction[]) => void;
  onImportProjects?: (newProjects: ProjectContract[]) => void;
}

export const ImportTab: React.FC<ImportTabProps> = ({ projects, onImportComplete, onImportProjects }) => {
  const [importCategoryMode, setImportCategoryMode] = useState<ImportCategoryMode>('projects_register');
  const [step, setStep] = useState<number>(1);

  // Common file state
  const [fileName, setFileName] = useState<string>('');
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [presetInfo, setPresetInfo] = useState<SpreadsheetPreset | null>(null);

  // Projects Register State
  const [extractedProjects, setExtractedProjects] = useState<ProjectContract[]>([]);

  // Financial Transactions State
  const [spreadsheetType, setSpreadsheetType] = useState<SpreadsheetType>('tabular');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetPreview, setSheetPreview] = useState<ParsedSheetPreview | null>(null);

  // Tabular Config State
  const [startRow, setStartRow] = useState<number>(2);
  const [endRow, setEndRow] = useState<string>('');
  const [dateCol, setDateCol] = useState<string>('');
  const [amountCol, setAmountCol] = useState<string>('');
  const [dreLineCol, setDreLineCol] = useState<string>('');
  const [projectCol, setProjectCol] = useState<string>('');
  const [statusCol, setStatusCol] = useState<string>('');
  const [descriptionCol, setDescriptionCol] = useState<string>('');

  // Horizontal Matrix Config State
  const [dateHeaderRow, setDateHeaderRow] = useState<number>(1);
  const [startDateCol, setStartDateCol] = useState<string>('');
  const [endDateCol, setEndDateCol] = useState<string>('');

  // Overrides
  const [preselectedProject, setPreselectedProject] = useState<string>('Varanda');
  const [preselectedStatus, setPreselectedStatus] = useState<TransactionStatus>('realizado');
  const [preselectedDRELine, setPreselectedDRELine] = useState<DRELineKey>('receita_taxa_adm');

  // De-Para Interactive Mapping State (Step 3)
  const [uniqueDRELabels, setUniqueDRELabels] = useState<{ label: string; suggestedKey: DRELineKey | 'ignore' }[]>([]);
  const [lineCategoryMapping, setLineCategoryMapping] = useState<Record<string, DRELineKey | 'ignore'>>({});

  const [importedPreviewData, setImportedPreviewData] = useState<DRETransaction[]>([]);
  const [autoForecastCount, setAutoForecastCount] = useState<number>(0);

  const formatDisplayDate = (ym: string) => {
    if (!ym || !ym.includes('-')) return ym;
    const [y, m] = ym.split('-');
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthIdx = parseInt(m, 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${monthNames[monthIdx]}/${y.slice(2)} (${ym})`;
    }
    return ym;
  };

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const { sheetNames, workbook } = parseExcelFileSheets(buffer);
      setWorkbook(workbook);
      setSheetNames(sheetNames);

      // Auto Detect Smart Preset
      const detected = detectSpreadsheetPreset(workbook);
      setPresetInfo(detected);

      if (detected.mode === 'projects_register') {
        setImportCategoryMode('projects_register');
        const parsedProjList = parseProjectsInfoSheet(workbook);
        setExtractedProjects(parsedProjList);
        setStep(2);
      } else {
        setImportCategoryMode('financial_transactions');
        const targetSheet = detected.sheetName || sheetNames[0] || '';
        setSelectedSheet(targetSheet);

        if (detected.startRow) setStartRow(detected.startRow);
        if (detected.projectCol !== undefined) setProjectCol(detected.projectCol);
        if (detected.dateCol !== undefined) setDateCol(detected.dateCol);
        if (detected.dreLineCol !== undefined) setDreLineCol(detected.dreLineCol);
        if (detected.amountCol !== undefined) setAmountCol(detected.amountCol);
        if (detected.status) setPreselectedStatus(detected.status);

        if (targetSheet) {
          const preview = getSheetPreview(workbook, targetSheet, 30);
          setSheetPreview(preview);
        }
        setStep(2);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmProjectsImport = () => {
    if (onImportProjects) {
      onImportProjects(extractedProjects);
    }
    setStep(5);
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      const preview = getSheetPreview(workbook, sheetName, 30);
      setSheetPreview(preview);
    }
  };

  const handleGoToDeParaStep = () => {
    if (!workbook || !selectedSheet) return;
    const parsedEndRow = endRow !== '' ? parseInt(endRow, 10) : undefined;

    const tempConfig: ExcelImportConfig = {
      fileName,
      sheetName: selectedSheet,
      startRow,
      endRow: parsedEndRow,
      mapping: {
        dateColMode: spreadsheetType === 'horizontal_matrix' ? 'range' : 'single',
        dateCol: dateCol !== '' ? dateCol : undefined,
        startDateCol: startDateCol !== '' ? startDateCol : undefined,
        endDateCol: endDateCol !== '' ? endDateCol : undefined,
        dateHeaderRow,
        amountCol: amountCol !== '' ? amountCol : undefined,
        dreLineCol: dreLineCol !== '' ? dreLineCol : undefined,
        projectCol: projectCol !== '' ? projectCol : undefined,
        statusCol: statusCol !== '' ? statusCol : undefined,
        descriptionCol: descriptionCol !== '' ? descriptionCol : undefined,
      },
      preselectedProject,
      preselectedStatus,
      preselectedDRELine,
    };

    const extracted = extractUniqueDRELabels(workbook, tempConfig);
    setUniqueDRELabels(extracted);

    const initialMap: Record<string, DRELineKey | 'ignore'> = {};
    extracted.forEach((item) => {
      initialMap[item.label] = item.suggestedKey;
    });
    setLineCategoryMapping(initialMap);

    setStep(3);
  };

  const handleGeneratePreview = () => {
    if (!workbook || !selectedSheet) return;
    const parsedEndRow = endRow !== '' ? parseInt(endRow, 10) : undefined;

    const config: ExcelImportConfig = {
      fileName,
      sheetName: selectedSheet,
      startRow,
      endRow: parsedEndRow,
      mapping: {
        dateColMode: spreadsheetType === 'horizontal_matrix' ? 'range' : 'single',
        dateCol: dateCol !== '' ? dateCol : undefined,
        startDateCol: startDateCol !== '' ? startDateCol : undefined,
        endDateCol: endDateCol !== '' ? endDateCol : undefined,
        dateHeaderRow,
        amountCol: amountCol !== '' ? amountCol : undefined,
        dreLineCol: dreLineCol !== '' ? dreLineCol : undefined,
        projectCol: projectCol !== '' ? projectCol : undefined,
        statusCol: statusCol !== '' ? statusCol : undefined,
        descriptionCol: descriptionCol !== '' ? descriptionCol : undefined,
        lineCategoryMapping,
      },
      preselectedProject,
      preselectedStatus,
      preselectedDRELine,
    };

    const parsed = processExcelImport(workbook, config);
    setImportedPreviewData(parsed);

    const autoCount = parsed.filter((t) => t.isAutoForecast).length;
    setAutoForecastCount(autoCount);

    setStep(4);
  };

  const handleConfirmImport = () => {
    onImportComplete(importedPreviewData);
    setStep(5);
  };

  const handleReset = () => {
    setStep(1);
    setFileName('');
    setWorkbook(null);
    setPresetInfo(null);
    setSheetNames([]);
    setSheetPreview(null);
    setImportedPreviewData([]);
    setExtractedProjects([]);
    setUniqueDRELabels([]);
    setLineCategoryMapping({});
  };

  const handleMappingChange = (label: string, value: DRELineKey | 'ignore') => {
    setLineCategoryMapping((prev) => ({ ...prev, [label]: value }));
  };

  // Helper Renderer for 4 Specific Cost Lines
  const render4CostLines = (p: ProjectContract) => {
    const baseRaso = p.orcamentoRasoReajustado || 0;
    const projRaso = p.projecaoRasoAtual !== undefined ? p.projecaoRasoAtual : baseRaso;
    const hasRasoDiff = baseRaso > 0 && Math.abs(projRaso - baseRaso) > 0.01;
    const isRasoIncrease = projRaso > baseRaso;

    const resultRaso = p.resultadoRasoAtual !== undefined ? p.resultadoRasoAtual : (baseRaso - projRaso);

    const baseTotal = p.orcamentoTotalReajustado || p.contractValue || 0;
    const projTotal = p.projectedCostAtCompletion !== undefined ? p.projectedCostAtCompletion : baseTotal;
    const hasTotalDiff = baseTotal > 0 && Math.abs(projTotal - baseTotal) > 0.01;
    const isTotalIncrease = projTotal > baseTotal;

    const resultTotal = p.resultAtCompletion !== undefined ? p.resultAtCompletion : (baseTotal - projTotal);

    return (
      <div className="space-y-2 text-[11px] bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        {/* Linha 1: Orçamento Raso */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-slate-400 font-semibold">1. Orçamento Raso:</span>
          <div className="font-mono font-bold flex items-center space-x-1.5">
            <span className="text-slate-300">{formatMoney(baseRaso)}</span>
            {hasRasoDiff && (
              <>
                <span className="text-slate-500">➡️</span>
                <span className={isRasoIncrease ? 'text-rose-400' : 'text-emerald-400'}>
                  {formatMoney(projRaso)}
                </span>
                <span title={isRasoIncrease ? 'Aumento de custo raso' : 'Redução de custo raso'}>
                  {isRasoIncrease ? '🔺' : '🔻'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Linha 2: Resultado Raso */}
        <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
          <span className="text-slate-400 font-semibold">2. Resultado Raso:</span>
          <span className={`font-mono font-bold ${resultRaso >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatMoney(resultRaso)}
          </span>
        </div>

        {/* Linha 3: Custo Total */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
          <span className="text-slate-400 font-semibold">3. Custo Total:</span>
          <div className="font-mono font-bold flex items-center space-x-1.5">
            <span className="text-slate-300">{formatMoney(baseTotal)}</span>
            {hasTotalDiff && (
              <>
                <span className="text-slate-500">➡️</span>
                <span className={isTotalIncrease ? 'text-rose-400' : 'text-emerald-400'}>
                  {formatMoney(projTotal)}
                </span>
                <span title={isTotalIncrease ? 'Aumento de custo total' : 'Redução de custo total'}>
                  {isTotalIncrease ? '🔺' : '🔻'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Linha 4: Resultado Total */}
        <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
          <span className="text-slate-400 font-semibold">4. Resultado Total:</span>
          <span className={`font-mono font-bold ${resultTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatMoney(resultTotal)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Step Progress & Mode Selector Header */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Central de Importação Múltipla Excel</h3>
            <p className="text-xs text-slate-400">Detecção Automática de Formatos Refatorados & Banco de Dados</p>
          </div>
        </div>

        {/* Import Mode Tabs Selector */}
        <div className="flex items-center space-x-1 bg-slate-900/80 border border-slate-700/60 rounded-xl p-1">
          <button
            type="button"
            onClick={() => {
              setImportCategoryMode('projects_register');
              handleReset();
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              importCategoryMode === 'projects_register'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>1. Cadastro de Projetos (INFORMAÇÕES_PROJETOS)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setImportCategoryMode('financial_transactions');
              handleReset();
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              importCategoryMode === 'financial_transactions'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Lançamentos Financeiros DRE</span>
          </button>
        </div>
      </div>

      {/* STEP 1: Upload File */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="glass-panel p-8 rounded-2xl text-center border-2 border-dashed border-slate-700/80 hover:border-blue-500/50 transition-colors">
            <div
              className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3 ${
                importCategoryMode === 'projects_register'
                  ? 'bg-blue-600/10 text-blue-400'
                  : 'bg-emerald-600/10 text-emerald-400'
              }`}
            >
              <FileUp className="w-7 h-7" />
            </div>
            <h4 className="text-base font-bold text-slate-100 mb-1">
              Carregar Qualquer Planilha Excel (.xlsx, .xls)
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
              O leitor detectará automaticamente o formato (<strong>INFORMAÇÕES_PROJETOS</strong>, <strong>PREVISAO DRE OBRAS</strong>, <strong>RECEITAS MO ADM</strong>, <strong>RECEITAS TAXA ADM</strong> ou Matrizes).
            </p>
            <label
              className={`inline-flex items-center space-x-2 font-semibold text-xs px-5 py-3 rounded-xl cursor-pointer shadow-lg transition-all text-white ${
                importCategoryMode === 'projects_register'
                  ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/25'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/25'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Selecionar Arquivo Excel</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* MODE 1 STEP 2: Dedicated Layout for Project Register Import */}
      {step === 2 && importCategoryMode === 'projects_register' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100">
                    Cadastro de Projetos Extraído: <span className="text-blue-400">{extractedProjects.length} Obras Encontradas</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Planilha original: <strong>{fileName}</strong> (Abas: Prazo Obras & Custo Obras)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConfirmProjectsImport}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar & Salvar Cadastro de Projetos</span>
              </button>
            </div>

            {/* Grid of Extracted Projects Cards with 4 Cost Lines */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[550px] overflow-y-auto pr-1">
              {extractedProjects.map((p) => (
                <div key={p.name} className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between">
                    <h5 className="text-sm font-bold text-slate-100 flex items-center space-x-1.5">
                      <Briefcase className="w-4 h-4 text-blue-400" />
                      <span>{p.name}</span>
                    </h5>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        p.type === 'Terceiros'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {p.type}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                    <div>
                      <span className="text-slate-400 font-semibold block">Valor do Contrato:</span>
                      <span className="text-emerald-400 font-mono font-bold">{formatMoney(p.contractValue)}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block">Prazo Obra (Meses):</span>
                      <span className="text-slate-200 font-mono font-bold">{p.initialMonths} meses</span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block">Data Início (Base):</span>
                      <span className="text-blue-300 font-mono">{p.startDate}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 font-semibold block">Término Replanejado:</span>
                      <span className="text-amber-300 font-mono">{p.replannedEndDate}</span>
                    </div>
                  </div>

                  {/* RENDER THE 4 SPECIFIC COST LINES WITH VARIATION ARROWS & TRIANGLES */}
                  {render4CostLines(p)}

                  {p.clausulaCusto && (
                    <div className="text-[10px] text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800/40 line-clamp-2" title={p.clausulaCusto}>
                      💡 <strong>Cláusula Custo:</strong> {p.clausulaCusto}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmProjectsImport}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar & Salvar no Banco de Dados</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2 STEP 2: Configure Financial Mapping */}
      {step === 2 && importCategoryMode === 'financial_transactions' && sheetPreview && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            {/* Auto Detection Smart Card */}
            {presetInfo && presetInfo.preset !== 'CUSTOM_GENERIC' && (
              <div className="p-4 bg-gradient-to-r from-emerald-950/40 via-blue-950/40 to-slate-900 border border-emerald-500/40 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                    <Zap className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-emerald-300 flex items-center space-x-2">
                      <span>⚡ Formato Banco de Dados Reconhecido:</span>
                      <span className="text-slate-100 font-mono underline">{presetInfo.presetTitle}</span>
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">{presetInfo.presetDescription}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoToDeParaStep}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex-shrink-0"
                >
                  <span>1-Clique: Avançar para De-Para</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-slate-200">
                  Arquivo: <span className="text-blue-400">{fileName}</span>
                </h4>
                <p className="text-xs text-slate-400">Total de linhas: {sheetPreview.totalRows} | Colunas: {sheetPreview.totalCols}</p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-400">Aba da Planilha:</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  aria-label="Selecionar Aba da Planilha"
                  className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 font-medium"
                >
                  {sheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                1. Selecione o Tipo/Formato da Planilha:
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSpreadsheetType('tabular')}
                  className={`p-4 rounded-xl border text-left transition-all space-y-2 ${
                    spreadsheetType === 'tabular'
                      ? 'bg-blue-600/15 border-blue-500 text-slate-100 ring-2 ring-blue-500/20'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <ListOrdered className="w-5 h-5 text-blue-400" />
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                      Lista por Linhas / Banco de Dados
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">Tipo 1: Lista Tabular (Formatos Refatorados BD)</h5>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Cada linha representa um lançamento com Obra, Mês, Conta e Valor. Ex: PREVISAO DRE, RECEITAS MO ADM.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSpreadsheetType('horizontal_matrix')}
                  className={`p-4 rounded-xl border text-left transition-all space-y-2 ${
                    spreadsheetType === 'horizontal_matrix'
                      ? 'bg-indigo-600/15 border-indigo-500 text-slate-100 ring-2 ring-indigo-500/20'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <LayoutGrid className="w-5 h-5 text-indigo-400" />
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                      Matriz Mês a Mês
                    </span>
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-200">Tipo 2: Matriz Horizontal (Intervalo de Datas)</h5>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Datas/meses distribuídos em várias colunas (ex: Col E a Col AB). Linhas são as categorias DRE.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {spreadsheetType === 'tabular' && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  2. Mapeamento das Colunas da Lista Tabular:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Linha Inicial dos Dados:</label>
                    <input
                      type="number"
                      min="1"
                      value={startRow}
                      onChange={(e) => setStartRow(parseInt(e.target.value, 10) || 1)}
                      aria-label="Linha Inicial dos Dados"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Linha Final (Opcional - Vazio = Fim):</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ex: 100"
                      value={endRow}
                      onChange={(e) => setEndRow(e.target.value)}
                      aria-label="Linha Final dos Dados"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Coluna da Data/Mês:</label>
                    <select
                      value={dateCol}
                      onChange={(e) => setDateCol(e.target.value)}
                      aria-label="Coluna da Data"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="">Nenhuma (Usar mês atual)</option>
                      {sheetPreview.headers.map((h) => (
                        <option key={h.index} value={h.index}>
                          [{h.colLetter}] {h.sampleVal}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Coluna do Valor (R$):</label>
                    <select
                      value={amountCol}
                      onChange={(e) => setAmountCol(e.target.value)}
                      aria-label="Coluna do Valor"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="">Selecione a coluna de valor</option>
                      {sheetPreview.headers.map((h) => (
                        <option key={h.index} value={h.index}>
                          [{h.colLetter}] {h.sampleVal}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-amber-400">Classificação do Status Contábil:</label>
                    <select
                      value={preselectedStatus}
                      onChange={(e) => setPreselectedStatus(e.target.value as TransactionStatus)}
                      aria-label="Classificação do Status Contábil"
                      className="w-full bg-slate-900 border border-amber-500/50 text-xs text-slate-200 font-bold rounded-xl px-3 py-2"
                    >
                      <option value="realizado">Realizado (Efetivado no Passado/Atual)</option>
                      <option value="projetado">Projetado (Projeção Futura)</option>
                      <option value="previsto_inicial">Previsto Inicial (Viabilidade Base)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Coluna do Projeto / Obra:</label>
                    <select
                      value={projectCol}
                      onChange={(e) => setProjectCol(e.target.value)}
                      aria-label="Coluna do Projeto"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="">Fixar Projeto Pré-selecionado 👇</option>
                      {sheetPreview.headers.map((h) => (
                        <option key={h.index} value={h.index}>
                          [{h.colLetter}] {h.sampleVal}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!projectCol && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-blue-400">Pré-selecionar Projeto Pertencente:</label>
                      <select
                        value={preselectedProject}
                        onChange={(e) => setPreselectedProject(e.target.value)}
                        aria-label="Pré-selecionar Projeto Pertencente"
                        className="w-full bg-slate-900 border border-blue-500/50 text-xs text-slate-200 rounded-xl px-3 py-2"
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Coluna Linha DRE / Categoria:</label>
                    <select
                      value={dreLineCol}
                      onChange={(e) => setDreLineCol(e.target.value)}
                      aria-label="Coluna Linha DRE"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="">Mapear no Próximo Passo (De-Para) 👇</option>
                      {sheetPreview.headers.map((h) => (
                        <option key={h.index} value={h.index}>
                          [{h.colLetter}] {h.sampleVal}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {spreadsheetType === 'horizontal_matrix' && (
              <div className="space-y-4 pt-2 border-t border-slate-800">
                <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl text-xs text-indigo-300">
                  💡 Indique a <strong>linha do cabeçalho de datas</strong>, o <strong>intervalo de colunas (De Coluna a Coluna)</strong> e o <strong>intervalo de linhas</strong>!
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-indigo-300">Linha do Cabeçalho de Datas:</label>
                    <input
                      type="number"
                      min="1"
                      value={dateHeaderRow}
                      onChange={(e) => setDateHeaderRow(parseInt(e.target.value, 10) || 1)}
                      aria-label="Linha do Cabeçalho de Datas"
                      className="w-full bg-slate-900 border border-indigo-500/50 text-xs text-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-indigo-300">De Coluna (Data Inicial):</label>
                    <select
                      value={startDateCol}
                      onChange={(e) => setStartDateCol(e.target.value)}
                      aria-label="Coluna Inicial de Datas"
                      className="w-full bg-slate-900 border border-indigo-500/50 text-xs text-slate-200 rounded-xl px-3 py-2 font-mono"
                    >
                      <option value="">Selecione a primeira coluna de data</option>
                      {sheetPreview.headers.map((h) => (
                        <option key={h.index} value={h.index}>
                          [{h.colLetter}] {h.sampleVal}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-indigo-300">Até Coluna (Data Final):</label>
                    <select
                      value={endDateCol}
                      onChange={(e) => setEndDateCol(e.target.value)}
                      aria-label="Coluna Final de Datas"
                      className="w-full bg-slate-900 border border-indigo-500/50 text-xs text-slate-200 rounded-xl px-3 py-2 font-mono"
                    >
                      <option value="">Selecione a última coluna de data</option>
                      {sheetPreview.headers.map((h) => (
                        <option key={h.index} value={h.index}>
                          [{h.colLetter}] {h.sampleVal}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">De Linha (Linha Inicial Dados):</label>
                    <input
                      type="number"
                      min="1"
                      value={startRow}
                      onChange={(e) => setStartRow(parseInt(e.target.value, 10) || 1)}
                      aria-label="Linha Inicial de Dados"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Até Linha (Linha Final Dados - Vazio = Fim):</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="Ex: 50"
                      value={endRow}
                      onChange={(e) => setEndRow(e.target.value)}
                      aria-label="Linha Final de Dados"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-amber-400">Classificação do Status Contábil:</label>
                    <select
                      value={preselectedStatus}
                      onChange={(e) => setPreselectedStatus(e.target.value as TransactionStatus)}
                      aria-label="Classificação do Status Contábil"
                      className="w-full bg-slate-900 border border-amber-500/50 text-xs text-slate-200 font-bold rounded-xl px-3 py-2"
                    >
                      <option value="realizado">Realizado (Efetivado no Passado/Atual)</option>
                      <option value="projetado">Projetado (Projeção Futura)</option>
                      <option value="previsto_inicial">Previsto Inicial (Viabilidade Base)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Coluna Linha DRE / Categoria:</label>
                    <select
                      value={dreLineCol}
                      onChange={(e) => setDreLineCol(e.target.value)}
                      aria-label="Coluna Linha DRE"
                      className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2"
                    >
                      <option value="">Coluna B (Padrão) ou selecione a coluna</option>
                      {sheetPreview.headers.map((h) => (
                        <option key={h.index} value={h.index}>
                          [{h.colLetter}] {h.sampleVal}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-blue-400">Pré-selecionar Projeto Pertencente:</label>
                    <select
                      value={preselectedProject}
                      onChange={(e) => setPreselectedProject(e.target.value)}
                      aria-label="Pré-selecionar Projeto Pertencente"
                      className="w-full bg-slate-900 border border-blue-500/50 text-xs text-slate-200 rounded-xl px-3 py-2"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span className="flex items-center space-x-2">
                  <Table className="w-4 h-4 text-blue-400" />
                  <span>Pré-visualização da Planilha (30 Primeiras Linhas Visíveis):</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono font-normal">Exibindo 30 linhas</span>
              </p>
              <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-80">
                <table className="w-full text-[11px] text-left text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2 border-b border-slate-800">Linha</th>
                      {sheetPreview.headers.map((h) => (
                        <th key={h.index} className="px-3 py-2 border-b border-slate-800 whitespace-nowrap">
                          {h.colLetter} ({h.sampleVal.slice(0, 15)})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sheetPreview.previewRows.slice(0, 30).map((r, rIdx) => (
                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-dark-800/40' : 'bg-slate-900/20'}>
                        <td className="px-3 py-1.5 border-b border-slate-800/50 font-mono text-slate-500">{rIdx + 1}</td>
                        {sheetPreview.headers.map((h) => (
                          <td key={h.index} className="px-3 py-1.5 border-b border-slate-800/50 truncate max-w-xs">
                            {r[h.index] !== undefined ? String(r[h.index]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                onClick={handleGoToDeParaStep}
                disabled={
                  (spreadsheetType === 'tabular' && amountCol === '') ||
                  (spreadsheetType === 'horizontal_matrix' && (startDateCol === '' || endDateCol === ''))
                }
                className={`flex items-center space-x-1.5 px-6 py-2.5 text-xs font-semibold rounded-xl shadow-lg transition-all ${
                  (spreadsheetType === 'tabular' && amountCol === '') ||
                  (spreadsheetType === 'horizontal_matrix' && (startDateCol === '' || endDateCol === ''))
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
                }`}
              >
                <span>Avançar para De-Para de Linhas DRE</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: INTERACTIVE DE-PARA & TOTALIZER FILTERING */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <SlidersHorizontal className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-100">Passo 3: Mapeamento De-Para & Filtro de Totalizadores</h4>
                  <p className="text-xs text-slate-400">
                    Encontradas <strong>{uniqueDRELabels.length} linhas únicas</strong> no intervalo selecionado. Associe cada linha à sua categoria DRE ou selecione "Desconsiderar" para ignorar totalizadores!
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const newMap: Record<string, DRELineKey | 'ignore'> = {};
                    uniqueDRELabels.forEach((item) => {
                      const lower = item.label.toLowerCase();
                      if (
                        lower.includes('total') ||
                        lower.includes('subtotal') ||
                        lower.includes('saldo') ||
                        lower.includes('resultado') ||
                        lower.includes('margem') ||
                        lower.includes('lucro')
                      ) {
                        newMap[item.label] = 'ignore';
                      } else {
                        newMap[item.label] = item.suggestedKey;
                      }
                    });
                    setLineCategoryMapping(newMap);
                  }}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold rounded-xl"
                >
                  ⚡ Auto-Ignorar Totalizadores
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-[500px]">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 border-r border-slate-800">Descrição Encontrada na Planilha</th>
                    <th className="px-4 py-3 border-r border-slate-800">Categoria Mapeada no Banco de Dados DRE</th>
                    <th className="px-4 py-3 text-center">Ação / Status</th>
                  </tr>
                </thead>
                <tbody>
                  {uniqueDRELabels.map((item, idx) => {
                    const currentMapping = lineCategoryMapping[item.label] || item.suggestedKey;
                    const isIgnored = currentMapping === 'ignore';

                    return (
                      <tr key={idx} className={`border-b border-slate-800/40 ${isIgnored ? 'bg-slate-950/40 opacity-75' : 'hover:bg-slate-800/30'}`}>
                        <td className="px-4 py-3 font-semibold text-slate-200 border-r border-slate-800/50">
                          <div className="flex items-center space-x-2">
                            {isIgnored ? (
                              <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            )}
                            <span className={isIgnored ? 'line-through text-slate-500' : ''}>{item.label}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 border-r border-slate-800/50">
                          <select
                            value={currentMapping}
                            onChange={(e) => handleMappingChange(item.label, e.target.value as DRELineKey | 'ignore')}
                            aria-label={`Mapeamento para ${item.label}`}
                            className={`w-full text-xs font-bold rounded-xl px-3 py-2 border transition-all ${
                              isIgnored
                                ? 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                                : 'bg-slate-900 border-blue-500/50 text-slate-100'
                            }`}
                          >
                            <option value="ignore" className="bg-dark-800 text-rose-400 font-bold">
                              🚫 DESCONSIDERAR (Totalizador / Subtotal / Ignorar)
                            </option>
                            <optgroup label="── 🟢 RECEITAS ──" className="bg-dark-800 text-emerald-400">
                              <option value="receita_taxa_adm">Receita Taxa de Adm</option>
                              <option value="permuta_taxa_adm">Permuta Taxa de Adm</option>
                              <option value="receita_mo_adm">Receita MO Adm</option>
                              <option value="receita_assistencia">Receita Assistência</option>
                            </optgroup>
                            <optgroup label="── 🔴 CUSTOS E DESPESAS ──" className="bg-dark-800 text-rose-400">
                              <option value="impostos">Impostos (PIS/COFINS/ISS/CPR)</option>
                              <option value="irpj_csll">IRPJ + CSLL (Imposto de Renda e Contribuição Social)</option>
                              <option value="despesa_assistencia">Despesa Assistência Técnica</option>
                              <option value="custos_equipe">Custos Equipe (Mão de Obra)</option>
                              <option value="custos_deslocamento">Custos Deslocamento / Logística</option>
                              <option value="despesas_adm_pie">Despesas ADM Pie</option>
                            </optgroup>
                          </select>
                        </td>

                        <td className="px-4 py-3 text-center">
                          {isIgnored ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              Ignorado
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              Importando
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar para Colunas</span>
              </button>

              <button
                type="button"
                onClick={handleGeneratePreview}
                className="flex items-center space-x-1.5 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/25 transition-all"
              >
                <span>Processar & Visualizar Prévia</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Preview Processed Data */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h4 className="text-base font-bold text-slate-100">Prévia dos Lançamentos Validados a Importar</h4>
                <p className="text-xs text-slate-400">Total de registros extraídos (sem totalizadores): {importedPreviewData.length}</p>
              </div>

              {autoForecastCount > 0 && (
                <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-xl text-amber-400 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    <strong>{autoForecastCount} lançamentos</strong> "Realizados" com data futura foram marcados
                    automaticamente como <strong>"Projetado (Futuro)"</strong>.
                  </span>
                </div>
              )}
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl max-h-96">
              <table className="w-full text-xs text-left text-slate-300">
                <thead className="bg-slate-900 text-slate-400 font-semibold sticky top-0">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-800">Data / Mês Competência</th>
                    <th className="px-4 py-3 border-b border-slate-800">Projeto</th>
                    <th className="px-4 py-3 border-b border-slate-800">Linha DRE Mapeada</th>
                    <th className="px-4 py-3 border-b border-slate-800 text-right">Valor (R$)</th>
                    <th className="px-4 py-3 border-b border-slate-800 text-center">Status Contábil</th>
                    <th className="px-4 py-3 border-b border-slate-800">Descrição Original</th>
                  </tr>
                </thead>
                <tbody>
                  {importedPreviewData.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-mono text-emerald-400 font-bold">
                        {formatDisplayDate(tx.date)}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-blue-400">{tx.project}</td>
                      <td className="px-4 py-2.5">
                        {DRE_LINE_DEFINITIONS.find((d) => d.key === tx.dreLineKey)?.label || tx.dreLineKey}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-right text-emerald-400">
                        {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            tx.status === 'realizado'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : tx.status === 'projetado'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                              : 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          }`}
                        >
                          {tx.status === 'realizado'
                            ? 'Realizado'
                            : tx.status === 'projetado'
                            ? 'Projetado (Futuro)'
                            : 'Previsto Inicial'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 truncate max-w-xs">{tx.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold rounded-xl"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ajustar De-Para</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar & Salvar no Banco de Dados DRE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 5: Success Message */}
      {step === 5 && (
        <div className="glass-panel p-10 rounded-2xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-600/20 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h4 className="text-xl font-bold text-slate-100">
            {importCategoryMode === 'projects_register'
              ? 'Cadastro de Projetos Atualizado com Sucesso!'
              : 'Importação Concluída com Sucesso!'}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {importCategoryMode === 'projects_register'
              ? `${extractedProjects.length} projetos foram cadastrados e atualizados no banco de dados.`
              : 'Os lançamentos foram consolidados e já estão disponíveis no DRE no Tempo, Fluxo de Caixa e Dashboards.'}
          </p>
          <div className="pt-4 flex justify-center space-x-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Importar Outro Arquivo</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
