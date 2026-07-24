import React, { useMemo } from 'react';
import { DRETransaction, GlobalFinancialSettings, ProjectContract } from '../types/dre';
import { calculateMonthlyDRE } from '../services/dreCalculator';
import { DRE_LINE_DEFINITIONS } from '../constants/dreStructure';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GitCompare, TrendingUp, DollarSign, Award } from 'lucide-react';

interface ProjectComparisonTabProps {
  projects: ProjectContract[];
  transactions: DRETransaction[];
  settings: GlobalFinancialSettings;
}

export const ProjectComparisonTab: React.FC<ProjectComparisonTabProps> = ({ projects, transactions, settings }) => {
  const comparisonData = useMemo(() => {
    return projects.map((p) => {
      const pCols = calculateMonthlyDRE(transactions, projects, settings, p.name, 'all');

      let totalGrossRev = 0;
      let totalDirectCosts = 0;
      let totalADM = 0;
      let totalNetResult = 0;

      pCols.forEach((col) => {
        const grossRev =
          col.values.receita_taxa_adm +
          col.values.permuta_taxa_adm +
          col.values.receita_mo_adm +
          col.values.receita_assistencia;

        const directCosts =
          col.values.impostos +
          col.values.despesa_assistencia +
          col.values.custos_equipe +
          col.values.custos_deslocamento;

        totalGrossRev += grossRev;
        totalDirectCosts += directCosts;
        totalADM += col.values.despesas_adm_pie;
        totalNetResult += col.values.resultado_final;
      });

      const grossMarginPct = totalGrossRev > 0 ? ((totalGrossRev - totalDirectCosts) / totalGrossRev) * 100 : 0;
      const netMarginPct = totalGrossRev > 0 ? (totalNetResult / totalGrossRev) * 100 : 0;

      return {
        projectName: p.name,
        contractValue: p.contractValue,
        grossRevenue: totalGrossRev,
        directCosts: totalDirectCosts,
        admExpenses: totalADM,
        netResult: totalNetResult,
        grossMarginPct,
        netMarginPct,
      };
    });
  }, [projects, transactions, settings]);

  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Info */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <GitCompare className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Matriz Comparativa de Performance entre Obras</h3>
            <p className="text-xs text-slate-400">Análise lado a lado de receitas, custos diretos, rateio ADM e margem líquida</p>
          </div>
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h4 className="text-sm font-bold text-slate-200">Comparativo de Receitas vs Custos Diretos vs Resultado Líquido</h4>
        <div className="h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="projectName" stroke="#94A3B8" fontSize={12} />
              <YAxis stroke="#94A3B8" fontSize={11} tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val: any) => formatMoney(Number(val || 0))}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="grossRevenue" name="Receita Bruta (R$)" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="directCosts" name="Custos Diretos (R$)" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="netResult" name="Resultado Líquido (R$)" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Side-by-side Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-700">
              <tr>
                <th className="px-4 py-3.5 bg-slate-900 border-r border-slate-800">INDICADOR / CONTA DRE</th>
                {comparisonData.map((d) => (
                  <th key={d.projectName} className="px-4 py-3.5 text-right font-bold text-blue-400 border-r border-slate-800">
                    {d.projectName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-bold text-slate-200">
                  Valor Total do Contrato Obra
                </td>
                {comparisonData.map((d) => (
                  <td key={d.projectName} className="px-4 py-3 text-right font-mono font-bold text-slate-300 border-r border-slate-800">
                    {formatMoney(d.contractValue)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-bold text-emerald-400">
                  Receita Bruta Total Gerada
                </td>
                {comparisonData.map((d) => (
                  <td key={d.projectName} className="px-4 py-3 text-right font-mono font-bold text-emerald-400 border-r border-slate-800">
                    {formatMoney(d.grossRevenue)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-semibold text-rose-400 pl-6">
                  Custos e Impostos Diretos
                </td>
                {comparisonData.map((d) => (
                  <td key={d.projectName} className="px-4 py-3 text-right font-mono text-rose-400 border-r border-slate-800">
                    {formatMoney(d.directCosts)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-semibold text-amber-400 pl-6">
                  Rateio Despesas ADM (Sede)
                </td>
                {comparisonData.map((d) => (
                  <td key={d.projectName} className="px-4 py-3 text-right font-mono text-amber-400 border-r border-slate-800">
                    {formatMoney(d.admExpenses)}
                  </td>
                ))}
              </tr>

              <tr className="bg-blue-950/20 border-y border-blue-500/30 font-bold">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-bold text-blue-300">
                  Margem Bruta (%)
                </td>
                {comparisonData.map((d) => (
                  <td key={d.projectName} className="px-4 py-3 text-right font-mono font-bold text-blue-300 border-r border-slate-800">
                    {d.grossMarginPct.toFixed(2)}%
                  </td>
                ))}
              </tr>

              <tr className="bg-indigo-950/30 border-y-2 border-indigo-500/40 font-bold">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-bold text-indigo-300">
                  Resultado Líquido Final (R$)
                </td>
                {comparisonData.map((d) => (
                  <td
                    key={d.projectName}
                    className={`px-4 py-3 text-right font-mono font-bold border-r border-slate-800 ${
                      d.netResult >= 0 ? 'text-indigo-300' : 'text-rose-400'
                    }`}
                  >
                    {formatMoney(d.netResult)}
                  </td>
                ))}
              </tr>

              <tr className="bg-purple-950/20 font-bold">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-bold text-purple-300">
                  Margem Líquida (%)
                </td>
                {comparisonData.map((d) => (
                  <td
                    key={d.projectName}
                    className={`px-4 py-3 text-right font-mono font-bold border-r border-slate-800 ${
                      d.netMarginPct >= 0 ? 'text-purple-300' : 'text-rose-400'
                    }`}
                  >
                    {d.netMarginPct.toFixed(2)}%
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
