import React, { useState, useRef, useEffect } from 'react';
import { GlobalFinancialSettings, ProjectContract, SyncStatus } from '../types/dre';
import { SettingsDrawer } from './SettingsDrawer';
import { Building, Filter, Sliders, RefreshCw, ChevronDown, Check, Search, X } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle: string;
  projects: ProjectContract[];
  selectedProjects: string[]; // ['all'] or ['Varanda', 'Aretha']
  onSelectProjects: (projs: string[]) => void;
  statusFilter: 'all' | 'realizado' | 'projetado' | 'previsto_inicial';
  onSelectStatusFilter: (status: 'all' | 'realizado' | 'projetado' | 'previsto_inicial') => void;
  syncStatus: SyncStatus;
  onManualSync?: () => void;
  settings: GlobalFinancialSettings;
  onUpdateSettings: (newSettings: Partial<GlobalFinancialSettings>) => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  projects,
  selectedProjects,
  onSelectProjects,
  statusFilter,
  onSelectStatusFilter,
  syncStatus,
  onManualSync,
  settings,
  onUpdateSettings,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState<boolean>(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState<string>('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close project dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllSelected = selectedProjects.includes('all') || selectedProjects.length === 0;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      onSelectProjects([]);
    } else {
      onSelectProjects(['all']);
    }
  };

  const toggleProject = (projectName: string) => {
    if (isAllSelected) {
      onSelectProjects([projectName]);
      return;
    }

    if (selectedProjects.includes(projectName)) {
      const updated = selectedProjects.filter((p) => p !== projectName);
      onSelectProjects(updated.length === 0 ? ['all'] : updated);
    } else {
      onSelectProjects([...selectedProjects, projectName]);
    }
  };

  const filteredProjectsList = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearchTerm.toLowerCase())
  );

  const renderProjectButtonText = () => {
    if (isAllSelected) {
      return 'Global (Todos os Projetos)';
    }
    if (selectedProjects.length === 1) {
      return selectedProjects[0];
    }
    return `${selectedProjects.length} Projetos Selecionados`;
  };

  const renderSyncBadge = () => {
    if (syncStatus === 'syncing') {
      return (
        <button
          onClick={onManualSync}
          disabled
          className="flex items-center space-x-1.5 bg-blue-950/80 border border-blue-500/50 text-blue-400 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs cursor-wait"
          title="Sincronizando dados com o banco de dados Firebase Cloud..."
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Sincronizando...</span>
        </button>
      );
    }

    if (syncStatus === 'offline') {
      return (
        <button
          onClick={onManualSync}
          className="flex items-center space-x-1.5 bg-amber-950/80 hover:bg-amber-900/80 border border-amber-500/50 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
          title="Modo Local: Clique para testar a conexão e forçar a sincronização com o Firebase Cloud"
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
          <span>Modo Local (Clique p/ Sincronizar)</span>
        </button>
      );
    }

    return (
      <button
        onClick={onManualSync}
        className="flex items-center space-x-1.5 bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/50 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
        title="Conectado ao Firebase Cloud. Clique para forçar a re-sincronização imediata."
      >
        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
        <span>Sincronizado (Clique p/ Atualizar)</span>
      </button>
    );
  };

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
            {/* Multi-Select Project Selector Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-xl px-3.5 py-1.5 shadow-md transition-all text-xs font-semibold text-slate-100"
                title="Selecione um ou múltiplos projetos simultaneamente"
              >
                <Building className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span className="text-[11px] font-semibold text-slate-400 uppercase">Projeto:</span>
                <span className="text-blue-300 font-bold max-w-[180px] truncate">
                  {renderProjectButtonText()}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              </button>

              {/* Multi-select Dropdown Popover */}
              {isProjectDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 bg-dark-800 border border-slate-700/80 rounded-2xl shadow-2xl z-50 p-3 space-y-2">
                  {/* Header Actions */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-slate-300">Filtrar Obras</span>
                    <span className="text-[10px] text-blue-400 font-bold">
                      {isAllSelected ? 'Todos' : `${selectedProjects.length} de ${projects.length}`}
                    </span>
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar obra..."
                      value={projectSearchTerm}
                      onChange={(e) => setProjectSearchTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                    {projectSearchTerm && (
                      <button
                        onClick={() => setProjectSearchTerm('')}
                        className="absolute right-2 top-2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Toggle All Option */}
                  <div
                    onClick={toggleSelectAll}
                    className="flex items-center space-x-2 p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-colors text-xs font-bold text-blue-400"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${isAllSelected ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 bg-slate-900'}`}>
                      {isAllSelected && <Check className="w-3 h-3" />}
                    </div>
                    <span>Global (Todos os Projetos)</span>
                  </div>

                  <div className="border-t border-slate-800/80 my-1" />

                  {/* Projects Checkboxes List */}
                  <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-thin pr-1">
                    {filteredProjectsList.map((p) => {
                      const isChecked = !isAllSelected && selectedProjects.includes(p.name);
                      return (
                        <div
                          key={p.id || p.name}
                          onClick={() => toggleProject(p.name)}
                          className={`flex items-center space-x-2 p-2 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-colors text-xs ${
                            isChecked ? 'bg-blue-950/40 text-slate-100 font-semibold' : 'text-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 bg-slate-900'}`}>
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{p.name}</span>
                        </div>
                      );
                    })}

                    {filteredProjectsList.length === 0 && (
                      <p className="text-[11px] text-slate-500 italic p-2 text-center">Nenhuma obra encontrada.</p>
                    )}
                  </div>

                  {/* Apply / Close Button */}
                  <div className="pt-2 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => setIsProjectDropdownOpen(false)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
                    >
                      Aplicar Filtro
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Status Filter */}
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

            {/* SYNC STATUS BUTTON (INTERACTIVE INTERFACE) */}
            {renderSyncBadge()}

            {/* Settings Drawer Trigger Button */}
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
