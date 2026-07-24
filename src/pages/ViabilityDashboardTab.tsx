import React from 'react';
import { ProjectContract } from '../types/dre';
import { Award, AlertTriangle, Clock, ShieldCheck, DollarSign, Calendar } from 'lucide-react';

interface ViabilityDashboardTabProps {
  projects: ProjectContract[];
  selectedProject: string;
}

export const ViabilityDashboardTab: React.FC<ViabilityDashboardTabProps> = ({ projects, selectedProject }) => {
  const filteredProjects = selectedProject === 'all' ? projects : projects.filter((p) => p.name === selectedProject);

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  // Calculate totals
  const totalContractVal = filteredProjects.reduce((acc, p) => acc + p.contractValue, 0);
  const totalProjectedCost = filteredProjects.reduce((acc, p) => acc + p.projectedCostAtCompletion, 0);
  const totalPremioEconomia = filteredProjects.reduce((acc, p) => acc + p.premioEconomia, 0);
  const totalResult = filteredProjects.reduce((acc, p) => acc + p.resultAtCompletion, 0);

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
          const isEconomy = p.resultAtCompletion > 0;
          const isDelay = p.realMonths > p.initialMonths;
          const delayMonths = p.realMonths - p.initialMonths;

          // Check overflow above PMG + Banda
          const maxAllowedBudget = p.contractValue * (1 + p.bandaPercent);
          const isOverflowAboveBanda = p.projectedCostAtCompletion > maxAllowedBudget;

          return (
            <div key={p.id} className="glass-panel p-6 rounded-2xl space-y-4 border border-slate-800 hover:border-slate-700 transition-all">
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

              {/* Cost & PMG Metrics */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Orçamento Reajustado (PMG)</span>
                  <p className="text-sm font-bold text-slate-200 mt-0.5">{formatMoney(p.contractValue)}</p>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Projeção Custo no Término</span>
                  <p className={`text-sm font-bold mt-0.5 ${isEconomy ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatMoney(p.projectedCostAtCompletion)}
                  </p>
                </div>
              </div>

              {/* Economic Bonus or PMG Overflow Alert */}
              {p.premioEconomia > 0 && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Prêmio Economia Apurado a Receber:</span>
                  </div>
                  <strong className="font-mono text-sm">{formatMoney(p.premioEconomia)}</strong>
                </div>
              )}

              {isOverflowAboveBanda && (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>Custo excede PMG + Banda ({(p.bandaPercent * 100).toFixed(0)}%). Excesso assumido pela Contratada.</span>
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

                {/* Team Cost Impact Calculation */}
                <div className="flex items-center justify-between text-xs pt-1 text-slate-400">
                  <span>Custo Estimado Equipe/Mês:</span>
                  <span className="font-mono text-slate-200">{formatMoney(p.estimatedMonthlyTeamCost)}</span>
                </div>
              </div>

              {/* Contract Notes */}
              {p.contractNotes && (
                <p className="text-[11px] text-slate-500 italic bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
                  "{p.contractNotes}"
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
