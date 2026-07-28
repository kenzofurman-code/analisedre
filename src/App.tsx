import React, { useState, useEffect } from 'react';
import { Sidebar, TabType } from './components/Sidebar';
import { Header } from './components/Header';
import { DRETimelineTab } from './pages/DRETimelineTab';
import { CashFlowTab } from './pages/CashFlowTab';
import { ViabilityDashboardTab } from './pages/ViabilityDashboardTab';
import { ProjectComparisonTab } from './pages/ProjectComparisonTab';
import { ImportTab } from './pages/ImportTab';
import { DataQueryTab } from './pages/DataQueryTab';
import { ProjectQueryTab } from './pages/ProjectQueryTab';
import { DRETransaction, GlobalFinancialSettings, ProjectContract, SyncStatus } from './types/dre';
import { INITIAL_PROJECTS, INITIAL_SETTINGS } from './services/initialData';
import { calculateMonthlyDRE } from './services/dreCalculator';
import { storageService, isFirebaseConfigured } from './services/firebaseConfig';
import { generateEstouroTransactions, generateEstimatedTeamCostTransactions } from './utils/excelParser';

const DATA_VERSION = 'v6.0_pure_real_excel_data';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'realizado' | 'projetado' | 'previsto_inicial'>('all');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isFirebaseConfigured ? 'synced' : 'offline');

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
      const parsed: DRETransaction[] = JSON.parse(saved);
      return parsed.filter((t) => !t.id.startsWith('seed-'));
    }

    localStorage.setItem('dre_data_version', DATA_VERSION);
    const initialEstouro = generateEstouroTransactions(INITIAL_PROJECTS);
    const initialEstimatedTeam = generateEstimatedTeamCostTransactions(INITIAL_PROJECTS);

    const merged = [...initialEstouro, ...initialEstimatedTeam];
    localStorage.setItem('dre_transactions', JSON.stringify(merged));
    return merged;
  });

  // Real-time synchronization for Projects, Transactions, and Settings across multiple devices
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    setSyncStatus('syncing');

    const unsubscribeProjects = storageService.subscribeProjects((remoteProjects) => {
      setProjects(remoteProjects || []);
      setSyncStatus('synced');
    });

    const unsubscribeTransactions = storageService.subscribeTransactions((remoteTxs) => {
      const cleanTxs = (remoteTxs || []).filter((t) => !t.id.startsWith('seed-'));
      setTransactions(cleanTxs);
      setSyncStatus('synced');
    });

    const unsubscribeSettings = storageService.subscribeSettings((remoteSettings) => {
      if (remoteSettings) {
        setSettings(remoteSettings);
        setSyncStatus('synced');
      }
    });

    return () => {
      unsubscribeProjects();
      unsubscribeTransactions();
      unsubscribeSettings();
    };
  }, []);

  // Save & Sync Data upon state mutations
  useEffect(() => {
    const syncData = async () => {
      setSyncStatus('syncing');
      await storageService.saveSettings(settings);
      setSyncStatus(isFirebaseConfigured ? 'synced' : 'offline');
    };
    syncData();
  }, [settings]);

  useEffect(() => {
    const syncData = async () => {
      setSyncStatus('syncing');
      await storageService.saveProjects(projects);
      setSyncStatus(isFirebaseConfigured ? 'synced' : 'offline');
    };
    syncData();
  }, [projects]);

  useEffect(() => {
    const syncData = async () => {
      setSyncStatus('syncing');
      await storageService.saveTransactions(transactions);
      setSyncStatus(isFirebaseConfigured ? 'synced' : 'offline');
    };
    syncData();
  }, [transactions]);

  const handleUpdateSettings = (newSettings: Partial<GlobalFinancialSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleImportComplete = (newTxs: DRETransaction[]) => {
    setTransactions((prev) => {
      const cleanPrev = prev.filter((t) => !t.id.startsWith('seed-'));
      const map = new Map<string, DRETransaction>();
      cleanPrev.forEach((t) => map.set(t.id, t));
      newTxs.forEach((t) => map.set(t.id, t));
      return Array.from(map.values());
    });
    setActiveTab('query');
  };

  const handleImportProjects = (newProjects: ProjectContract[]) => {
    setProjects((prev) => {
      const map = new Map<string, ProjectContract>();
      prev.forEach((p) => map.set(p.name.toLowerCase(), p));
      newProjects.forEach((np) => {
        const existing = map.get(np.name.toLowerCase());
        map.set(np.name.toLowerCase(), { ...existing, ...np } as ProjectContract);
      });
      const updatedList = Array.from(map.values());

      // Auto Generate Estouro Transactions for projects with estouroContratada
      const estouroTxs = generateEstouroTransactions(updatedList);
      // Auto Generate Estimated Team Cost Transactions for projects from Col J & Max(D, E, G)
      const estimatedTeamTxs = generateEstimatedTeamCostTransactions(updatedList);

      setTransactions((prevTxs) => {
        const filteredTxs = prevTxs.filter(
          (t) => t.dreLineKey !== 'estouro_contratada' && !t.id.startsWith('est-team-') && !t.id.startsWith('seed-')
        );
        return [...estouroTxs, ...estimatedTeamTxs, ...filteredTxs];
      });

      return updatedList;
    });
    setActiveTab('projects');
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const handleClearAllProjects = async () => {
    if (window.confirm('Tem certeza que deseja limpar todo o cadastro de projetos e apagar do Firebase?')) {
      setProjects([]);
      await storageService.clearProjects();
    }
  };

  const handleResetProjects = () => {
    if (window.confirm('Deseja restaurar o cadastro de projetos inicial?')) {
      setProjects(INITIAL_PROJECTS);
      const estouroTxs = generateEstouroTransactions(INITIAL_PROJECTS);
      const estimatedTeamTxs = generateEstimatedTeamCostTransactions(INITIAL_PROJECTS);
      setTransactions((prevTxs) => {
        const filteredTxs = prevTxs.filter(
          (t) => t.dreLineKey !== 'estouro_contratada' && !t.id.startsWith('est-team-') && !t.id.startsWith('seed-')
        );
        return [...estouroTxs, ...estimatedTeamTxs, ...filteredTxs];
      });
    }
  };

  const handleAddProject = (newProj: ProjectContract) => {
    setProjects((prev) => {
      const updated = [newProj, ...prev];
      const estouroTxs = generateEstouroTransactions(updated);
      const estimatedTeamTxs = generateEstimatedTeamCostTransactions(updated);
      setTransactions((prevTxs) => {
        const filteredTxs = prevTxs.filter(
          (t) => t.dreLineKey !== 'estouro_contratada' && !t.id.startsWith('est-team-') && !t.id.startsWith('seed-')
        );
        return [...estouroTxs, ...estimatedTeamTxs, ...filteredTxs];
      });
      return updated;
    });
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearAllTransactions = async () => {
    if (window.confirm('Tem certeza que deseja limpar todos os lançamentos do banco de dados e apagar do Firebase?')) {
      setTransactions([]);
      await storageService.clearTransactions();
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
      title: 'Central de Importação Múltipla Excel',
      subtitle: 'Assistente para Cadastro de Projetos (INFORMAÇÕES_PROJETOS) e Lançamentos DRE',
    },
    projects: {
      title: 'Cadastro & Base de Dados de Projetos',
      subtitle: 'Consulta, busca, gestão e limpeza do cadastro de obras importado de INFORMAÇÕES_PROJETOS',
    },
    query: {
      title: 'Base de Lançamentos Financeiros DRE',
      subtitle: 'Consulta, busca, filtros e edição de lançamentos com rastreabilidade de valores originais',
    },
  };

  return (
    <div className="flex min-h-screen bg-[#0B0F17] text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        totalTransactionsCount={transactions.length}
        totalProjectsCount={projects.length}
      />

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
          syncStatus={syncStatus}
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
            <ImportTab
              projects={projects}
              onImportComplete={handleImportComplete}
              onImportProjects={handleImportProjects}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectQueryTab
              projects={projects}
              onDeleteProject={handleDeleteProject}
              onClearAllProjects={handleClearAllProjects}
              onAddProject={handleAddProject}
              onResetProjects={handleResetProjects}
            />
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
