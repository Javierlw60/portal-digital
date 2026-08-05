export type ProductoImportRow = {
  codigo_barras: string | null;
  nombre_articulo: string;
  marca: string | null;
  presentacion: string | null;
  precio: number;
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if ((ch === ',' || ch === ';') && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

const HEADER_MAP: Record<string, keyof ProductoImportRow | 'skip'> = {
  codigo_barras: 'codigo_barras',
  codigo: 'codigo_barras',
  ean: 'codigo_barras',
  barcode: 'codigo_barras',
  nombre_articulo: 'nombre_articulo',
  nombre: 'nombre_articulo',
  producto: 'nombre_articulo',
  articulo: 'nombre_articulo',
  marca: 'marca',
  presentacion: 'presentacion',
  precio: 'precio',
  price: 'precio',
};

/**
 * Parsea CSV/TSV (Excel → Guardar como CSV).
 * Encabezados esperados: codigo_barras, nombre_articulo, marca, presentacion, precio
 */
export function parseProductosCsv(text: string): {
  rows: ProductoImportRow[];
  errors: string[];
} {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { rows: [], errors: ['Archivo vacío.'] };

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ['El archivo necesita encabezado y al menos una fila.'] };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  const indexes: Partial<Record<keyof ProductoImportRow, number>> = {};

  headers.forEach((h, i) => {
    const mapped = HEADER_MAP[h];
    if (mapped && mapped !== 'skip') indexes[mapped] = i;
  });

  if (indexes.nombre_articulo === undefined || indexes.precio === undefined) {
    return {
      rows: [],
      errors: [
        'Faltan columnas obligatorias: nombre_articulo (o nombre) y precio. Exportá desde Excel como CSV.',
      ],
    };
  }

  const rows: ProductoImportRow[] = [];
  const errors: string[] = [];

  for (let li = 1; li < lines.length; li++) {
    const cells = splitCsvLine(lines[li]);
    if (cells.every((c) => !c)) continue;

    const nombre =
      indexes.nombre_articulo !== undefined
        ? cells[indexes.nombre_articulo]?.trim() || ''
        : '';
    const precioRaw =
      indexes.precio !== undefined ? cells[indexes.precio]?.trim() || '' : '';
    // Acepta 12.50 o 12,50 (si hay ambos, asume miles con punto y decimal con coma)
    let normalized = precioRaw.replace(/\s/g, '');
    if (normalized.includes(',') && normalized.includes('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(',', '.');
    }
    const precioFinal = Number(normalized);

    if (!nombre) {
      errors.push(`Fila ${li + 1}: nombre vacío.`);
      continue;
    }
    if (!Number.isFinite(precioFinal) || precioFinal < 0) {
      errors.push(`Fila ${li + 1}: precio inválido (${precioRaw}).`);
      continue;
    }

    const codigo =
      indexes.codigo_barras !== undefined
        ? cells[indexes.codigo_barras]?.trim() || null
        : null;
    const marca =
      indexes.marca !== undefined ? cells[indexes.marca]?.trim() || null : null;
    const presentacion =
      indexes.presentacion !== undefined
        ? cells[indexes.presentacion]?.trim() || null
        : null;

    rows.push({
      codigo_barras: codigo,
      nombre_articulo: nombre,
      marca,
      presentacion,
      precio: Math.round(precioFinal * 100) / 100,
    });
  }

  return { rows, errors };
}
