import React, { useState } from 'react';
import { DRETransaction, ProjectContract, TransactionStatus } from '../types/dre';
import { DRE_LINE_DEFINITIONS } from '../constants/dreStructure';
import { Search, Filter, Trash2, Plus, Tag, FileText, Layers, Info } from 'lucide-react';

interface DataQueryTabProps {
  transactions: DRETransaction[];
  projects: ProjectContract[];
  selectedProjects: string[];
  onDeleteTransaction: (id: string) => void;
  onClearAllTransactions: () => void;
  onAddTransaction: (tx: DRETransaction) => void;
  onUpdateTransaction: (tx: DRETransaction) => void;
}

export const DataQueryTab: React.FC<DataQueryTabProps> = ({
  transactions,
  projects,
  selectedProjects,
  onDeleteTransaction,
  onClearAllTransactions,
  onAddTransaction,
  onUpdateTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lineFilter, setLineFilter] = useState<string>('all');

  // Manual new entry modal state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newProject, setNewProject] = useState<string>(projects[0]?.name || 'Varanda');
  const [newDate, setNewDate] = useState<string>(new Date().toISOString().slice(0, 7));
  const [newLineKey, setNewLineKey] = useState<string>('receita_taxa_adm');
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newStatus, setNewStatus] = useState<TransactionStatus>('realizado');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newSourceFile, setNewSourceFile] = useState<string>('Lançamento Manual');
  const [newSourceSheet, setNewSourceSheet] = useState<string>('Sistema');

  // Inline Cell Editing State (stores ID of cell being edited)
  const [editingCellId, setEditingCellId] = useState<string | null>(null);
  const [editingCellVal, setEditingCellVal] = useState<string>('');

  const filtered = transactions.filter((t) => {
    const isGlobalProj = selectedProjects.includes('all') || selectedProjects.length === 0;
    if (!isGlobalProj && !selectedProjects.includes(t.project)) return false;
    if (projectFilter !== 'all' && t.project !== projectFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (lineFilter !== 'all' && t.dreLineKey !== lineFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchDesc = t.description?.toLowerCase().includes(term);
      const matchProj = t.project?.toLowerCase().includes(term);
      const matchFile = t.sourceFile?.toLowerCase().includes(term);
      const matchSheet = t.sourceSheet?.toLowerCase().includes(term);
      if (!matchDesc && !matchProj && !matchFile && !matchSheet) return false;
    }
    return true;
  });

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const currentDateStr = new Date().toISOString().slice(0, 7);
    let finalStatus = newStatus;
    let isAutoForecast = false;

    if (finalStatus === 'realizado' && newDate > currentDateStr) {
      finalStatus = 'projetado';
      isAutoForecast = true;
    }

    const tx: DRETransaction = {
      id: `manual-${Date.now()}`,
      project: newProject,
      date: newDate,
      dreLineKey: newLineKey as any,
      amount: newAmount,
      status: finalStatus,
      isAutoForecast,
      description: newDesc || 'Lançamento Manual',
      sourceFile: newSourceFile || 'Manual',
      sourceSheet: newSourceSheet || 'Manual',
      createdAt: new Date().toISOString(),
    };

    onAddTransaction(tx);
    setShowAddModal(false);
    setNewAmount(0);
    setNewDesc('');
  };

  // Start inline editing cell
  const handleStartInlineEdit = (tx: DRETransaction) => {
    setEditingCellId(tx.id);
    setEditingCellVal(String(tx.amount));
  };

  // Save inline edit cell
  const handleSaveInlineEdit = (tx: DRETransaction) => {
    const newNum = parseFloat(editingCellVal);
    if (!isNaN(newNum) && newNum !== tx.amount) {
      const originalVal = tx.originalAmount !== undefined ? tx.originalAmount : tx.amount;
      const updatedTx: DRETransaction = {
        ...tx,
        amount: Math.abs(newNum),
        originalAmount: originalVal,
        isEdited: true,
        updatedAt: new Date().toISOString(),
      };
      onUpdateTransaction(updatedTx);
    }
    setEditingCellId(null);
  };

  // Handle keypress inside inline input (Enter = save, Escape = cancel)
  const handleKeyDownInline = (e: React.KeyboardEvent, tx: DRETransaction) => {
    if (e.key === 'Enter') {
      handleSaveInlineEdit(tx);
    } else if (e.key === 'Escape') {
      setEditingCellId(null);
    }
  };

  const getStatusBadge = (tx: DRETransaction) => {
    if (tx.status === 'realizado') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Realizado
        </span>
      );
    }
    if (tx.status === 'projetado') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
          Projetado (Futuro) {tx.isAutoForecast && '⚡'}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400 border border-purple-500/30">
        Previsto Inicial (Viabilidade)
      </span>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Actions */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Consulta da Base de Dados Importada</h3>
            <p className="text-xs text-slate-400">
              Total de {filtered.length} lançamentos (Clique diretamente sobre qualquer valor para editar)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Lançamento Manual</span>
          </button>

          <button
            onClick={onClearAllTransactions}
            className="flex items-center space-x-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-xl transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Banco</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por projeto, descrição, arquivo ou aba..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            aria-label="Filtrar por Projeto"
            className="w-full bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-dark-800">Todos os Projetos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.name} className="bg-dark-800">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5">
          <select
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            aria-label="Filtrar por Linha DRE"
            className="w-full bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-dark-800">Todas as Linhas DRE</option>
            {DRE_LINE_DEFINITIONS.filter((d) => !d.isCalculated).map((d) => (
              <option key={d.key} value={d.key} className="bg-dark-800">
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por Status Contábil"
            className="w-full bg-transparent text-xs text-slate-200 font-medium focus:outline-none cursor-pointer"
          >
            <option value="all" className="bg-dark-800">Todos os Status</option>
            <option value="realizado" className="bg-dark-800">Realizado (Efetivado)</option>
            <option value="projetado" className="bg-dark-800">Projetado (Futuro)</option>
            <option value="previsto_inicial" className="bg-dark-800">Previsto Inicial (Viabilidade Base)</option>
          </select>
        </div>
      </div>

      {/* Data Table with Direct Inline Cell Editing */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-xs text-left text-slate-300 border-collapse">
            <thead className="bg-slate-900 text-slate-400 font-semibold sticky top-0 z-10 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 border-r border-slate-800">Data/Competência</th>
                <th className="px-4 py-3 border-r border-slate-800">Projeto / Obra</th>
                <th className="px-4 py-3 border-r border-slate-800">Linha DRE Mapeada</th>
                <th className="px-4 py-3 border-r border-slate-800 text-right">Valor (R$) ✏️</th>
                <th className="px-4 py-3 border-r border-slate-800 text-center">Status Contábil</th>
                <th className="px-4 py-3 border-r border-slate-800">Descrição</th>
                <th className="px-4 py-3 border-r border-slate-800 text-blue-400">
                  <div className="flex items-center space-x-1">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Arquivo de Origem</span>
                  </div>
                </th>
                <th className="px-4 py-3 border-r border-slate-800 text-indigo-400">
                  <div className="flex items-center space-x-1">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Aba de Origem</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    Nenhum lançamento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 font-mono text-slate-300 border-r border-slate-800/50">{tx.date}</td>
                    <td className="px-4 py-2.5 font-semibold text-blue-400 border-r border-slate-800/50">{tx.project}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-200 border-r border-slate-800/50">
                      {DRE_LINE_DEFINITIONS.find((d) => d.key === tx.dreLineKey)?.label || tx.dreLineKey}
                    </td>

                    {/* DIRECT INLINE EDITING AMOUNT CELL */}
                    <td className="px-3 py-1.5 border-r border-slate-800/50 text-right">
                      {editingCellId === tx.id ? (
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={editingCellVal}
                          onChange={(e) => setEditingCellVal(e.target.value)}
                          onBlur={() => handleSaveInlineEdit(tx)}
                          onKeyDown={(e) => handleKeyDownInline(e, tx)}
                          className="w-32 bg-slate-900 border-2 border-blue-500 rounded-lg px-2 py-1 text-right font-mono font-bold text-emerald-400 focus:outline-none shadow-lg"
                        />
                      ) : (
                        <div
                          onClick={() => handleStartInlineEdit(tx)}
                          title="Clique para editar este valor diretamente"
                          className="inline-flex items-center justify-end space-x-1.5 group relative cursor-pointer px-2 py-1 rounded hover:bg-blue-600/10 hover:border hover:border-blue-500/40 transition-all"
                        >
                          {tx.isEdited && tx.originalAmount !== undefined && (
                            <>
                              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-amber-400/50 shadow-sm animate-pulse" />
                              {/* Hover Tooltip */}
                              <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block z-30 w-56 p-2.5 bg-slate-900 border border-amber-500/50 rounded-xl shadow-2xl text-left text-[11px] text-slate-200">
                                <div className="flex items-center space-x-1 text-amber-400 font-bold mb-1">
                                  <Info className="w-3.5 h-3.5" />
                                  <span>Modificado manualmente!</span>
                                </div>
                                <p className="text-slate-300">
                                  Valor original importado:{' '}
                                  <strong className="text-amber-400 font-mono">
                                    {tx.originalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </strong>
                                </p>
                              </div>
                            </>
                          )}
                          <span className={tx.isEdited ? 'text-amber-300 font-mono font-bold' : 'text-emerald-400 font-mono font-bold'}>
                            {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-center border-r border-slate-800/50">
                      {getStatusBadge(tx)}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 border-r border-slate-800/50 truncate max-w-xs">{tx.description}</td>
                    <td className="px-4 py-2.5 text-blue-300 font-mono text-[11px] border-r border-slate-800/50 truncate max-w-xs">
                      {tx.sourceFile || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-indigo-300 font-mono text-[11px] border-r border-slate-800/50 truncate max-w-xs">
                      {tx.sourceSheet || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Excluir lançamento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-slate-100">Adicionar Lançamento Financeiro Manual</h4>
            <form onSubmit={handleManualAdd} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Projeto / Obra:</label>
                <select
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Mês / Competência (YYYY-MM):</label>
                <input
                  type="month"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Linha DRE:</label>
                <select
                  value={newLineKey}
                  onChange={(e) => setNewLineKey(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                >
                  {DRE_LINE_DEFINITIONS.filter((d) => !d.isCalculated).map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Valor (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Status Contábil:</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TransactionStatus)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                >
                  <option value="realizado">Realizado (Efetivado)</option>
                  <option value="projetado">Projetado (Futuro)</option>
                  <option value="previsto_inicial">Previsto Inicial (Viabilidade Base)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Arquivo de Origem:</label>
                <input
                  type="text"
                  value={newSourceFile}
                  onChange={(e) => setNewSourceFile(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Aba de Origem:</label>
                <input
                  type="text"
                  value={newSourceSheet}
                  onChange={(e) => setNewSourceSheet(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Descrição:</label>
                <input
                  type="text"
                  placeholder="Ex: Nota fiscal 1234 - Serviço de Engenharia"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-600/25"
                >
                  Salvar Lançamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
