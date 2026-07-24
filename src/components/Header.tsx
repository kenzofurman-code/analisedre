import React, { useState } from 'react';
import { GlobalFinancialSettings, ProjectContract } from '../types/dre';
import { SettingsDrawer } from './SettingsDrawer';
import { Building, Filter, Sliders } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  projects: ProjectContract[];
  selectedProject: string;
  onSelectProject: (proj: string) => void;
  statusFilter: 'all' | 'realizado' | 'projetado' | 'previsto_inicial';
  onSelectStatusFilter: (status: 'all' | 'realizado' | 'projetado' | 'previsto_inicial') => void;
  settings: GlobalFinancialSettings;
  onUpdateSettings: (newSettings: Partial<GlobalFinancialSettings>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  projects,
  selectedProject,
  onSelectProject,
  statusFilter,
  onSelectStatusFilter,
  settings,
  onUpdateSettings,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  return (
    <>
      <header className="bg-dark-800/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 sticky top-0 z-20">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Title Area */}
          <div>
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">{title}</h2>
            <p className="text-xs text-slate-400 font-normal">{subtitle}</p>
          </div>

          {/* Header Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Project Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-900/80 border border-slate-700/60 rounded-xl px-3 py-1.5 shadow-inner">
              <Building className="w-4 h-4 text-blue-400" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase">Projeto:</span>
              <select
                value={selectedProject}
                onChange={(e) => onSelectProject(e.target.value)}
                aria-label="Selecionar Projeto"
                className="bg-transparent text-xs text-slate-100 font-semibold focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-dark-800 text-slate-100">Global (Todos os Projetos)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.name} className="bg-dark-800 text-slate-100">
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter (Realizado + Projetado vs Realizado vs Projetado vs Previsto Inicial) */}
            <div className="flex items-center space-x-1 bg-slate-900/80 border border-slate-700/60 rounded-xl p-1 shadow-inner">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <button
                onClick={() => onSelectStatusFilter('all')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                  statusFilter === 'all' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visão Consolidada: Realizado (Passado/Atual) + Projetado (Futuro)"
              >
                Realizado + Projetado
              </button>
              <button
                onClick={() => onSelectStatusFilter('realizado')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                  statusFilter === 'realizado' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Apenas Lançamentos Realizados Efetivados"
              >
                Realizado
              </button>
              <button
                onClick={() => onSelectStatusFilter('projetado')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                  statusFilter === 'projetado' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Apenas Projeções Futuras"
              >
                Projetado (Futuro)
              </button>
              <button
                onClick={() => onSelectStatusFilter('previsto_inicial')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
                  statusFilter === 'previsto_inicial' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Orçamento Base Previsto Inicial (Viabilidade)"
              >
                Previsto Inicial
              </button>
            </div>

            {/* BUTTON TO OPEN RIGHT SLIDING SETTINGS DRAWER */}
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center space-x-2 px-3.5 py-1.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/40 text-blue-300 font-semibold text-xs rounded-xl shadow-md transition-all hover:border-blue-400"
              title="Abrir Drawer de Configurações e Alíquotas de Impostos"
            >
              <Sliders className="w-4 h-4 text-blue-400" />
              <span>⚙️ Configurações & Parâmetros</span>
            </button>
          </div>
        </div>
      </header>

      {/* Settings Drawer */}
      <SettingsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
    </>
  );
};
