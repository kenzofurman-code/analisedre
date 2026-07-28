import {
  DRELineKey,
  DRETransaction,
  GlobalFinancialSettings,
  MonthlyDREColumn,
  ProjectContract,
} from '../types/dre';

export function calculateMonthlyDRE(
  transactions: DRETransaction[],
  projects: ProjectContract[],
  settings: GlobalFinancialSettings,
  selectedProject: string = 'all',
  statusFilter: 'all' | 'realizado' | 'projetado' | 'previsto_inicial' = 'all'
): MonthlyDREColumn[] {
  // 1. Filter transactions by project and status
  const filtered = transactions.filter((t) => {
    if (selectedProject !== 'all' && t.project !== selectedProject) return false;

    if (statusFilter === 'all') {
      if (t.status === 'previsto_inicial') return false; // Viabilidade base is separate
    } else if (statusFilter !== t.status) {
      return false;
    }
    return true;
  });

  // 2. Collect all unique YYYY-MM months across transactions & project timelines
  const monthSet = new Set<string>();
  filtered.forEach((t) => {
    if (t.date) monthSet.add(t.date);
  });

  projects.forEach((p) => {
    if (p.startDate) {
      const start = p.startDate.slice(0, 7);
      const end = (p.actualEndDate || p.replannedEndDate || p.baselineEndDate).slice(0, 7);
      let curr = start;
      let count = 0;
      while (curr <= end && count < 120) {
        monthSet.add(curr);
        const [y, m] = curr.split('-').map(Number);
        const nextDate = new Date(y, m, 1);
        curr = nextDate.toISOString().slice(0, 7);
        count++;
      }
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

  // 3. Pre-calculate Global Monthly Revenue for ADM Rateio
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
        if (!globalProjectRevenue[t.date][t.project]) {
          globalProjectRevenue[t.date][t.project] = 0;
        }
        globalProjectRevenue[t.date][t.project] += t.amount;
        globalActiveProjectsInMonth[t.date].add(t.project);
      }
    }
  });

  projects.forEach((p) => {
    const start = p.startDate ? p.startDate.slice(0, 7) : '2023-01';
    const end = (p.actualEndDate || p.replannedEndDate || p.baselineEndDate || '2027-12').slice(0, 7);
    sortedMonths.forEach((ym) => {
      if (ym >= start && ym <= end) {
        if (!globalActiveProjectsInMonth[ym]) globalActiveProjectsInMonth[ym] = new Set();
        globalActiveProjectsInMonth[ym].add(p.name);
      }
    });
  });

  // 4. Build monthly DRE columns
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
    monthTx.forEach((t) => {
      if (t.dreLineKey in values) {
        values[t.dreLineKey] += t.amount;
      }
    });

    // Team Cost Mode switch
    if (settings.teamCostMode === 'estimado') {
      let estimatedTeamCostMonth = 0;
      const relevantProjects = selectedProject === 'all' ? projects : projects.filter((p) => p.name === selectedProject);

      relevantProjects.forEach((p) => {
        const start = p.startDate ? p.startDate.slice(0, 7) : '';
        const end = (p.actualEndDate || p.replannedEndDate || p.baselineEndDate || '').slice(0, 7);
        if (start && end && ym >= start && ym <= end) {
          estimatedTeamCostMonth += p.estimatedMonthlyTeamCost || 28000;
        }
      });
      values.custos_equipe = estimatedTeamCostMonth;
    }

    const grossRevenue =
      values.receita_taxa_adm + values.permuta_taxa_adm + values.receita_mo_adm + values.receita_assistencia;

    // FALLBACK FORMULA 1: Impostos sobre Faturamento (PIS + COFINS + ISS)
    if (values.impostos === 0 && grossRevenue > 0) {
      values.impostos = grossRevenue * (settings.taxRatePercent / 100);
    }

    // ADM Expense Rateio Calculation
    const globalRevMonth = globalMonthlyRevenue[ym] || 0;
    const globalTotalADM = globalRevMonth * (settings.admExpensePercent / 100);

    if (selectedProject === 'all') {
      values.despesas_adm_pie = grossRevenue * (settings.admExpensePercent / 100);
    } else {
      const activeCount = globalActiveProjectsInMonth[ym]?.size || 1;
      const projRev = globalProjectRevenue[ym]?.[selectedProject] || 0;

      if (settings.admAllocationMode === 'receita') {
        if (globalRevMonth > 0) {
          values.despesas_adm_pie = globalTotalADM * (projRev / globalRevMonth);
        } else {
          values.despesas_adm_pie = globalTotalADM / Math.max(1, activeCount);
        }
      } else {
        values.despesas_adm_pie = globalTotalADM / Math.max(1, activeCount);
      }
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

    // FALLBACK FORMULA 2: IRPJ + CSLL
    if (values.irpj_csll === 0 && values.resultado > 0) {
      values.irpj_csll = values.resultado * (settings.irpjCsllPercent / 100);
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
