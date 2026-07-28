export type DRELineCategory = 'RECEITA' | 'DESPESA' | 'CUSTO' | 'CALCULATED';

export type DRELineKey =
  | 'receita_taxa_adm'
  | 'permuta_taxa_adm'
  | 'receita_mo_adm'
  | 'receita_assistencia'
  | 'impostos'
  | 'despesa_assistencia'
  | 'custos_equipe'
  | 'custos_deslocamento'
  | 'estouro_contratada'
  | 'margem_bruta_val'
  | 'margem_bruta_pct'
  | 'despesas_adm_pie'
  | 'resultado'
  | 'irpj_csll'
  | 'resultado_final'
  | 'margem_liquida_pct'
  | 'receita_liquida'
  | 'curva_fisica_obra'
  | 'receitas_menos_impostos';

export interface DRELineDefinition {
  key: DRELineKey;
  label: string;
  category: DRELineCategory;
  isCalculated?: boolean;
  isHeader?: boolean;
  isSubtotal?: boolean;
  sourceOriginInfo?: string;
  formulaInfo?: string;
}

export type TransactionStatus = 'realizado' | 'projetado' | 'previsto_inicial';
export type SyncStatus = 'synced' | 'syncing' | 'offline';

export interface DRETransaction {
  id: string;
  project: string;
  date: string;
  dreLineKey: DRELineKey;
  amount: number;
  originalAmount?: number;
  isEdited?: boolean;
  status: TransactionStatus;
  isAutoForecast?: boolean;
  description?: string;
  sourceFile?: string;
  sourceSheet?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectContract {
  id: string;
  name: string;
  type: 'Terceiros' | 'Interna';
  startDate: string;
  baselineEndDate: string;
  replannedEndDate: string;
  actualEndDate?: string;
  initialMonths: number;
  realMonths: number;
  contractValue: number;
  projectedCostAtCompletion: number;
  resultAtCompletion: number;
  premioEconomia: number;
  bandaPercent: number;
  contractNotes?: string;
  estimatedMonthlyTeamCost: number;
  m2Area?: number;
  orcamentoRasoReajustado?: number;
  projecaoRasoAtual?: number;
  resultadoRasoAtual?: number;
  orcamentoTotalReajustado?: number;
  multaPercent?: number;
  valorMulta?: number;
  clausulaCusto?: string;

  // Estouro contratada
  estouroContratada?: number;

  // Rich Prazo Obras columns
  mesInicial?: number;
  mesCvco?: number;
  mesEntregaUnidades?: number;
  diasAtraso?: number;
  custoEquipeMensal?: number;
  prazoOrcamentoStr?: string;
  custoOrcamentoEquipe?: number;
  pagamentoMultaVal?: number;
  riscoMultaVal?: number;
}

export type TeamCostMode = 'real' | 'estimado';
export type AdmAllocationMode = 'receita' | 'simples';

export interface GlobalFinancialSettings {
  teamCostMode: TeamCostMode;
  admExpensePercent: number;
  admAllocationMode: AdmAllocationMode;
  taxRatePercent: number;
  irpjCsllPercent: number;
}

export interface ImportColumnMapping {
  dateColMode?: 'single' | 'range';
  dateCol?: string;
  startDateCol?: string;
  endDateCol?: string;
  dateHeaderRow?: number;
  amountCol?: string;
  dreLineCol?: string;
  projectCol?: string;
  statusCol?: string;
  descriptionCol?: string;
  lineCategoryMapping?: Record<string, DRELineKey | 'ignore'>;
}

export interface ExcelImportConfig {
  fileName: string;
  sheetName: string;
  startRow: number;
  endRow?: number;
  mapping: ImportColumnMapping;
  preselectedProject?: string;
  preselectedStatus?: TransactionStatus;
  preselectedDRELine?: DRELineKey;
  isMultiSheetTaxaAdm?: boolean;
}

export interface SpreadsheetPreset {
  preset: 'INFORMAÇÕES_PROJETOS' | 'PREVISAO_DRE_OBRAS' | 'RECEITAS_MO_ADM' | 'RECEITAS_TAXA_ADM_BD' | 'CUSTO_MO_POR_PROJETO' | 'CUSTOM_GENERIC';
  mode: 'projects_register' | 'financial_transactions';
  sheetName?: string;
  startRow?: number;
  projectCol?: string;
  dateCol?: string;
  dreLineCol?: string;
  amountCol?: string;
  status?: TransactionStatus;
  presetTitle?: string;
  presetDescription?: string;
  isMultiSheetTaxaAdm?: boolean;
}

export interface MonthlyDREColumn {
  yearMonth: string;
  displayLabel: string;
  isFuture: boolean;
  values: Record<DRELineKey, number>;
  projectBreakdown?: Record<string, Record<DRELineKey, number>>;
}
