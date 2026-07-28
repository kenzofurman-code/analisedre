import React, { useState, useEffect, useRef } from 'react';
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

const DATA_VERSION = 'v8.1_purge_old_team_cost_residuals';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [selectedProjects, setSelectedProjects] = useState<string[]>(['all']);
  const [statusFilter, setStatusFilter] = useState<'all' | 'realizado' | 'projetado' | 'previsto_inicial'>('all');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(isFirebaseConfigured ? 'synced' : 'offline');

  const isRemoteUpdate = useRef(false);

  const [settings, setSettings] = useState<GlobalFinancialSettings>(() => {
    const saved = localStorage.getItem('dre_settings');
    return saved ? JSON.parse(saved) : INITIAL_SETTINGS;
  });

  const [projects, setProjects] = useState<ProjectContract[]>(() => {
    const savedVersion = localStorage.getItem('dre_data_version');
    const saved = localStorage.getItem('dre_projects');

    if (savedVersion === DATA_VERSION && saved) {
      const parsed: ProjectContract[] = JSON.parse(saved);
      return parsed;
    }

    localStorage.setItem('dre_data_version', DATA_VERSION);
    localStorage.removeItem('dre_projects');
    return [];
  });

  const [transactions, setTransactions] = useState<DRETransaction[]>(() => {
    const savedVersion = localStorage.getItem('dre_data_version');
    const saved = localStorage.getItem('dre_transactions');

    if (savedVersion === DATA_VERSION && saved) {
      const parsed: DRETransaction[] = JSON.parse(saved);
      return parsed.filter((t) => !t.id.startsWith('seed-'));
    }

    localStorage.setItem('dre_data_version', DATA_VERSION);
    localStorage.removeItem('dre_transactions');
    return [];
  });

  // 1. Subscribe to Realtime Firestore updates across devices (No loop)
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    setSyncStatus('syncing');

    const unsubscribe = storageService.subscribeData((remote) => {
      isRemoteUpdate.current = true;
      if (remote.projects !== undefined) {
        setProjects(remote.projects);
      }
      if (remote.transactions !== undefined) {
        // Purge ALL residual estimated team cost transactions from old imports
        // These will be regenerated fresh from the current project list
        const cleanTxs = (remote.transactions || []).filter((t: any) =>
          !t.id.startsWith('seed-') &&
          !(
            t.dreLineKey === 'custos_equipe' &&
            (t.id.startsWith('est-team-') || t.sourceSheet === 'Prazo Obras' || t.sourceFile === 'INFORMAÇÕES_PROJETOS.xlsx')
          )
        );
        setTransactions(cleanTxs);

        // Regenerate fresh estimated team costs from projects in Firebase
        if (remote.projects && remote.projects.length > 0) {
          const freshTeamTxs = generateEstimatedTeamCostTransactions(remote.projects);
          setTransactions((prev) => {
            const map = new Map<string, any>();
            prev.forEach((t) => map.set(t.id, t));
            freshTeamTxs.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
        }
      }
      if (remote.settings && Object.keys(remote.settings).length > 0) {
        setSettings((prev) => ({ ...prev, ...remote.settings }));
      }
      setSyncStatus('synced');
    });

    return () => unsubscribe();
  }, []);

  // 2. Debounced save to Firestore upon local state changes (Protected by isRemoteUpdate)
  useEffect(() => {
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      setSyncStatus('syncing');
      await storageService.saveData({ transactions, projects, settings });
      setSyncStatus(isFirebaseConfigured ? 'synced' : 'offline');
    }, 400);

    return () => clearTimeout(timer);
  }, [transactions, projects, settings]);

  const handleManualSync = async () => {
    setSyncStatus('syncing');
    try {
      if (isFirebaseConfigured) {
        const res = await storageService.saveData({ transactions, projects, settings });

        if (res.success) {
          const remote = await storageService.getData();
          if (remote) {
            isRemoteUpdate.current = true;
            if (remote.projects !== undefined) {
              setProjects(remote.projects);
            }
            if (remote.transactions !== undefined) {
              const cleanTxs = (remote.transactions || []).filter((t: any) => !t.id.startsWith('seed-'));
              setTransactions(cleanTxs);
            }
            if (remote.settings && Object.keys(remote.settings).length > 0) {
              setSettings((prev) => ({ ...prev, ...remote.settings }));
            }
          }
          setSyncStatus('synced');
          alert(`✅ Sincronização concluída com sucesso no Firebase Cloud!\n\nProjetos salvos: ${projects.length}\nLançamentos salvos: ${transactions.length}`);
        } else {
          setSyncStatus('offline');
          alert(`⚠️ Falha ao salvar no Firebase Cloud:\n${res.error}\n\nVerifique se o Firestore está ativado e com regras de leitura/escrita liberadas no Firebase Console.`);
        }
      } else {
        setSyncStatus('offline');
        alert('⚠️ Variáveis de ambiente do Firebase não foram encontradas (VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID). Operando em Modo Local.');
      }
    } catch (err: any) {
      console.error('Erro na sincronização manual:', err);
      setSyncStatus('offline');
      alert(`⚠️ Erro de conexão ao sincronizar: ${err?.message || String(err)}`);
    }
  };

  const handleUpdateSettings = (newSettings: Partial<GlobalFinancialSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      isRemoteUpdate.current = false;
      storageService.saveData({ transactions, projects, settings: updated });
      return updated;
    });
  };

  const handleImportComplete = (newTxs: DRETransaction[]) => {
    isRemoteUpdate.current = false;
    setTransactions((prev) => {
      const cleanPrev = prev.filter((t) => !t.id.startsWith('seed-'));
      const map = new Map<string, DRETransaction>();
      cleanPrev.forEach((t) => map.set(t.id, t));
      newTxs.forEach((t) => map.set(t.id, t));
      const updatedList = Array.from(map.values());
      storageService.saveData({ transactions: updatedList, projects, settings });
      return updatedList;
    });
    setActiveTab('query');
  };

  const handleImportProjects = (newProjects: ProjectContract[]) => {
    isRemoteUpdate.current = false;
    setProjects((prev) => {
      const map = new Map<string, ProjectContract>();
      prev.forEach((p) => map.set(p.name.toLowerCase(), p));
      newProjects.forEach((np) => {
        const existing = map.get(np.name.toLowerCase());
        map.set(np.name.toLowerCase(), { ...existing, ...np } as ProjectContract);
      });
      const updatedList = Array.from(map.values());

      const estouroTxs = generateEstouroTransactions(updatedList);
      const estimatedTeamTxs = generateEstimatedTeamCostTransactions(updatedList);

      setTransactions((prevTxs) => {
        // PURGE ALL OLD ESTIMATED TEAM COSTS & ESTOURO TRANSACTIONS FROM PREVIOUS IMPORTS
        const filteredTxs = prevTxs.filter(
          (t) =>
            t.dreLineKey !== 'estouro_contratada' &&
            !(t.dreLineKey === 'custos_equipe' && (t.id.startsWith('est-team-') || t.sourceFile === 'INFORMAÇÕES_PROJETOS.xlsx' || t.sourceSheet === 'Prazo Obras')) &&
            !t.id.startsWith('est-team-') &&
            !t.id.startsWith('estouro-') &&
            !t.id.startsWith('seed-')
        );
        const mergedTxs = [...estouroTxs, ...estimatedTeamTxs, ...filteredTxs];
        storageService.saveData({ transactions: mergedTxs, projects: updatedList, settings });
        return mergedTxs;
      });

      return updatedList;
    });
    setActiveTab('projects');
  };

  const handleDeleteProject = (projectId: string) => {
    isRemoteUpdate.current = false;
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== projectId);
      storageService.saveData({ transactions, projects: updated, settings });
      return updated;
    });
  };

  const handleClearAllProjects = async () => {
    if (window.confirm('Tem certeza que deseja limpar todo o cadastro de projetos e apagar do Firebase?')) {
      isRemoteUpdate.current = true;
      setProjects([]);
      await storageService.clearProjects();
      isRemoteUpdate.current = false;
      await storageService.saveData({ transactions, projects: [], settings });
    }
  };

  const handleResetProjects = () => {
    if (window.confirm('Deseja restaurar o cadastro de projetos inicial com os dados oficiais de INFORMAÇÕES_PROJETOS?')) {
      isRemoteUpdate.current = false;
      setProjects(INITIAL_PROJECTS);
      const estouroTxs = generateEstouroTransactions(INITIAL_PROJECTS);
      const estimatedTeamTxs = generateEstimatedTeamCostTransactions(INITIAL_PROJECTS);
      setTransactions((prevTxs) => {
        const filteredTxs = prevTxs.filter(
          (t) =>
            t.dreLineKey !== 'estouro_contratada' &&
            !(t.dreLineKey === 'custos_equipe' && (t.id.startsWith('est-team-') || t.sourceFile === 'INFORMAÇÕES_PROJETOS.xlsx' || t.sourceSheet === 'Prazo Obras')) &&
            !t.id.startsWith('est-team-') &&
            !t.id.startsWith('estouro-') &&
            !t.id.startsWith('seed-')
        );
        const mergedTxs = [...estouroTxs, ...estimatedTeamTxs, ...filteredTxs];
        storageService.saveData({ transactions: mergedTxs, projects: INITIAL_PROJECTS, settings });
        return mergedTxs;
      });
    }
  };

  const handleAddProject = (newProj: ProjectContract) => {
    isRemoteUpdate.current = false;
    setProjects((prev) => {
      const updated = [newProj, ...prev];
      const estouroTxs = generateEstouroTransactions(updated);
      const estimatedTeamTxs = generateEstimatedTeamCostTransactions(updated);
      setTransactions((prevTxs) => {
        const filteredTxs = prevTxs.filter(
          (t) =>
            t.dreLineKey !== 'estouro_contratada' &&
            !(t.dreLineKey === 'custos_equipe' && (t.id.startsWith('est-team-') || t.sourceFile === 'INFORMAÇÕES_PROJETOS.xlsx' || t.sourceSheet === 'Prazo Obras')) &&
            !t.id.startsWith('est-team-') &&
            !t.id.startsWith('estouro-') &&
            !t.id.startsWith('seed-')
        );
        const mergedTxs = [...estouroTxs, ...estimatedTeamTxs, ...filteredTxs];
        storageService.saveData({ transactions: mergedTxs, projects: updated, settings });
        return mergedTxs;
      });
      return updated;
    });
  };

  const handleDeleteTransaction = (id: string) => {
    isRemoteUpdate.current = false;
    setTransactions((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      storageService.saveData({ transactions: updated, projects, settings });
      return updated;
    });
  };

  const handleClearAllTransactions = async () => {
    if (window.confirm('Tem certeza que deseja limpar todos os lançamentos do banco de dados e apagar do Firebase?')) {
      // Set BEFORE clearing to prevent debounce from re-saving the old state
      isRemoteUpdate.current = true;
      setTransactions([]);
      await storageService.clearTransactions();
      // Now save the clean empty state explicitly
      isRemoteUpdate.current = false;
      await storageService.saveData({ transactions: [], projects, settings });
    }
  };

  const handleAddTransaction = (tx: DRETransaction) => {
    isRemoteUpdate.current = false;
    setTransactions((prev) => {
      const updated = [tx, ...prev];
      storageService.saveData({ transactions: updated, projects, settings });
      return updated;
    });
  };

  const handleUpdateTransaction = (updatedTx: DRETransaction) => {
    isRemoteUpdate.current = false;
    setTransactions((prev) => {
      const updated = prev.map((t) => (t.id === updatedTx.id ? updatedTx : t));
      storageService.saveData({ transactions: updated, projects, settings });
      return updated;
    });
  };

  // Compute monthly DRE data for timeline and cashflow filtered by selectedProjects
  const monthlyColumns = calculateMonthlyDRE(transactions, projects, settings, selectedProjects, statusFilter);

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
          selectedProjects={selectedProjects}
          onSelectProjects={setSelectedProjects}
          statusFilter={statusFilter}
          onSelectStatusFilter={setStatusFilter}
          syncStatus={syncStatus}
          onManualSync={handleManualSync}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
        />

        <main className="flex-1 overflow-y-auto pb-12">
          {activeTab === 'timeline' && (
            <DRETimelineTab monthlyColumns={monthlyColumns} settings={settings} selectedProjects={selectedProjects} />
          )}

          {activeTab === 'cashflow' && (
            <CashFlowTab monthlyColumns={monthlyColumns} selectedProjects={selectedProjects} />
          )}

          {activeTab === 'dashboard' && (
            <ViabilityDashboardTab projects={projects} selectedProjects={selectedProjects} />
          )}

          {activeTab === 'comparison' && (
            <ProjectComparisonTab projects={projects} transactions={transactions} settings={settings} selectedProjects={selectedProjects} />
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
              selectedProjects={selectedProjects}
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
              selectedProjects={selectedProjects}
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
