import * as XLSX from 'xlsx';
import { MonthlyDREColumn, GlobalFinancialSettings } from '../types/dre';
import { DRE_LINE_DEFINITIONS } from '../constants/dreStructure';

export interface ExportDRETimelineOptions {
  displayColumns: MonthlyDREColumn[];
  settings: GlobalFinancialSettings;
  selectedProjects: string[];
  viewMode: 'all' | 'year';
  selectedYear: string;
}

function getColLetter(colIdx: number): string {
  let letter = '';
  let temp = colIdx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Exporta a visão temporal ativa da matriz DRE para Excel (.xlsx) com fórmulas dinâmicas,
 * permitindo que o usuário altere qualquer valor no Excel e os cálculos e totais se atualizem automaticamente.
 */
export function exportDRETimelineToExcel({
  displayColumns,
  settings,
  selectedProjects,
  viewMode,
  selectedYear,
}: ExportDRETimelineOptions): void {
  if (displayColumns.length === 0) {
    alert('Nenhum dado mensal ativo disponível para exportar no período selecionado.');
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const numMonths = displayColumns.length;
  const firstMonthCol = 'C';
  const lastMonthCol = getColLetter(2 + numMonths - 1);

  // Metadata headers
  const projectLabel =
    selectedProjects.includes('all') || selectedProjects.length === 0
      ? 'Global (Todos os Projetos)'
      : selectedProjects.length === 1
      ? selectedProjects[0]
      : `${selectedProjects.length} Projetos Selecionados (${selectedProjects.join(', ')})`;

  const periodLabel = viewMode === 'all' ? 'Todos os Anos' : `Ano ${selectedYear}`;
  const now = new Date();
  const dateFormatted = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR');

  // Header rows 1 to 4
  ws['A1'] = { t: 's', v: 'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE) - ANÁLISE TEMPORAL' };
  ws['A2'] = { t: 's', v: `Projeto / Obra: ${projectLabel}  |  Período: ${periodLabel}  |  Exportado em: ${dateFormatted}` };
  ws['A3'] = {
    t: 's',
    v: `Parâmetros: Impostos (${settings.taxRatePercent}%) | ADM (${settings.admExpensePercent}%) [${settings.admAllocationMode}] | IRPJ/CSLL (${settings.irpjCsllPercent}%) | Modo Custo Equipe: ${settings.teamCostMode}`,
  };

  // Row 5: Table Column Headers
  const headerRow = 5;
  ws[`A${headerRow}`] = { t: 's', v: 'DADOS (Linhas DRE)' };
  ws[`B${headerRow}`] = { t: 's', v: viewMode === 'all' ? 'TOTAL PROJETO' : `TOTAL (${selectedYear})` };

  displayColumns.forEach((col, idx) => {
    const colLetter = getColLetter(2 + idx);
    const label = col.isFuture ? `${col.displayLabel} (Previsão)` : col.displayLabel;
    ws[`${colLetter}${headerRow}`] = { t: 's', v: label };
  });

  // Number formats
  const CURRENCY_FMT = '"R$" #,##0;[Red]("-R$" #,##0);"-"';
  const PERCENT_FMT = '0.00%';

  // Data rows start at row 6
  // Row 6: receita_taxa_adm
  // Row 7: permuta_taxa_adm
  // Row 8: receita_mo_adm
  // Row 9: receita_assistencia
  // Row 10: impostos
  // Row 11: despesa_assistencia
  // Row 12: custos_equipe
  // Row 13: custos_deslocamento
  // Row 14: estouro_contratada
  // Row 15: margem_bruta_val
  // Row 16: margem_bruta_pct
  // Row 17: despesas_adm_pie
  // Row 18: resultado
  // Row 19: irpj_csll
  // Row 20: resultado_final
  // Row 21: margem_liquida_pct (Margem Operacional %)
  // Row 22: receita_liquida
  const dataStartRow = 6;

  DRE_LINE_DEFINITIONS.forEach((line, lineIdx) => {
    const r = dataStartRow + lineIdx;
    const key = line.key;

    // Col A: Label
    ws[`A${r}`] = { t: 's', v: line.label };

    const isPercent = key === 'margem_bruta_pct' || key === 'margem_liquida_pct';
    const cellFmt = isPercent ? PERCENT_FMT : CURRENCY_FMT;

    // Col B: Total Formula
    if (key === 'margem_bruta_val') {
      ws[`B${r}`] = {
        t: 'n',
        f: `SUM(B6:B9)-SUM(B10:B14)`,
        v: displayColumns.reduce((acc, col) => acc + (col.values.margem_bruta_val || 0), 0),
        z: cellFmt,
      };
    } else if (key === 'margem_bruta_pct') {
      const totalRev = displayColumns.reduce(
        (acc, col) =>
          acc +
          col.values.receita_taxa_adm +
          col.values.permuta_taxa_adm +
          col.values.receita_mo_adm +
          col.values.receita_assistencia,
        0
      );
      const totalMargem = displayColumns.reduce((acc, col) => acc + col.values.margem_bruta_val, 0);
      const pct = Math.abs(totalRev) > 0.01 ? totalMargem / Math.abs(totalRev) : 0;
      ws[`B${r}`] = {
        t: 'n',
        f: `IF(SUM(B6:B9)<>0, B15/SUM(B6:B9), 0)`,
        v: pct,
        z: cellFmt,
      };
    } else if (key === 'resultado') {
      ws[`B${r}`] = {
        t: 'n',
        f: `B15-B17`,
        v: displayColumns.reduce((acc, col) => acc + (col.values.resultado || 0), 0),
        z: cellFmt,
      };
    } else if (key === 'resultado_final') {
      ws[`B${r}`] = {
        t: 'n',
        f: `B18-B19`,
        v: displayColumns.reduce((acc, col) => acc + (col.values.resultado_final || 0), 0),
        z: cellFmt,
      };
    } else if (key === 'margem_liquida_pct') {
      const totalRev = displayColumns.reduce(
        (acc, col) =>
          acc +
          col.values.receita_taxa_adm +
          col.values.permuta_taxa_adm +
          col.values.receita_mo_adm +
          col.values.receita_assistencia,
        0
      );
      const totalRes = displayColumns.reduce((acc, col) => acc + col.values.resultado_final, 0);
      const pct = Math.abs(totalRev) > 0.01 ? totalRes / Math.abs(totalRev) : 0;
      ws[`B${r}`] = {
        t: 'n',
        f: `IF(SUM(B6:B9)<>0, B20/SUM(B6:B9), 0)`,
        v: pct,
        z: cellFmt,
      };
    } else if (key === 'receita_liquida') {
      ws[`B${r}`] = {
        t: 'n',
        f: `SUM(B6:B9)-B10`,
        v: displayColumns.reduce((acc, col) => acc + (col.values[key] || 0), 0),
        z: cellFmt,
      };
    } else {
      // Sum row across months
      const rowSum = displayColumns.reduce((acc, col) => acc + (col.values[key] || 0), 0);
      ws[`B${r}`] = {
        t: 'n',
        f: `SUM(${firstMonthCol}${r}:${lastMonthCol}${r})`,
        v: rowSum,
        z: cellFmt,
      };
    }

    // Month columns (C, D, E, ...)
    displayColumns.forEach((col, mIdx) => {
      const colLetter = getColLetter(2 + mIdx);
      const rawVal = col.values[key] || 0;

      if (key === 'margem_bruta_val') {
        ws[`${colLetter}${r}`] = {
          t: 'n',
          f: `SUM(${colLetter}6:${colLetter}9)-SUM(${colLetter}10:${colLetter}14)`,
          v: rawVal,
          z: cellFmt,
        };
      } else if (key === 'margem_bruta_pct') {
        ws[`${colLetter}${r}`] = {
          t: 'n',
          f: `IF(SUM(${colLetter}6:${colLetter}9)<>0, ${colLetter}15/SUM(${colLetter}6:${colLetter}9), 0)`,
          v: rawVal / 100,
          z: cellFmt,
        };
      } else if (key === 'resultado') {
        ws[`${colLetter}${r}`] = {
          t: 'n',
          f: `${colLetter}15-${colLetter}17`,
          v: rawVal,
          z: cellFmt,
        };
      } else if (key === 'resultado_final') {
        ws[`${colLetter}${r}`] = {
          t: 'n',
          f: `${colLetter}18-${colLetter}19`,
          v: rawVal,
          z: cellFmt,
        };
      } else if (key === 'margem_liquida_pct') {
        ws[`${colLetter}${r}`] = {
          t: 'n',
          f: `IF(SUM(${colLetter}6:${colLetter}9)<>0, ${colLetter}20/SUM(${colLetter}6:${colLetter}9), 0)`,
          v: rawVal / 100,
          z: cellFmt,
        };
      } else if (key === 'receita_liquida') {
        ws[`${colLetter}${r}`] = {
          t: 'n',
          f: `SUM(${colLetter}6:${colLetter}9)-${colLetter}10`,
          v: rawVal,
          z: cellFmt,
        };
      } else {
        // Direct financial movement value
        ws[`${colLetter}${r}`] = {
          t: 'n',
          v: rawVal,
          z: cellFmt,
        };
      }
    });
  });

  const lastRow = dataStartRow + DRE_LINE_DEFINITIONS.length - 1; // 24
  ws['!ref'] = `A1:${lastMonthCol}${lastRow}`;

  // Column widths
  const colWidths = [
    { wch: 38 }, // Col A (Linhas DRE)
    { wch: 20 }, // Col B (Total)
  ];
  for (let m = 0; m < numMonths; m++) {
    colWidths.push({ wch: 15 });
  }
  ws['!cols'] = colWidths;

  const sheetName = viewMode === 'all' ? 'DRE_Todos_Anos' : `DRE_${selectedYear}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // File Name Clean Sanitization
  const cleanProj = (projectLabel.replace(/[^a-zA-Z0-9_-]/g, '_') || 'DRE').slice(0, 30);
  const cleanPeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Periodo';
  const dateStr = now.toISOString().slice(0, 10);
  const fileName = `DRE_${cleanProj}_${cleanPeriod}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
