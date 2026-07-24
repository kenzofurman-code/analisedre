import React, { useState } from 'react';
import { DRETransaction, GlobalFinancialSettings, ProjectContract } from '../types/dre';
import { calculateMonthlyDRE } from '../services/dreCalculator';
import { DRE_LINE_DEFINITIONS } from '../constants/dreStructure';
import { Columns3, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface ProjectComparisonTabProps {
  projects: ProjectContract[];
  transactions: DRETransaction[];
  settings: GlobalFinancialSettings;
}

export const ProjectComparisonTab: React.FC<ProjectComparisonTabProps> = ({ projects, transactions, settings }) => {
  const [selectedProjects, setSelectedProjects] = useState<string[]>(projects.slice(0, 5).map((p) => p.name));

  const toggleProject = (name: string) => {
    if (selectedProjects.includes(name)) {
      if (selectedProjects.length > 1) {
        setSelectedProjects(selectedProjects.filter((p) => p !== name));
      }
    } else {
      setSelectedProjects([...selectedProjects, name]);
    }
  };

  // Compute aggregated DRE for each selected project
  const projectSummaries = selectedProjects.map((pName) => {
    const cols = calculateMonthlyDRE(transactions, projects, settings, pName, 'all');

    const totalReceita = cols.reduce(
      (acc, c) =>
        acc +
        c.values.receita_taxa_adm +
        c.values.permuta_taxa_adm +
        c.values.receita_mo_adm +
        c.values.receita_assistencia,
      0
    );

    const totalMargemBruta = cols.reduce((acc, c) => acc + c.values.margem_bruta_val, 0);
    const totalCustosEquipe = cols.reduce((acc, c) => acc + c.values.custos_equipe, 0);
    const totalDespesasAdm = cols.reduce((acc, c) => acc + c.values.despesas_adm_pie, 0);
    const totalResultadoFinal = cols.reduce((acc, c) => acc + c.values.resultado_final, 0);
    const margemLiquidaPct = totalReceita > 0 ? (totalResultadoFinal / totalReceita) * 100 : 0;
    const margemBrutaPct = totalReceita > 0 ? (totalMargemBruta / totalReceita) * 100 : 0;

    return {
      projectName: pName,
      ReceitaBruta: totalReceita,
      CustosEquipe: totalCustosEquipe,
      MargemBruta: totalMargemBruta,
      MargemBrutaPct: margemBrutaPct,
      DespesasAdm: totalDespesasAdm,
      ResultadoFinal: totalResultadoFinal,
      MargemLiquidaPct: margemLiquidaPct,
    };
  });

  const formatMoney = (val: number) =>
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Project Multi-Selector Bar */}
      <div className="glass-panel p-5 rounded-2xl space-y-3">
        <div className="flex items-center space-x-2">
          <Columns3 className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-bold text-slate-100">Comparativo de DRE Entre Projetos</h3>
        </div>
        <p className="text-xs text-slate-400">Selecione as obras que deseja comparar lado a lado:</p>

        <div className="flex flex-wrap gap-2 pt-1">
          {projects.map((p) => {
            const isSelected = selectedProjects.includes(p.name);
            return (
              <button
                key={p.id}
                onClick={() => toggleProject(p.name)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {isSelected ? '✓ ' : ''}
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side-by-Side Chart */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center space-x-2">
          <BarChart2 className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-bold text-slate-200">Comparação Gráfica de Receita e Margem Bruta por Obra</h4>
        </div>

        <div className="h-[350px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={projectSummaries} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" />
              <XAxis dataKey="projectName" stroke="#9CA3AF" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 11 }} tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val: number) => formatMoney(val)}
              />
              <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
              <Bar dataKey="ReceitaBruta" name="Receita Bruta" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="MargemBruta" name="Margem Bruta R$" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ResultadoFinal" name="Resultado Final" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparative Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5 w-64 bg-slate-900 border-r border-slate-800">Métrica DRE / Indicador</th>
                {projectSummaries.map((p) => (
                  <th key={p.projectName} className="px-4 py-3.5 text-right min-w-[140px] font-mono border-r border-slate-800">
                    <div className="text-blue-400 font-bold">{p.projectName}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <tr>
                <td className="px-4 py-2.5 font-semibold text-slate-200 border-r border-slate-800">Receita Bruta Acumulada</td>
                {projectSummaries.map((p) => (
                  <td key={p.projectName} className="px-4 py-2.5 text-right font-mono text-slate-200 border-r border-slate-800">
                    {formatMoney(p.ReceitaBruta)}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="px-4 py-2.5 font-medium text-slate-400 border-r border-slate-800 pl-6">Custos de Equipe ({settings.teamCostMode})</td>
                {projectSummaries.map((p) => (
                  <td key={p.projectName} className="px-4 py-2.5 text-right font-mono text-slate-400 border-r border-slate-800">
                    {formatMoney(p.CustosEquipe)}
                  </td>
                ))}
              </tr>

              <tr className="bg-emerald-950/20 font-bold">
                <td className="px-4 py-2.5 text-emerald-400 border-r border-slate-800">MARGEM BRUTA R$</td>
                {projectSummaries.map((p) => (
                  <td key={p.projectName} className="px-4 py-2.5 text-right font-mono text-emerald-400 border-r border-slate-800">
                    {formatMoney(p.MargemBruta)}
                  </td>
                ))}
              </tr>

              <tr className="bg-emerald-950/10">
                <td className="px-4 py-2.5 text-emerald-300/80 border-r border-slate-800 pl-6">Margem Bruta %</td>
                {projectSummaries.map((p) => (
                  <td key={p.projectName} className="px-4 py-2.5 text-right font-mono text-emerald-300 border-r border-slate-800">
                    {p.MargemBrutaPct.toFixed(2).replace('.', ',')}%
                  </td>
                ))}
              </tr>

              <tr>
                <td className="px-4 py-2.5 font-medium text-amber-400 border-r border-slate-800 pl-6">
                  Despesas ADM Pie ({settings.admExpensePercent}%)
                </td>
                {projectSummaries.map((p) => (
                  <td key={p.projectName} className="px-4 py-2.5 text-right font-mono text-amber-400 border-r border-slate-800">
                    {formatMoney(p.DespesasAdm)}
                  </td>
                ))}
              </tr>

              <tr className="bg-indigo-950/30 font-bold">
                <td className="px-4 py-2.5 text-indigo-300 border-r border-slate-800">RESULTADO FINAL LÍQUIDO</td>
                {projectSummaries.map((p) => (
                  <td key={p.projectName} className="px-4 py-2.5 text-right font-mono text-indigo-300 border-r border-slate-800">
                    {formatMoney(p.ResultadoFinal)}
                  </td>
                ))}
              </tr>

              <tr className="bg-indigo-950/10">
                <td className="px-4 py-2.5 text-indigo-300/80 border-r border-slate-800 pl-6">Margem Líquida %</td>
                {projectSummaries.map((p) => (
                  <td key={p.projectName} className="px-4 py-2.5 text-right font-mono text-indigo-300 border-r border-slate-800">
                    {p.MargemLiquidaPct.toFixed(2).replace('.', ',')}%
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
