import {
  DRELineKey,
  DRETransaction,
  GlobalFinancialSettings,
  MonthlyDREColumn,
  ProjectContract,
} from '../types/dre';
import { parseExcelDateYM } from '../utils/excelParser';

export function getProjectTimelineMonths(p: ProjectContract): { startYM: string; endYM: string; maxMonths: number } {
  if (!p.startDate) return { startYM: '2023-01', endYM: '2025-12', maxMonths: 24 };

  const parsed = parseExcelDateYM(p.startDate, 2024);
  const startYM = parsed.ym;
  let y = parsed.year;
  let m = parsed.month;

  const mesD = p.mesInicial || p.initialMonths || 0;
  const mesE = p.mesCvco || 0;
  const mesG = p.mesEntregaUnidades || 0;
  const maxMonths = Math.max(mesD, mesE, mesG) || p.realMonths || p.initialMonths || 24;

  let endY = y;
  let endM = m + maxMonths - 1;
  while (endM > 12) {
    endM -= 12;
    endY += 1;
  }

  const endYM = `${endY}-${String(endM).padStart(2, '0')}`;
  return { startYM, endYM, maxMonths };
}

export function calculateMonthlyDRE(
  transactions: DRETransaction[],
  projects: ProjectContract[],
  settings: GlobalFinancialSettings,
  selectedProjects: string[] = ['all'],
  statusFilter: 'all' | 'realizado' | 'projetado' | 'previsto_inicial' = 'all'
): MonthlyDREColumn[] {
  const isGlobal = selectedProjects.includes('all') || selectedProjects.length === 0;
  const selectedProjectsLower = selectedProjects.map((p) => p.toLowerCase().trim());

  // 1. Filter transactions by selected projects array (case-insensitive) and status
  const filtered = transactions.filter((t) => {
    if (!isGlobal && t.project) {
      const tProjLower = t.project.toLowerCase().trim();
      if (!selectedProjectsLower.includes(tProjLower)) return false;
    }

    if (statusFilter === 'all') {
      if (t.status === 'previsto_inicial') return false; // Viabilidade base is separate
    } else if (statusFilter !== t.status) {
      return false;
    }
    return true;
  });

  // 2. Collect all unique YYYY-MM months strictly across transactions & project timelines (startYM to endYM)
  const monthSet = new Set<string>();
  filtered.forEach((t) => {
    if (t.date) monthSet.add(t.date);
  });

  const activeProjectsList = isGlobal
    ? projects
    : projects.filter((p) => selectedProjectsLower.includes(p.name.toLowerCase().trim()));

  activeProjectsList.forEach((p) => {
    const { startYM, endYM } = getProjectTimelineMonths(p);
    let curr = startYM;
    let count = 0;
    while (curr <= endYM && count < 120) {
      monthSet.add(curr);
      const [y, m] = curr.split('-').map(Number);
      const nextDate = new Date(y, m, 1);
      curr = nextDate.toISOString().slice(0, 7);
      count++;
    }
  });

  const sortedMonths = Array.from(monthSet).sort();
  if (sortedMonths.length === 0) {
    const now = new Date();
    for (let i = -6; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      sortedMonths.push(d.toISOString().slice(0, 7));
    }
  }

  const currentDateStr = new Date().toISOString().slice(0, 7);

  // 3. Pre-calculate Global Monthly Revenue for ADM Rateio (Case-insensitive project lookup)
  const globalMonthlyRevenue: Record<string, number> = {};
  const globalProjectRevenue: Record<string, Record<string, number>> = {};
  const globalActiveProjectsInMonth: Record<string, Set<string>> = {};

  sortedMonths.forEach((ym) => {
    globalMonthlyRevenue[ym] = 0;
    globalProjectRevenue[ym] = {};
    globalActiveProjectsInMonth[ym] = new Set<string>();
  });

  transactions.forEach((t) => {
    if (t.status !== 'previsto_inicial' && t.date && globalMonthlyRevenue[t.date] !== undefined) {
      if (
        t.dreLineKey === 'receita_taxa_adm' ||
        t.dreLineKey === 'permuta_taxa_adm' ||
        t.dreLineKey === 'receita_mo_adm' ||
        t.dreLineKey === 'receita_assistencia'
      ) {
        globalMonthlyRevenue[t.date] += t.amount;

        // Match canonical project name from projects list
        const matchedProject = projects.find(
          (p) => p.name.toLowerCase().trim() === t.project.toLowerCase().trim()
        );
        const projKey = matchedProject ? matchedProject.name : t.project.trim();

        if (!globalProjectRevenue[t.date][projKey]) {
          globalProjectRevenue[t.date][projKey] = 0;
        }
        globalProjectRevenue[t.date][projKey] += t.amount;
        globalActiveProjectsInMonth[t.date].add(projKey);
      }
    }
  });

  projects.forEach((p) => {
    const { startYM, endYM } = getProjectTimelineMonths(p);
    sortedMonths.forEach((ym) => {
      if (ym >= startYM && ym <= endYM) {
        if (!globalActiveProjectsInMonth[ym]) globalActiveProjectsInMonth[ym] = new Set();
        globalActiveProjectsInMonth[ym].add(p.name);
      }
    });
  });

  // 4. Build monthly DRE columns reading strictly from DRE transactions in the database
  const monthlyColumns: MonthlyDREColumn[] = sortedMonths.map((ym) => {
    const isFuture = ym > currentDateStr;
    const values: Record<DRELineKey, number> = {
      receita_taxa_adm: 0,
      permuta_taxa_adm: 0,
      receita_mo_adm: 0,
      receita_assistencia: 0,
      impostos: 0,
      despesa_assistencia: 0,
      custos_equipe: 0,
      custos_deslocamento: 0,
      estouro_contratada: 0,
      margem_bruta_val: 0,
      margem_bruta_pct: 0,
      despesas_adm_pie: 0,
      resultado: 0,
      irpj_csll: 0,
      resultado_final: 0,
      margem_liquida_pct: 0,
      receita_liquida: 0,
      curva_fisica_obra: 0,
      receitas_menos_impostos: 0,
    };

    const monthTx = filtered.filter((t) => t.date === ym);

    let grossRevenueTerceiros = 0;
    let grossRevenueInterna = 0;
    let taxableRevenueTerceiros = 0;

    monthTx.forEach((t) => {
      // Find matching project type
      const matchedProj = projects.find(
        (p) => p.name.toLowerCase().trim() === t.project.toLowerCase().trim()
      );
      const isInterna = matchedProj?.type === 'Interna';

      // Zero out taxes for Interna projects
      if (isInterna && (t.dreLineKey === 'impostos' || t.dreLineKey === 'irpj_csll')) {
        return;
      }

      if (t.dreLineKey in values && t.dreLineKey !== 'custos_equipe') {
        values[t.dreLineKey] += t.amount;
      }

      if (
        t.dreLineKey === 'receita_taxa_adm' ||
        t.dreLineKey === 'permuta_taxa_adm' ||
        t.dreLineKey === 'receita_mo_adm' ||
        t.dreLineKey === 'receita_assistencia'
      ) {
        if (isInterna) {
          grossRevenueInterna += t.amount;
        } else {
          grossRevenueTerceiros += t.amount;
          if (t.dreLineKey !== 'receita_assistencia') {
            taxableRevenueTerceiros += t.amount;
          }
        }
      }
    });

    // Team Cost Calculation reading STRICTLY from DRE transactions in database with unified max(mesD, mesE, mesG)
    let computedTeamCostMonth = 0;

    activeProjectsList.forEach((p) => {
      const projTx = monthTx.filter(
        (t) =>
          t.project &&
          t.project.toLowerCase().trim() === p.name.toLowerCase().trim() &&
          t.dreLineKey === 'custos_equipe'
      );

      if (settings.teamCostMode === 'estimado') {
        // Mode 1: Sum estimated team cost transactions present in database for month ym
        const estSum = projTx
          .filter((t) => t.id.startsWith('est-team-') || t.sourceFile === 'INFORMAÇÕES_PROJETOS.xlsx')
          .reduce((acc, t) => acc + t.amount, 0);
        computedTeamCostMonth += estSum;
      } else {
        // Mode 2: Real Team Cost with Fallback to Estimated transaction in database
        const realSum = projTx
          .filter((t) => !t.id.startsWith('est-team-') && t.sourceFile !== 'INFORMAÇÕES_PROJETOS.xlsx')
          .reduce((acc, t) => acc + t.amount, 0);

        if (realSum > 0) {
          computedTeamCostMonth += realSum;
        } else {
          const estSum = projTx
            .filter((t) => t.id.startsWith('est-team-') || t.sourceFile === 'INFORMAÇÕES_PROJETOS.xlsx')
            .reduce((acc, t) => acc + t.amount, 0);
          computedTeamCostMonth += estSum;
        }
      }
    });

    values.custos_equipe = computedTeamCostMonth;

    const grossRevenue = grossRevenueTerceiros + grossRevenueInterna;

    // Impostos (PIS, COFINS, ISS) calculados EXCLUSIVAMENTE para Obras de Terceiros e EXCLUINDO receita de assistência técnica
    if (values.impostos === 0 && taxableRevenueTerceiros > 0) {
      values.impostos = taxableRevenueTerceiros * (settings.taxRatePercent / 100);
    }

    // ADM Expense Rateio Calculation
    const globalRevMonth = globalMonthlyRevenue[ym] || 0;
    const globalTotalADM = globalRevMonth * (settings.admExpensePercent / 100);

    if (isGlobal) {
      values.despesas_adm_pie = grossRevenue * (settings.admExpensePercent / 100);
    } else {
      const activeCount = globalActiveProjectsInMonth[ym]?.size || 1;
      let totalAllocatedADM = 0;

      activeProjectsList.forEach((p) => {
        const projRev = globalProjectRevenue[ym]?.[p.name] || 0;
        if (settings.admAllocationMode === 'receita') {
          if (globalRevMonth > 0) {
            totalAllocatedADM += globalTotalADM * (projRev / globalRevMonth);
          } else {
            totalAllocatedADM += globalTotalADM / Math.max(1, activeCount);
          }
        } else {
          totalAllocatedADM += globalTotalADM / Math.max(1, activeCount);
        }
      });

      values.despesas_adm_pie = totalAllocatedADM;
    }

    const totalDirectExpensesCosts =
      values.impostos +
      values.despesa_assistencia +
      values.custos_equipe +
      values.custos_deslocamento +
      values.estouro_contratada;

    values.margem_bruta_val = grossRevenue - totalDirectExpensesCosts;
    values.margem_bruta_pct = grossRevenue > 0 ? (values.margem_bruta_val / grossRevenue) * 100 : 0;

    values.resultado = values.margem_bruta_val - values.despesas_adm_pie;

    // IRPJ + CSLL calculados EXCLUSIVAMENTE para Obras de Terceiros e EXCLUINDO receita de assistência técnica
    if (values.irpj_csll === 0 && taxableRevenueTerceiros > 0) {
      values.irpj_csll = taxableRevenueTerceiros * (settings.irpjCsllPercent / 100);
    }

    values.resultado_final = values.resultado - values.irpj_csll;
    values.margem_liquida_pct = grossRevenue > 0 ? (values.resultado_final / grossRevenue) * 100 : 0;

    values.receita_liquida = grossRevenue - values.impostos;
    values.receitas_menos_impostos = values.receita_liquida;

    const [year, month] = ym.split('-');
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const displayLabel = `${monthNames[parseInt(month, 10) - 1]}/${year.slice(2)}`;

    return {
      yearMonth: ym,
      displayLabel,
      isFuture,
      values,
    };
  });

  return monthlyColumns;
}
