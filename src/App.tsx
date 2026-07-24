import React, { useState, useEffect } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { DRETimelineTab } from './pages/DRETimelineTab';
import { CashFlowTab } from './pages/CashFlowTab';
import { ViabilityDashboardTab } from './pages/ViabilityDashboardTab';
import { ProjectComparisonTab } from './pages/ProjectComparisonTab';
import { ImportTab } from './pages/ImportTab';
import { DataQueryTab } from './pages/DataQueryTab';
import { DRETransaction, GlobalFinancialSettings, ProjectContract } from './types/dre';
import { INITIAL_PROJECTS, INITIAL_SETTINGS, generateInitialTransactions } from './services/initialData';
import { calculateMonthlyDRE } from './services/dreCalculator';

const DATA_VERSION = 'v3.0_financial_status_nomenclatures';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'realizado' | 'projetado' | 'previsto_inicial'>('all');

  const [settings, setSettings] = useState<GlobalFinancialSettings>(() => {
    const saved = localStorage.getItem('dre_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [projects, setProjects] = useState<ProjectContract[]>(() => {
    const saved = localStorage.getItem('dre_projects');
    return saved ? JSON.parse(saved) : INITIAL_PROJECTS;
  });

  const [transactions, setTransactions] = useState<DRETransaction[]>(() => {
    const savedVersion = localStorage.getItem('dre_data_version');
    const saved = localStorage.getItem('dre_transactions');
    
    if (savedVersion === DATA_VERSION && saved) {
      return JSON.parse(saved);
    }
    
    localStorage.setItem('dre_data_version', DATA_VERSION);
    const initial = generateInitialTransactions();
    localStorage.setItem('dre_transactions', JSON.stringify(initial));
    return initial;
  });

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('dre_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('dre_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('dre_transactions', JSON.stringify(transactions));
  }, [transactions]);

  const handleUpdateSettings = (newSettings: Partial<GlobalFinancialSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleImportComplete = (newTxs: DRETransaction[]) => {
    setTransactions((prev) => [...newTxs, ...prev]);
    setActiveTab('query');
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearAllTransactions = () => {
    if (window.confirm('Tem certeza que deseja limpar todos os lançamentos do banco de dados?')) {
      setTransactions([]);
    }
  };

  const handleAddTransaction = (tx: DRETransaction) => {
    setTransactions((prev) => [tx, ...prev]);
  };

  const handleUpdateTransaction = (updatedTx: DRETransaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));
  };

  // Compute monthly DRE data for timeline and cashflow
  const monthlyColumns = calculateMonthlyDRE(transactions, projects, settings, selectedProject, statusFilter);

  // Tab Titles & Subtitles
  const tabTitles: Record<TabType, { title: string; subtitle: string }> = {
    timeline: {
      title: 'Demonstração do Resultado do Exercício no Tempo',
      subtitle: 'Visão matricial gerencial mensal: Realizado (efetivado) + Projetado (futuro)',
    },
    cashflow: {
      title: 'Fluxo de Caixa Gerencial',
      subtitle: 'Entradas líquidas de receitas, saídas operacionais e saldo acumulado de caixa',
    },
    dashboard: {
      title: 'Dashboard de Viabilidade x Realizado & Gestão de Contratos',
      subtitle: 'Análise de PMG, Previsto Inicial (Viabilidade Base), bônus e atrasos',
    },
    comparison: {
      title: 'Comparação de DRE Entre Projetos',
      subtitle: 'Matriz comparativa lado a lado da performance financeira de cada obra',
    },
    import: {
      title: 'Importação Múltipla de Planilhas Excel',
      subtitle: 'Assistente com classificação em Realizado, Projetado (Futuro) e Previsto Inicial',
    },
    query: {
      title: 'Base de Dados & Lançamentos Importados',
      subtitle: 'Consulta, busca, filtros e edição com rastreabilidade de valores originais',
    },
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F17] text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar activeTab={activeTab} onSelectTab={setActiveTab} totalTransactionsCount={transactions.length} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={tabTitles[activeTab].title}
          subtitle={tabTitles[activeTab].subtitle}
          projects={projects}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
          statusFilter={statusFilter}
          onSelectStatusFilter={setStatusFilter}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />

        <main className="flex-1 overflow-y-auto pb-12">
          {activeTab === 'timeline' && (
            <DRETimelineTab monthlyColumns={monthlyColumns} settings={settings} selectedProject={selectedProject} />
          )}

          {activeTab === 'cashflow' && (
            <CashFlowTab monthlyColumns={monthlyColumns} selectedProject={selectedProject} />
          )}

          {activeTab === 'dashboard' && (
            <ViabilityDashboardTab projects={projects} selectedProject={selectedProject} />
          )}

          {activeTab === 'comparison' && (
            <ProjectComparisonTab projects={projects} transactions={transactions} settings={settings} />
          )}

          {activeTab === 'import' && (
            <ImportTab projects={projects} onImportComplete={handleImportComplete} />
          )}

          {activeTab === 'query' && (
            <DataQueryTab
              transactions={transactions}
              projects={projects}
              onDeleteTransaction={handleDeleteTransaction}
              onClearAllTransactions={handleClearAllTransactions}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
            />
          )}
        </main>
      </div>
    </div>
  );
}
