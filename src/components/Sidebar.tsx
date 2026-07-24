import React from 'react';
import {
  FileSpreadsheet,
  Table,
  LineChart,
  Wallet,
  TrendingUp,
  Columns3,
  Building2,
  Sliders,
} from 'lucide-react';

export type TabType = 'import' | 'query' | 'timeline' | 'cashflow' | 'dashboard' | 'comparison';

interface SidebarProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  totalTransactionsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, totalTransactionsCount }) => {
  const navItems = [
    {
      id: 'timeline' as TabType,
      label: 'DRE no Tempo',
      icon: LineChart,
      description: 'Demonstração mensal gerencial',
    },
    {
      id: 'cashflow' as TabType,
      label: 'Fluxo de Caixa',
      icon: Wallet,
      description: 'Entradas líquidas & saídas',
    },
    {
      id: 'dashboard' as TabType,
      label: 'Viabilidade x Realizado',
      icon: TrendingUp,
      description: 'Análise de PMG, prêmios & atrasos',
    },
    {
      id: 'comparison' as TabType,
      label: 'Comparação de Projetos',
      icon: Columns3,
      description: 'Matriz lado a lado por obra',
    },
    {
      id: 'import' as TabType,
      label: 'Importação de Planilhas',
      icon: FileSpreadsheet,
      description: 'Assistente e mapeamento flexível',
    },
    {
      id: 'query' as TabType,
      label: 'Consulta de Dados',
      icon: Table,
      description: 'Registros e log de importação',
      badge: totalTransactionsCount,
    },
  ];

  return (
    <aside className="w-64 bg-dark-800 border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 z-30 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-100 tracking-wide">DRE Engenharia</h1>
            <p className="text-[11px] text-slate-400 font-medium">Controladoria & Finanças</p>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="p-3 space-y-1">
          <p className="px-3 pt-2 pb-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500">
            Módulos Gerenciais
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 text-left group ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-medium shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div
                    className={`p-1.5 rounded-lg transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className={`text-xs ${isActive ? 'font-semibold text-slate-100' : 'font-medium'}`}>
                      {item.label}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">{item.description}</p>
                  </div>
                </div>
                {item.badge !== undefined && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center space-x-2 text-slate-400 text-xs">
          <Sliders className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[11px] font-medium text-slate-300">Setor Construção Civil</span>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">DRE Global & Por Projeto v2.0</p>
      </div>
    </aside>
  );
};
