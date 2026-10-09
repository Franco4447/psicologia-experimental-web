import ExcelJS from 'exceljs';

/**
 * Exportación a Excel de la vista de una fila por participante
 * (public.v_dataset_participantes).
 *
 * Reglas de formato, para que el archivo abra sin errores ni conversiones:
 *  - Las columnas de texto se escriben como cadenas con formato "@" (Texto): Excel
 *    no las reinterpreta como fechas, notación científica ni fórmulas.
 *  - Las columnas numéricas se escriben como números reales (no como texto), de
 *    modo que no aparece el triángulo verde "número almacenado como texto".
 *  - Los valores nulos quedan como celdas vacías.
 */

type ColumnKind = 'text' | 'integer' | 'decimal';

interface ColumnSpec {
  key: string;
  kind: ColumnKind;
  width: number;
}

export const PARTICIPANT_COLUMNS: readonly ColumnSpec[] = [
  { key: 'id_participante', kind: 'text', width: 38 },
  { key: 'edad', kind: 'integer', width: 8 },
  { key: 'genero', kind: 'text', width: 16 },
  { key: 'universidad', kind: 'text', width: 46 },
  { key: 'grupo_induccion', kind: 'text', width: 16 },
  { key: 'orientacion_terapeutica', kind: 'text', width: 26 },
  { key: 'induccion_reportada', kind: 'text', width: 28 },
  { key: 'emocion_reportada', kind: 'text', width: 28 },
  { key: 'razon_reportada', kind: 'text', width: 28 },
  { key: 'false_memory', kind: 'integer', width: 14 },
  { key: 'false_belief', kind: 'integer', width: 14 },
  { key: 'true_memory', kind: 'integer', width: 14 },
  { key: 'promedio_segs_respuesta', kind: 'decimal', width: 24 },
];

const NUMBER_FORMATS: Record<ColumnKind, string> = {
  text: '@',
  integer: '0',
  decimal: '0.00',
};

function toCellValue(kind: ColumnKind, raw: unknown): string | number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (kind === 'text') return String(raw);
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function buildParticipantsXlsx(
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Plataforma Psicología Experimental';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Participantes', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = PARTICIPANT_COLUMNS.map((col) => ({
    header: col.key,
    key: col.key,
    width: col.width,
    style: { numFmt: NUMBER_FORMATS[col.kind] },
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle' };
  header.eachCell((cell) => {
    cell.numFmt = '@';
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  });

  for (const row of rows) {
    sheet.addRow(
      PARTICIPANT_COLUMNS.map((col) => toCellValue(col.kind, row[col.key]))
    );
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: PARTICIPANT_COLUMNS.length },
  };

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
