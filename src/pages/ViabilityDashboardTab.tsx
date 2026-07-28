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

  // Helper Renderer for Deadline & Team Cost Analysis (4 Lines + Penalty Alert)
  const renderDeadlineAndTeamCostSection = (p: ProjectContract) => {
    const mesInicial = p.mesInicial || p.initialMonths || 24;
    const mesCvco = p.mesCvco || 0;
    const mesEntrega = p.mesEntregaUnidades || 0;
    const maxDurationMonths = Math.max(mesInicial, mesCvco, mesEntrega);

    const hasDurationDiff = maxDurationMonths > mesInicial;

    const custoMensal = p.custoEquipeMensal || p.estimatedMonthlyTeamCost || 28000;
    const prazoOrcStr = p.prazoOrcamentoStr || `${mesInicial}`;
    const prazoOrcNum = parseFloat(prazoOrcStr.split('/')[0]) || mesInicial;
    const custoOrcEquipe = p.custoOrcamentoEquipe || (prazoOrcNum * custoMensal);

    const custoEstEquipe = maxDurationMonths * custoMensal;
    const varCustoEquipe = custoEstEquipe - custoOrcEquipe;
    const isEquipeIncrease = varCustoEquipe > 0.01;

    const riscoMulta = p.riscoMultaVal || p.valorMulta || 0;

    return (
      <div className="space-y-3 pt-3 border-t border-slate-800">
        <div className="flex items-center space-x-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
          <Clock className="w-4 h-4 text-indigo-400" />
          <span>Análise de Prazos & Custo de Equipe</span>
        </div>

        <div className="space-y-2 text-[11px] bg-slate-900/80 p-3 rounded-xl border border-slate-800">
          {/* Linha 1: Duração do Projeto */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-slate-400 font-semibold">1. Duração do projeto:</span>
            <div className="font-mono font-bold flex items-center space-x-1.5">
              <span className="text-slate-300">{mesInicial} meses</span>
              {hasDurationDiff && (
                <>
                  <span className="text-slate-500">➡️</span>
                  <span className="text-amber-400">{maxDurationMonths} meses</span>
                  <span title="Atraso na duração total do projeto">🔺</span>
                </>
              )}
            </div>
          </div>

          {/* Linha 2: Custo Equipe Orçamento */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
            <span className="text-slate-400 font-semibold">2. Custo equipe orçamento:</span>
            <div className="font-mono font-bold flex items-center space-x-1 text-slate-300 text-[10.5px]">
              <span>{prazoOrcStr}m</span>
              <span className="text-slate-500">➡️</span>
              <span>{formatMoney(custoMensal)}/m</span>
              <span className="text-slate-500">➡️</span>
              <span className="text-slate-200">{formatMoney(custoOrcEquipe)}</span>
            </div>
          </div>

          {/* Linha 3: Custo Estimado */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
            <span className="text-slate-400 font-semibold">3. Custo estimado:</span>
            <div className="font-mono font-bold flex items-center space-x-1 text-amber-300 text-[10.5px]">
              <span>{maxDurationMonths}m</span>
              <span className="text-slate-500">➡️</span>
              <span>{formatMoney(custoMensal)}/m</span>
              <span className="text-slate-500">➡️</span>
              <span>{formatMoney(custoEstEquipe)}</span>
            </div>
          </div>

          {/* Linha 4: Variação Custo Equipe */}
          <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
            <span className="text-slate-400 font-semibold">4. Variação custo equipe:</span>
            <div className="font-mono font-bold flex items-center space-x-1">
              <span className={isEquipeIncrease ? 'text-rose-400' : 'text-emerald-400'}>
                {varCustoEquipe >= 0 ? `+${formatMoney(varCustoEquipe)}` : formatMoney(varCustoEquipe)}
              </span>
              {Math.abs(varCustoEquipe) > 0.01 && (
                <span>{isEquipeIncrease ? '🔺' : '🔻'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Resumo de Multa */}
        {riscoMulta > 0 ? (
          <div className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/40 p-2.5 rounded-xl flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span><strong>Risco de multa no valor de {formatMoney(riscoMulta)}</strong></span>
          </div>
        ) : (
          <div className="text-[11px] text-blue-300 bg-blue-950/40 border border-blue-500/40 p-2.5 rounded-xl flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>Acordo feito sem pagamento de multa de prazo</span>
          </div>
        )}
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

              {/* SEÇÃO 1: CUSTOS DO PROJETO (AS 4 LINHAS DE CUSTO DA VIABILIDADE + CLÁUSULA) */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-xs font-bold text-blue-400 uppercase tracking-wider">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span>Análise de Custos & Orçamento Raso</span>
                </div>
                {render4CostLines(p)}
              </div>

              {p.clausulaCusto && (
                <p className="text-[11px] text-slate-400 italic bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
                  💡 <strong>Cláusula Custo:</strong> "{p.clausulaCusto}"
                </p>
              )}

              {/* SEÇÃO 2: ANÁLISE DE PRAZOS & CUSTO DE EQUIPE (AS 4 NOVAS LINHAS DE PRAZO/EQUIPE + RESUMO DE MULTA) */}
              {renderDeadlineAndTeamCostSection(p)}

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
            </div>
          );
        })}
      </div>
    </div>
  );
};
