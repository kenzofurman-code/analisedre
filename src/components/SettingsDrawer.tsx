import React from 'react';
import { GlobalFinancialSettings, TeamCostMode, AdmAllocationMode } from '../types/dre';
import { X, Sliders, Calculator, Percent, Layers, Landmark } from 'lucide-react';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GlobalFinancialSettings;
  onUpdateSettings: (newSettings: Partial<GlobalFinancialSettings>) => void;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-dark-800 border-l border-slate-800 shadow-2xl flex flex-col justify-between p-6">
          {/* Header */}
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Parâmetros & Regras Financeiras</h3>
                  <p className="text-xs text-slate-400">Configurações globais de cálculo do DRE</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                aria-label="Fechar drawer de configurações"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Section 1: Custo Equipe */}
            <div className="glass-panel p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <Calculator className="w-4 h-4" />
                <span>1. Modo Custo Equipe (MO)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Escolha se o custo da equipe de engenharia é extraído da planilha de lançamentos ou calculado por orçamento.
              </p>
              <select
                value={settings.teamCostMode}
                onChange={(e) => onUpdateSettings({ teamCostMode: e.target.value as TeamCostMode })}
                aria-label="Modo Custo Equipe"
                className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 font-semibold rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
              >
                <option value="real">Custo Real (Lançamentos / Planilha MO)</option>
                <option value="estimado">Custo Estimado (Orçamento Mensal por Obra)</option>
              </select>
            </div>

            {/* Form Section 2: Despesas ADM & Rateio */}
            <div className="glass-panel p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Layers className="w-4 h-4" />
                <span>2. Rateio de Despesas ADM (Sede)</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Percentual Despesa ADM (%):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.admExpensePercent}
                    onChange={(e) => onUpdateSettings({ admExpensePercent: parseFloat(e.target.value) || 0 })}
                    aria-label="Percentual Despesa ADM"
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-amber-400 font-mono font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Forma de Rateio entre Obras:</label>
                <select
                  value={settings.admAllocationMode}
                  onChange={(e) => onUpdateSettings({ admAllocationMode: e.target.value as AdmAllocationMode })}
                  aria-label="Forma de Rateio entre Obras"
                  className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-100 font-semibold rounded-xl px-3 py-2"
                >
                  <option value="receita">Rateio Proporcional pela Receita</option>
                  <option value="simples">Rateio Igual por Projeto Ativo</option>
                </select>
              </div>
            </div>

            {/* Form Section 3: Impostos e Tributação (Cálculo quando não importado) */}
            <div className="glass-panel p-4 rounded-2xl space-y-3">
              <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider">
                <Landmark className="w-4 h-4" />
                <span>3. Impostos (Cálculo por Fórmula)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Se uma planilha não contiver o lançamento explícito dos impostos, o DRE calculará automaticamente usando estas alíquotas:
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">% Impostos sobre Faturamento (PIS + COFINS + ISS):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.taxRatePercent}
                    onChange={(e) => onUpdateSettings({ taxRatePercent: parseFloat(e.target.value) || 0 })}
                    aria-label="Percentual Impostos Faturamento"
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-indigo-300 font-mono font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">% Impostos sobre o Lucro (IRPJ + CSLL):</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={settings.irpjCsllPercent}
                    onChange={(e) => onUpdateSettings({ irpjCsllPercent: parseFloat(e.target.value) || 0 })}
                    aria-label="Percentual IRPJ e CSLL"
                    className="w-full bg-slate-900 border border-slate-700 text-xs text-indigo-300 font-mono font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Close Button */}
          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-600/25 transition-all"
            >
              Aplicar & Salvar Configurações
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
