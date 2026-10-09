import type { Product, SalesReport } from '../types/pos';

/*
 * Reportes en PDF generados en el celular (sin servidor ni internet). jsPDF se carga recién al
 * pedir un reporte para no pesar en el inicio de la app.
 */

const INK: [number, number, number] = [31, 42, 48];
const MUTED: [number, number, number] = [74, 90, 98];
const BRAND: [number, number, number] = [11, 122, 99];
const FRESA: [number, number, number] = [217, 58, 85];

const money = (n: number | null | undefined) => `S/ ${(Number(n) || 0).toFixed(2)}`;

async function newDoc(title: string, subtitle: string, storeName: string) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 4, 'F');
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(storeName, 14, 14);
  doc.text(`Generado: ${new Date().toLocaleString('es-PE')}`, W - 14, 14, { align: 'right' });
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(title, 14, 26);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  doc.text(subtitle, 14, 33);
  return { doc, autoTable, W };
}

const tableStyle = {
  styles: { font: 'helvetica', fontSize: 10, textColor: INK, cellPadding: 2.2, lineColor: [227, 231, 225] as [number, number, number], lineWidth: 0.1 },
  headStyles: { fillColor: [242, 244, 239] as [number, number, number], textColor: INK, fontStyle: 'bold' as const },
  margin: { left: 14, right: 14 },
};

/** Reporte de ventas del período: totales, ventas por día/hora, productos, vendedores y pagos. */
export async function buildSalesPdf(report: SalesReport, storeName: string, periodLabel: string): Promise<Blob> {
  const { doc, autoTable, W } = await newDoc('Reporte de ventas', periodLabel, storeName);
  const t = report.totals;
  const delta = t.previousSales > 0 ? ((t.sales - t.previousSales) / t.previousSales) * 100 : null;

  // Totales en dos columnas
  const kpis: [string, string][] = [
    ['Vendido', money(t.sales)],
    ['Pedidos', String(t.orders)],
    ['Ticket promedio', money(t.avgTicket)],
    ['Cobrado', money(t.collected)],
    ['Vendido al fiado / crédito', money(t.fiado)],
    ['Ganancia estimada', t.profit === null ? 'Sin costos cargados' : money(t.profit)],
    ['Unidades vendidas', String(t.units)],
    ['Pedidos anulados', String(t.cancelled)],
  ];
  let y = 42;
  doc.setFontSize(10);
  kpis.forEach(([label, value], i) => {
    const x = i % 2 === 0 ? 14 : W / 2 + 4;
    if (i % 2 === 0 && i > 0) y += 13;
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x, y);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(value, x, y + 6);
    doc.setFontSize(10);
  });
  y += 14;
  if (delta !== null) {
    doc.setTextColor(...(delta >= 0 ? BRAND : FRESA));
    doc.setFont('helvetica', 'bold');
    doc.text(`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% frente al período anterior (${money(t.previousSales)})`, 14, y);
    y += 6;
  }

  const sections: { title: string; head: string[]; body: (string | number)[][] }[] = [
    {
      title: report.granularity === 'hour' ? 'Ventas por hora' : 'Ventas por día',
      head: [report.granularity === 'hour' ? 'Hora' : 'Fecha', 'Pedidos', 'Vendido'],
      body: report.series.filter(s => s.orders > 0 || report.granularity === 'day').map(s => [
        report.granularity === 'hour' ? `${s.key}:00` : new Date(`${s.key}T12:00:00`).toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }),
        s.orders, money(s.sales),
      ]),
    },
    { title: 'Productos más vendidos', head: ['Producto', 'Unidades', 'Vendido'], body: report.topProducts.map(p => [p.name, p.units, money(p.revenue)]) },
    { title: 'Ventas por vendedor', head: ['Vendedor', 'Pedidos', 'Vendido'], body: report.bySeller.map(s => [s.name, s.orders, money(s.sales)]) },
    { title: 'Cobros por medio de pago', head: ['Medio', 'Monto'], body: report.byPayment.map(p => [p.method, money(p.amount)]) },
    { title: 'Ventas por categoría', head: ['Categoría', 'Vendido'], body: report.byCategory.map(c => [c.category, money(c.revenue)]) },
  ];
  for (const s of sections) {
    if (s.body.length === 0) continue;
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    y += 6;
    if (y > 260) { doc.addPage(); y = 20; }
    doc.text(s.title, 14, y);
    autoTable(doc, {
      ...tableStyle, startY: y + 3, head: [s.head], body: s.body,
      columnStyles: { [s.head.length - 1]: { halign: 'right', fontStyle: 'bold' } },
      // El título de una columna de montos se alinea igual que sus valores.
      didParseCell: d => { if (d.section === 'head' && d.column.index === s.head.length - 1) d.cell.styles.halign = 'right'; },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  }
  return doc.output('blob');
}

/** Reporte de inventario: productos agotados y por agotarse, con lo que conviene reponer. */
export async function buildStockPdf(out: Product[], low: Product[], storeName: string): Promise<Blob> {
  const { doc, autoTable } = await newDoc('Productos por reponer',
    `${out.length} ${out.length === 1 ? 'agotado' : 'agotados'} y ${low.length} por agotarse`, storeName);
  let y = 42;
  const groups: { title: string; color: [number, number, number]; items: Product[] }[] = [
    { title: 'Agotados', color: FRESA, items: out },
    { title: 'Por agotarse', color: [180, 120, 0], items: low },
  ];
  for (const g of groups) {
    doc.setTextColor(...g.color);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`${g.title} (${g.items.length})`, 14, y);
    if (g.items.length === 0) {
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Ninguno.', 14, y + 6);
      y += 14;
      continue;
    }
    autoTable(doc, {
      ...tableStyle, startY: y + 3,
      head: [['Producto', 'Código', 'Stock', 'Mínimo', 'Sugerido reponer']],
      body: g.items.map(p => {
        const suggested = Math.max(p.minStockAlert * 2 - p.stockInBaseUnits, p.minStockAlert);
        return [p.name, p.barcode, `${p.stockInBaseUnits} ${p.baseUnitName}s`, String(p.minStockAlert), `${suggested} ${p.baseUnitName}s`];
      }),
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
      didParseCell: d => { if (d.section === 'head' && d.column.index >= 2) d.cell.styles.halign = 'right'; },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }
  return doc.output('blob');
}
