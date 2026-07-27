import React from 'react';
import { ProjectContract } from '../types/dre';
import { Award, AlertTriangle, Clock, ShieldCheck, DollarSign, Calendar } from 'lucide-react';

interface ViabilityDashboardTabProps {
  projects: ProjectContract[];
  selectedProject: string;
}

export const ViabilityDashboardTab: React.FC<ViabilityDashboardTabProps> = ({ projects, selectedProject }) => {
  const filteredProjects = selectedProject === 'all' ? projects : projects.filter((p) => p.name === selectedProject);

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  };

  // Calculate totals
  const totalContractVal = filteredProjects.reduce((acc, p) => acc + (p.contractValue || 0), 0);
  const totalProjectedCost = filteredProjects.reduce((acc, p) => acc + (p.projectedCostAtCompletion || 0), 0);
  const totalPremioEconomia = filteredProjects.reduce((acc, p) => acc + (p.premioEconomia || 0), 0);
  const totalResult = filteredProjects.reduce((acc, p) => acc + (p.resultAtCompletion || 0), 0);

  // Helper Renderer for 4 Specific Cost Lines requested by user
  const render4CostLines = (p: ProjectContract) => {
    // Line 1: Orçamento Raso (Reajustado vs Projeção Atual)
    const baseRaso = p.orcamentoRasoReajustado || 0;
    const projRaso = p.projecaoRasoAtual !== undefined ? p.projecaoRasoAtual : baseRaso;
    const hasRasoDiff = baseRaso > 0 && Math.abs(projRaso - baseRaso) > 0.01;
    const isRasoIncrease = projRaso > baseRaso;

    // Line 2: Resultado Raso
    const resultRaso = p.resultadoRasoAtual !== undefined ? p.resultadoRasoAtual : (baseRaso - projRaso);

    // Line 3: Custo Total (Reajustado vs Projeção Total)
    const baseTotal = p.orcamentoTotalReajustado || p.contractValue || 0;
    const projTotal = p.projectedCostAtCompletion !== undefined ? p.projectedCostAtCompletion : baseTotal;
    const hasTotalDiff = baseTotal > 0 && Math.abs(projTotal - baseTotal) > 0.01;
    const isTotalIncrease = projTotal > baseTotal;

    // Line 4: Resultado Total
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
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Painel de Viabilidade x Realizado & Gestão de Contratos</h3>
          <p className="text-xs text-slate-400">
            Análise de Preço Máximo Garantido (PMG), Prêmio Economia, Prazos Reais e Risco de Multas
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Prêmio Economia</span>
            <p className="text-sm font-bold text-emerald-400">{formatMoney(totalPremioEconomia)}</p>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 px-4 py-2 rounded-xl text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400">Resultado Acumulado no Término</span>
            <p className={`text-sm font-bold ${totalResult >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
              {formatMoney(totalResult)}
            </p>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredProjects.map((p) => {
          const isEconomy = (p.resultAtCompletion || 0) > 0;
          const isDelay = (p.realMonths || 0) > (p.initialMonths || 0);
          const delayMonths = (p.realMonths || 0) - (p.initialMonths || 0);

          const maxAllowedBudget = (p.contractValue || 0) * (1 + (p.bandaPercent || 0));
          const isOverflowAboveBanda = (p.projectedCostAtCompletion || 0) > maxAllowedBudget;

          return (
            <div key={p.id || p.name} className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800 hover:border-slate-700 transition-all">
              {/* Project Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100">{p.name}</h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Contrato: <strong className="text-slate-200">{p.type}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isEconomy ? (
                    <span className="flex items-center space-x-1 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                      <Award className="w-3.5 h-3.5" />
                      <span>Economia / Bônus</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Acima do Orçamento</span>
                    </span>
                  )}
                </div>
              </div>

              {/* RENDER THE 4 SPECIFIC COST LINES REQUESTED BY USER */}
              {render4CostLines(p)}

              {/* Economic Bonus or PMG Overflow Alert */}
              {p.premioEconomia && p.premioEconomia > 0 ? (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Prêmio Economia Apurado a Receber:</span>
                  </div>
                  <strong className="font-mono text-sm">{formatMoney(p.premioEconomia)}</strong>
                </div>
              ) : null}

              {isOverflowAboveBanda && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Custo excede PMG + Banda ({((p.bandaPercent || 0) * 100).toFixed(0)}%). Excesso assumido pela Contratada.</span>
                  </div>
                </div>
              )}

              {/* Timeline & Schedule Analysis */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Duração Prevista x Real:</span>
                  </span>
                  <span className="font-semibold text-slate-200">
                    {p.initialMonths} meses (Base) ➔ <strong className="text-amber-400">{p.realMonths} meses (Real)</strong>
                  </span>
                </div>

                {isDelay ? (
                  <div className="text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-center justify-between">
                    <span>Atraso acumulado de <strong>+{delayMonths} meses</strong> em relação ao contrato base.</span>
                    <span className="text-[10px] uppercase font-bold text-amber-300">Risco Multa Atraso</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl flex items-center justify-between">
                    <span>Obra dentro do cronograma contratual previsto.</span>
                    <span className="text-[10px] uppercase font-bold text-emerald-300">Sem Atraso</span>
                  </div>
                )}
              </div>

              {/* Contract Notes */}
              {p.clausulaCusto && (
                <p className="text-[11px] text-slate-400 italic bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
                  💡 <strong>Cláusula Custo:</strong> "{p.clausulaCusto}"
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
