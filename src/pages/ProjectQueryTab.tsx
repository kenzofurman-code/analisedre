import React, { useState } from 'react';
import { ProjectContract } from '../types/dre';
import { Search, Building2, Trash2, Plus, RefreshCw, Briefcase, Clock, FileText, AlertTriangle } from 'lucide-react';

interface ProjectQueryTabProps {
  projects: ProjectContract[];
  onDeleteProject: (projectId: string) => void;
  onClearAllProjects: () => void;
  onAddProject: (project: ProjectContract) => void;
  onResetProjects: () => void;
}

export const ProjectQueryTab: React.FC<ProjectQueryTabProps> = ({
  projects,
  onDeleteProject,
  onClearAllProjects,
  onAddProject,
  onResetProjects,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Project Form State
  const [newName, setNewName] = useState<string>('');
  const [newType, setNewType] = useState<'Terceiros' | 'Interna'>('Terceiros');
  const [newStartDate, setNewStartDate] = useState<string>('2024-01-01');
  const [newBaselineEnd, setNewBaselineEnd] = useState<string>('2025-12-01');
  const [newReplannedEnd, setNewReplannedEnd] = useState<string>('2025-12-01');
  const [newInitialMonths, setNewInitialMonths] = useState<number>(24);
  const [newContractValue, setNewContractValue] = useState<number>(10000000);
  const [newOrcamentoRaso, setNewOrcamentoRaso] = useState<number>(8000000);
  const [newProjecaoRaso, setNewProjecaoRaso] = useState<number>(8000000);
  const [newOrcamentoTotal, setNewOrcamentoTotal] = useState<number>(10000000);
  const [newProjecaoTotal, setNewProjecaoTotal] = useState<number>(10000000);

  const filtered = projects.filter((p) => {
    if (typeFilter !== 'all' && p.type !== typeFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchName = p.name.toLowerCase().includes(term);
      const matchNotes = p.clausulaCusto?.toLowerCase().includes(term);
      if (!matchName && !matchNotes) return false;
    }
    return true;
  });

  const formatMoney = (val?: number) => {
    if (val === undefined || val === null) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
  };

  const handleManualAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const resultRaso = newOrcamentoRaso - newProjecaoRaso;
    const resultTotal = newOrcamentoTotal - newProjecaoTotal;

    const newProj: ProjectContract = {
      id: `proj-${Date.now()}`,
      name: newName.trim(),
      type: newType,
      startDate: newStartDate,
      baselineEndDate: newBaselineEnd,
      replannedEndDate: newReplannedEnd,
      initialMonths: newInitialMonths,
      realMonths: newInitialMonths,
      contractValue: newContractValue,
      orcamentoRasoReajustado: newOrcamentoRaso,
      projecaoRasoAtual: newProjecaoRaso,
      resultadoRasoAtual: resultRaso,
      orcamentoTotalReajustado: newOrcamentoTotal,
      projectedCostAtCompletion: newProjecaoTotal,
      resultAtCompletion: resultTotal,
      premioEconomia: resultTotal > 0 ? resultTotal * 0.4 : 0,
      bandaPercent: 0.05,
      estimatedMonthlyTeamCost: 28000,
    };

    onAddProject(newProj);
    setShowAddModal(false);
    setNewName('');
  };

  // Helper Renderer for 4 Specific Cost Lines requested by user
  const render4CostLines = (p: ProjectContract) => {
    // Line 1: Orçamento Raso (Reajustado vs Projeção Atual)
    const baseRaso = p.orcamentoRasoReajustado || 0;
    const projRaso = p.projecaoRasoAtual !== undefined ? p.projecaoRasoAtual : baseRaso;
    const hasRasoDiff = baseRaso > 0 && Math.abs(projRaso - baseRaso) > 0.01;
    const isRasoIncrease = projRaso > baseRaso;

    // Line 2: Resultado Raso
    const resultRaso = p.resultadoRasoAtual !== undefined ? p.resultadoRasoAtual : (baseRaso - projRaso);

    // Line 3: Custo Total (Reajustado vs Projeção Total)
    const baseTotal = p.orcamentoTotalReajustado || p.contractValue || 0;
    const projTotal = p.projectedCostAtCompletion !== undefined ? p.projectedCostAtCompletion : baseTotal;
    const hasTotalDiff = baseTotal > 0 && Math.abs(projTotal - baseTotal) > 0.01;
    const isTotalIncrease = projTotal > baseTotal;

    // Line 4: Resultado Total
    const resultTotal = p.resultAtCompletion !== undefined ? p.resultAtCompletion : (baseTotal - projTotal);

    return (
      <div className="space-y-2 text-[11px] bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        {/* Linha 1: Orçamento Raso */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <span className="text-slate-400 font-semibold">1. Orçamento Raso:</span>
          <div className="font-mono font-bold flex items-center space-x-1.5">
            <span className="text-slate-300">{formatMoney(baseRaso)}</span>
            {hasRasoDiff && (
              <>
                <span className="text-slate-500">➡️</span>
                <span className={isRasoIncrease ? 'text-rose-400' : 'text-emerald-400'}>
                  {formatMoney(projRaso)}
                </span>
                <span title={isRasoIncrease ? 'Aumento de custo raso' : 'Redução de custo raso'}>
                  {isRasoIncrease ? '🔺' : '🔻'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Linha 2: Resultado Raso */}
        <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
          <span className="text-slate-400 font-semibold">2. Resultado Raso:</span>
          <span className={`font-mono font-bold ${resultRaso >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatMoney(resultRaso)}
          </span>
        </div>

        {/* Linha 3: Custo Total */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-800/60">
          <span className="text-slate-400 font-semibold">3. Custo Total:</span>
          <div className="font-mono font-bold flex items-center space-x-1.5">
            <span className="text-slate-300">{formatMoney(baseTotal)}</span>
            {hasTotalDiff && (
              <>
                <span className="text-slate-500">➡️</span>
                <span className={isTotalIncrease ? 'text-rose-400' : 'text-emerald-400'}>
                  {formatMoney(projTotal)}
                </span>
                <span title={isTotalIncrease ? 'Aumento de custo total' : 'Redução de custo total'}>
                  {isTotalIncrease ? '🔺' : '🔻'}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Linha 4: Resultado Total */}
        <div className="flex justify-between items-center pt-1 border-t border-slate-800/60">
          <span className="text-slate-400 font-semibold">4. Resultado Total:</span>
          <span className={`font-mono font-bold ${resultTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatMoney(resultTotal)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Banner & Management Actions */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">Cadastro & Base de Dados de Projetos</h3>
            <p className="text-xs text-slate-400">Total de {filtered.length} obras cadastradas (INFORMAÇÕES_PROJETOS)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Projeto Manual</span>
          </button>

          <button
            onClick={onResetProjects}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all"
            title="Recarregar projetos padrão"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <button
            onClick={onClearAllProjects}
            className="flex items-center space-x-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold rounded-xl transition-all"
            title="Limpar todos os projetos do banco de dados"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Tabela de Projetos</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar obra por nome ou cláusula..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-400">Filtrar por Tipologia:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Todas as Tipologias (Terceiros & Interna)</option>
            <option value="Terceiros">Terceiros (Obras Contratadas Externas)</option>
            <option value="Interna">Interna (Desenvolvimento Próprio)</option>
          </select>
        </div>
      </div>

      {/* Grid of Projects */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-12 text-center text-slate-500 rounded-2xl">
          Nenhum projeto encontrado no cadastro. Clique em "Novo Projeto Manual" ou importe a planilha INFORMAÇÕES_PROJETOS.xlsx.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((p) => (
            <div key={p.id || p.name} className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all space-y-4">
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                    {p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100">{p.name}</h4>
                    <span className="text-[11px] text-slate-400">
                      Tipologia: <strong className="text-slate-200">{p.type}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      p.type === 'Terceiros'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {p.type}
                  </span>

                  <button
                    onClick={() => onDeleteProject(p.id)}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Excluir obra do cadastro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* General Metadata */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                <div>
                  <span className="text-slate-400 font-semibold block">Valor do Contrato:</span>
                  <span className="text-emerald-400 font-mono font-bold text-xs">{formatMoney(p.contractValue)}</span>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block">Prazo Obra (Meses):</span>
                  <span className="text-slate-200 font-mono font-bold text-xs">{p.initialMonths} meses</span>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block">Data Início (Base):</span>
                  <span className="text-blue-300 font-mono">{p.startDate}</span>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block">Término Replanejado:</span>
                  <span className="text-amber-300 font-mono">{p.replannedEndDate}</span>
                </div>
              </div>

              {/* 4 COST LINES WITH VARIATION ARROWS & TRIANGLES */}
              {render4CostLines(p)}

              {/* Clauses */}
              {p.clausulaCusto && (
                <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40 line-clamp-3">
                  💡 <strong>Cláusula Custo:</strong> "{p.clausulaCusto}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Manual Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h4 className="text-base font-bold text-slate-100">Cadastrar Novo Projeto / Obra</h4>
            <form onSubmit={handleManualAddProject} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Nome da Obra:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Obra Residencial Alpha"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Tipologia Contratual:</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                >
                  <option value="Terceiros">Terceiros (Obra Externa Contratada)</option>
                  <option value="Interna">Interna (Desenvolvimento Próprio)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Data Início:</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Prazo (Meses):</label>
                  <input
                    type="number"
                    value={newInitialMonths}
                    onChange={(e) => setNewInitialMonths(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-3 py-2 mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Valor do Contrato (R$):</label>
                <input
                  type="number"
                  step="0.01"
                  value={newContractValue}
                  onChange={(e) => setNewContractValue(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-emerald-400 font-mono font-bold rounded-xl px-3 py-2 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-300">Orçamento Raso (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newOrcamentoRaso}
                    onChange={(e) => setNewOrcamentoRaso(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono rounded-xl px-3 py-2 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300">Projeção Raso (R$):</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newProjecaoRaso}
                    onChange={(e) => setNewProjecaoRaso(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono rounded-xl px-3 py-2 mt-1"
                  />
                </div>
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
                  Cadastrar Projeto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
