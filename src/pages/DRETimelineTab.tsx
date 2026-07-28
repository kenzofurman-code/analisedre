import React, { useState, useMemo } from 'react';
import { MonthlyDREColumn, GlobalFinancialSettings } from '../types/dre';
import { DRE_LINE_DEFINITIONS } from '../constants/dreStructure';
import { DollarSign, TrendingUp, Percent, ChevronLeft, ChevronRight, Calendar, Info, X } from 'lucide-react';

interface DRETimelineTabProps {
  monthlyColumns: MonthlyDREColumn[];
  settings: GlobalFinancialSettings;
  selectedProject: string;
}

export const DRETimelineTab: React.FC<DRETimelineTabProps> = ({ monthlyColumns, settings, selectedProject }) => {
  // Active clicked tooltip state (opens on click)
  const [activeTooltipLineKey, setActiveTooltipLineKey] = useState<string | null>(null);

  // Default view mode: "Todos os Anos" ('all')
  const [viewMode, setViewMode] = useState<'year' | 'all'>('all');

  // Filter out months that have no financial movement at all (grossRev === 0 && costs === 0)
  const activeMonthlyColumns = useMemo(() => {
    return monthlyColumns.filter((col) => {
      const grossRev =
        col.values.receita_taxa_adm +
        col.values.permuta_taxa_adm +
        col.values.receita_mo_adm +
        col.values.receita_assistencia;
      const costs =
        col.values.custos_equipe +
        col.values.custos_deslocamento +
        col.values.estouro_contratada +
        col.values.impostos +
        col.values.despesa_assistencia;
      return grossRev > 0 || costs > 0;
    });
  }, [monthlyColumns]);

  // Extract all unique years available in active dataset
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    activeMonthlyColumns.forEach((col) => {
      if (col.yearMonth) {
        const y = col.yearMonth.slice(0, 4);
        years.add(y);
      }
    });
    return Array.from(years).sort();
  }, [activeMonthlyColumns]);

  // Find first year with non-zero financial movement
  const initialYear = useMemo(() => {
    if (activeMonthlyColumns.length > 0) {
      return activeMonthlyColumns[0].yearMonth.slice(0, 4);
    }
    return availableYears[0] || '2024';
  }, [activeMonthlyColumns, availableYears]);

  const [selectedYear, setSelectedYear] = useState<string>(initialYear);

  // Reset selected year when initialYear changes
  useMemo(() => {
    setSelectedYear(initialYear);
  }, [initialYear]);

  // Filter display columns based on viewMode ('all' vs 'year')
  const displayColumns = useMemo(() => {
    if (viewMode === 'all') {
      return activeMonthlyColumns;
    }
    return activeMonthlyColumns.filter((col) => col.yearMonth.startsWith(selectedYear));
  }, [activeMonthlyColumns, selectedYear, viewMode]);

  // Totals calculation for displayColumns
  const totalReceitaBruta = displayColumns.reduce(
    (acc, col) =>
      acc +
      col.values.receita_taxa_adm +
      col.values.permuta_taxa_adm +
      col.values.receita_mo_adm +
      col.values.receita_assistencia,
    0
  );

  const totalMargemBruta = displayColumns.reduce((acc, col) => acc + col.values.margem_bruta_val, 0);
  const totalResultadoFinal = displayColumns.reduce((acc, col) => acc + col.values.resultado_final, 0);
  const totalMargemLiquidaPct = totalReceitaBruta > 0 ? (totalResultadoFinal / totalReceitaBruta) * 100 : 0;

  const handlePrevYear = () => {
    const currIdx = availableYears.indexOf(selectedYear);
    if (currIdx > 0) {
      setSelectedYear(availableYears[currIdx - 1]);
    }
  };

  const handleNextYear = () => {
    const currIdx = availableYears.indexOf(selectedYear);
    if (currIdx >= 0 && currIdx < availableYears.length - 1) {
      setSelectedYear(availableYears[currIdx + 1]);
    }
  };

  const formatMoney = (val: number) => {
    if (val === 0) return '-';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  };

  const formatPercent = (val: number) => {
    if (isNaN(val)) return '0,00%';
    return `${val.toFixed(2).replace('.', ',')}%`;
  };

  const activeLineDef = useMemo(() => {
    if (!activeTooltipLineKey) return null;
    return DRE_LINE_DEFINITIONS.find((d) => d.key === activeTooltipLineKey);
  }, [activeTooltipLineKey]);

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Receita Bruta Total {viewMode === 'year' ? `(${selectedYear})` : '(Período Ativo)'}
            </p>
            <h3 className="text-xl font-bold text-slate-100 mt-1">{formatMoney(totalReceitaBruta)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">
              Projeto: <strong className="text-blue-400">{selectedProject === 'all' ? 'Global' : selectedProject}</strong>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Margem Bruta {viewMode === 'year' ? `(${selectedYear})` : '(Período Ativo)'}
            </p>
            <h3 className="text-xl font-bold text-emerald-400 mt-1">{formatMoney(totalMargemBruta)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">
              Modo Custo Equipe: <strong className="text-emerald-400 uppercase">{settings.teamCostMode}</strong>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resultado Final Líquido</p>
            <h3 className="text-xl font-bold text-amber-400 mt-1">{formatMoney(totalResultadoFinal)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">
              ADM %: <strong className="text-amber-400">{settings.admExpensePercent}%</strong> ({settings.admAllocationMode})
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-indigo-500">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Margem Líquida %</p>
            <h3 className="text-xl font-bold text-indigo-400 mt-1">{formatPercent(totalMargemLiquidaPct)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Rentabilidade sobre vendas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dynamic Project Timeline Year Slicer */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Visão Temporal do DRE ({displayColumns.length} Meses Ativos)</h3>
            <p className="text-xs text-slate-400">
              A 2ª coluna exibe a <strong>soma acumulada</strong> do período/ano selecionado. Ambas as primeiras colunas permanecem congeladas.
            </p>
          </div>
        </div>

        {/* Year Selector Tabs */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-slate-900 border border-slate-700 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos os Anos
            </button>
            <button
              onClick={() => setViewMode('year')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'year' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Exibir 1 Ano
            </button>
          </div>

          {viewMode === 'year' && (
            <div className="flex items-center space-x-1 bg-slate-900 border border-slate-700 rounded-xl p-1">
              <button
                onClick={handlePrevYear}
                disabled={availableYears.indexOf(selectedYear) <= 0}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Ano Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                aria-label="Selecionar Ano de Análise"
                className="bg-transparent text-xs text-slate-100 font-bold focus:outline-none px-2 cursor-pointer"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr} className="bg-dark-800 text-slate-100">
                    Ano {yr} {yr === initialYear ? '⭐ (Início)' : ''}
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextYear}
                disabled={availableYears.indexOf(selectedYear) >= availableYears.length - 1}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Próximo Ano"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main DRE Matrix Grid with Frozen Headers & Sticky 1st & 2nd Columns */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-280px)] scrollbar-thin">
          <table className="w-full text-xs text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-30 bg-slate-900 text-slate-300 font-bold border-b border-slate-700">
              <tr>
                {/* Frozen Corner Header 1 (Top-Left 1 Sticky) */}
                <th className="sticky top-0 left-0 z-40 bg-slate-900 border-r border-b border-slate-800 px-4 py-3.5 w-72 min-w-[280px] shadow-sm">
                  DADOS (Linhas DRE)
                </th>

                {/* Frozen Corner Header 2 (Top-Left 2 Sticky - TOTAL) */}
                <th className="sticky top-0 left-[280px] z-40 bg-slate-900 border-r-2 border-b border-slate-700 text-right px-4 py-3.5 w-36 min-w-[140px] text-blue-400 font-mono font-bold shadow-sm">
                  {viewMode === 'all' ? 'TOTAL PROJETO' : `TOTAL (${selectedYear})`}
                </th>

                {/* Sticky Month Headers */}
                {displayColumns.map((col) => (
                  <th
                    key={col.yearMonth}
                    className={`sticky top-0 z-30 px-3 py-3.5 text-right min-w-[110px] font-mono border-r border-b border-slate-800/80 ${
                      col.isFuture ? 'bg-amber-950/40 text-amber-300' : 'bg-slate-900 text-slate-200'
                    }`}
                  >
                    <div>{col.displayLabel}</div>
                    {col.isFuture && <div className="text-[9px] font-normal text-amber-500/80">(Previsão)</div>}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/40">
              {DRE_LINE_DEFINITIONS.map((line) => {
                let rowBg = 'hover:bg-slate-800/30';
                let labelStyle = 'text-slate-300 font-medium';
                let valStyle = 'text-slate-300 font-mono';
                let stickyColBg = 'bg-[#0F172A]';

                if (line.key === 'margem_bruta_val') {
                  rowBg = 'bg-emerald-950/20 font-bold border-y border-emerald-500/30';
                  labelStyle = 'text-emerald-400 font-bold uppercase tracking-wider';
                  valStyle = 'text-emerald-400 font-mono font-bold';
                  stickyColBg = 'bg-[#062016]';
                } else if (line.key === 'margem_bruta_pct') {
                  rowBg = 'bg-emerald-950/10 font-semibold';
                  labelStyle = 'text-emerald-300/80 font-semibold pl-4';
                  valStyle = 'text-emerald-300 font-mono';
                  stickyColBg = 'bg-[#041710]';
                } else if (line.key === 'resultado') {
                  rowBg = 'bg-blue-950/20 font-bold border-y border-blue-500/30';
                  labelStyle = 'text-blue-400 font-bold uppercase tracking-wider';
                  valStyle = 'text-blue-400 font-mono font-bold';
                  stickyColBg = 'bg-[#081a33]';
                } else if (line.key === 'resultado_final') {
                  rowBg = 'bg-indigo-950/30 font-bold border-y-2 border-indigo-500/40';
                  labelStyle = 'text-indigo-300 font-bold uppercase tracking-wider';
                  valStyle = 'text-indigo-300 font-mono font-bold';
                  stickyColBg = 'bg-[#0d1733]';
                } else if (line.key === 'margem_liquida_pct') {
                  rowBg = 'bg-indigo-950/10 font-semibold';
                  labelStyle = 'text-indigo-300/80 font-semibold pl-4';
                  valStyle = 'text-indigo-300 font-mono';
                  stickyColBg = 'bg-[#091024]';
                } else if (line.category === 'RECEITA') {
                  labelStyle = 'text-slate-200 font-semibold italic pl-2';
                } else if (line.category === 'DESPESA' || line.category === 'CUSTO') {
                  labelStyle = 'text-slate-400 font-medium pl-4';
                  valStyle = 'text-slate-400 font-mono';
                }

                // Calculate Total for line across displayColumns
                let totalLineVal = 0;
                let formattedTotal = '-';

                if (line.key === 'margem_bruta_pct') {
                  totalLineVal = totalReceitaBruta > 0 ? (totalMargemBruta / totalReceitaBruta) * 100 : 0;
                  formattedTotal = formatPercent(totalLineVal);
                } else if (line.key === 'margem_liquida_pct') {
                  totalLineVal = totalReceitaBruta > 0 ? (totalResultadoFinal / totalReceitaBruta) * 100 : 0;
                  formattedTotal = formatPercent(totalLineVal);
                } else if (line.key === 'curva_fisica_obra') {
                  totalLineVal = displayColumns.length > 0 ? displayColumns.reduce((acc, c) => acc + (c.values.curva_fisica_obra || 0), 0) / displayColumns.length : 0;
                  formattedTotal = formatPercent(totalLineVal);
                } else {
                  totalLineVal = displayColumns.reduce((acc, col) => acc + (col.values[line.key] || 0), 0);
                  formattedTotal = formatMoney(totalLineVal);
                }

                const isActiveClicked = activeTooltipLineKey === line.key;

                return (
                  <tr
                    key={line.key}
                    onClick={() => setActiveTooltipLineKey(isActiveClicked ? null : line.key)}
                    className={`${rowBg} transition-colors cursor-pointer select-none ${
                      isActiveClicked ? 'ring-1 ring-blue-500/50 bg-blue-950/20' : ''
                    }`}
                  >
                    {/* Frozen 1st Column (Sticky Left 0) */}
                    <td
                      className={`sticky left-0 z-20 px-4 py-2.5 border-r border-b border-slate-800 ${stickyColBg} shadow-sm`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-slate-500 italic uppercase w-12">{line.category}</span>
                          <span className={labelStyle}>{line.label}</span>
                        </div>
                        <Info
                          className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                            isActiveClicked ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        />
                      </div>
                    </td>

                    {/* Frozen 2nd Column (Sticky Left 280px - TOTAL ACUMULADO) */}
                    <td
                      className={`sticky left-[280px] z-20 px-4 py-2.5 text-right border-r-2 border-b border-slate-700/80 ${stickyColBg} shadow-sm font-mono font-bold ${
                        line.key.includes('margem') || line.key.includes('resultado') ? 'text-blue-300' : 'text-slate-200'
                      }`}
                    >
                      {formattedTotal}
                    </td>

                    {/* Monthly Values */}
                    {displayColumns.map((col) => {
                      const rawVal = col.values[line.key] || 0;
                      let displayVal = formatMoney(rawVal);

                      if (line.key === 'margem_bruta_pct' || line.key === 'margem_liquida_pct' || line.key === 'curva_fisica_obra') {
                        displayVal = formatPercent(rawVal);
                      }

                      return (
                        <td key={col.yearMonth} className={`px-3 py-2.5 text-right border-r border-b border-slate-800/60 ${valStyle}`}>
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CLICKED POPOVER MODAL (Appears on clicking any DRE area) */}
      {activeLineDef && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-blue-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 relative">
            <button
              onClick={() => setActiveTooltipLineKey(null)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 pb-3 border-b border-slate-800">
              <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-100">{activeLineDef.label}</h4>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold">
                  {activeLineDef.category} • {activeLineDef.isCalculated ? 'Linha Calculada' : 'Lançamento Bruto'}
                </span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Origem / Fonte do Dado:</span>
                <p className="text-slate-200 font-medium">{activeLineDef.sourceOriginInfo}</p>
              </div>

              <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Fórmula Contábil / Regra de Cálculo:</span>
                <p className="text-emerald-300 font-mono font-semibold">{activeLineDef.formulaInfo}</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveTooltipLineKey(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
