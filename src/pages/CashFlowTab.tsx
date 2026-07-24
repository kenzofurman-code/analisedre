import React, { useMemo } from 'react';
import { MonthlyDREColumn } from '../types/dre';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from 'lucide-react';

interface CashFlowTabProps {
  monthlyColumns: MonthlyDREColumn[];
  selectedProject: string;
}

export const CashFlowTab: React.FC<CashFlowTabProps> = ({ monthlyColumns, selectedProject }) => {
  // Filter columns to ONLY show the active period that contains financial information/movement
  const activeColumns = useMemo(() => {
    if (monthlyColumns.length === 0) return [];

    let firstIdx = -1;
    let lastIdx = -1;

    monthlyColumns.forEach((col, idx) => {
      const grossRev =
        col.values.receita_taxa_adm +
        col.values.permuta_taxa_adm +
        col.values.receita_mo_adm +
        col.values.receita_assistencia;

      const totalOutflow =
        col.values.custos_equipe +
        col.values.custos_deslocamento +
        col.values.impostos +
        col.values.despesa_assistencia +
        col.values.despesas_adm_pie;

      if (grossRev > 0 || totalOutflow > 0) {
        if (firstIdx === -1) firstIdx = idx;
        lastIdx = idx;
      }
    });

    if (firstIdx === -1) return monthlyColumns.slice(0, 12);
    return monthlyColumns.slice(firstIdx, lastIdx + 1);
  }, [monthlyColumns]);

  // Compute cash flow monthly data and cumulative balance
  const cashFlowData = useMemo(() => {
    let runningBalance = 0;

    return activeColumns.map((col) => {
      const grossRev =
        col.values.receita_taxa_adm +
        col.values.permuta_taxa_adm +
        col.values.receita_mo_adm +
        col.values.receita_assistencia;

      const totalOutflows =
        col.values.impostos +
        col.values.despesa_assistencia +
        col.values.custos_equipe +
        col.values.custos_deslocamento +
        col.values.despesas_adm_pie +
        col.values.irpj_csll;

      const netCash = grossRev - totalOutflows;
      runningBalance += netCash;

      return {
        monthLabel: col.displayLabel,
        yearMonth: col.yearMonth,
        inflow: grossRev,
        outflow: totalOutflows,
        netCash,
        cumulativeBalance: runningBalance,
        isFuture: col.isFuture,
      };
    });
  }, [activeColumns]);

  const totalInflows = cashFlowData.reduce((acc, d) => acc + d.inflow, 0);
  const totalOutflows = cashFlowData.reduce((acc, d) => acc + d.outflow, 0);
  const finalCumulativeBalance = cashFlowData.length > 0 ? cashFlowData[cashFlowData.length - 1].cumulativeBalance : 0;

  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* KPI Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-emerald-500">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Entradas de Caixa</p>
            <h3 className="text-xl font-bold text-emerald-400 mt-1">{formatMoney(totalInflows)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Período ativo: {cashFlowData.length} meses</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Saídas Operacionais</p>
            <h3 className="text-xl font-bold text-rose-400 mt-1">{formatMoney(totalOutflows)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Custos, Impostos & ADM</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <ArrowDownRight className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Operacional Líquido</p>
            <h3 className="text-xl font-bold text-blue-400 mt-1">{formatMoney(totalInflows - totalOutflows)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Entradas - Saídas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-l-4 border-l-indigo-500">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Saldo Acumulado Final</p>
            <h3 className="text-xl font-bold text-indigo-400 mt-1">{formatMoney(finalCumulativeBalance)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">
              Projeto: <strong className="text-blue-400">{selectedProject === 'all' ? 'Global' : selectedProject}</strong>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Interactive Recharts Composed Chart (Inflows, Outflows & Cumulative Line) */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-100">Evolução Mensal do Fluxo de Caixa</h3>
            <p className="text-xs text-slate-400">
              Período filtrado com movimentações ativas ({cashFlowData[0]?.monthLabel || ''} a{' '}
              {cashFlowData[cashFlowData.length - 1]?.monthLabel || ''})
            </p>
          </div>
        </div>

        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cashFlowData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
              <XAxis dataKey="monthLabel" stroke="#64748B" fontSize={11} />
              <YAxis stroke="#64748B" fontSize={11} tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                formatter={(val: number) => formatMoney(val)}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="inflow" name="Entradas (Receitas)" fill="#10B981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outflow" name="Saídas (Custos/Impostos)" fill="#EF4444" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="cumulativeBalance" name="Saldo Acumulado (R$)" stroke="#6366F1" strokeWidth={3} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cash Flow Detailed Matrix Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-slate-300 font-bold border-b border-slate-700">
              <tr>
                <th className="px-4 py-3.5 w-64 min-w-[240px] bg-slate-900 border-r border-slate-800">CATEGORIA DE CAIXA</th>
                {cashFlowData.map((d) => (
                  <th
                    key={d.yearMonth}
                    className={`px-3 py-3.5 text-right min-w-[110px] font-mono border-r border-slate-800/60 ${
                      d.isFuture ? 'bg-amber-950/20 text-amber-300' : 'bg-slate-900 text-slate-200'
                    }`}
                  >
                    <div>{d.monthLabel}</div>
                    {d.isFuture && <div className="text-[9px] font-normal text-amber-500/80">(Projetado)</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-bold text-emerald-400">
                  (+) Entradas de Caixa (Receita Bruta)
                </td>
                {cashFlowData.map((d) => (
                  <td key={d.yearMonth} className="px-3 py-3 text-right font-mono font-bold text-emerald-400 border-r border-slate-800/60">
                    {formatMoney(d.inflow)}
                  </td>
                ))}
              </tr>

              <tr className="hover:bg-slate-800/30">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-semibold text-rose-400 pl-6">
                  (-) Saídas Operacionais (Custos/ADM)
                </td>
                {cashFlowData.map((d) => (
                  <td key={d.yearMonth} className="px-3 py-3 text-right font-mono text-rose-400 border-r border-slate-800/60">
                    {formatMoney(d.outflow)}
                  </td>
                ))}
              </tr>

              <tr className="bg-blue-950/20 border-y border-blue-500/30 font-bold">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-bold text-blue-400">
                  (=) Saldo Líquido do Mês
                </td>
                {cashFlowData.map((d) => (
                  <td
                    key={d.yearMonth}
                    className={`px-3 py-3 text-right font-mono font-bold border-r border-slate-800/60 ${
                      d.netCash >= 0 ? 'text-blue-400' : 'text-rose-400'
                    }`}
                  >
                    {formatMoney(d.netCash)}
                  </td>
                ))}
              </tr>

              <tr className="bg-indigo-950/30 border-y-2 border-indigo-500/40 font-bold">
                <td className="px-4 py-3 border-r border-slate-800 bg-dark-800/80 font-bold text-indigo-300">
                  (=) Saldo de Caixa Acumulado
                </td>
                {cashFlowData.map((d) => (
                  <td
                    key={d.yearMonth}
                    className={`px-3 py-3 text-right font-mono font-bold border-r border-slate-800/60 ${
                      d.cumulativeBalance >= 0 ? 'text-indigo-300' : 'text-rose-400'
                    }`}
                  >
                    {formatMoney(d.cumulativeBalance)}
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
