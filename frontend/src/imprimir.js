// Genera un documento A4 imprimible (el usuario elige "Guardar como PDF" en el diálogo de impresión).
// La ventana de impresión es un documento aparte (sin Tailwind), por eso los estilos viven acá.

export const escaparHtml = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ESTILOS_A4 = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", Arial, Helvetica, sans-serif; color: #0f172a; font-size: 11px; margin: 0; line-height: 1.45; }

  .membrete { display: flex; justify-content: space-between; align-items: stretch; background: #0f172a; color: #fff;
    border-radius: 4px; margin-bottom: 16px; overflow: hidden; }
  .membrete .empresa { padding: 12px 16px; border-left: 6px solid #f59e0b; }
  .membrete .empresa h1 { margin: 0; font-size: 17px; letter-spacing: 1px; }
  .membrete .empresa p { margin: 3px 0 0; font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; }
  .membrete .doc { padding: 12px 16px; text-align: right; align-self: center; }
  .membrete .doc strong { font-size: 14px; text-transform: uppercase; letter-spacing: .5px; }
  .membrete .doc p { margin: 3px 0 0; font-size: 9px; color: #94a3b8; }

  .meta { display: flex; justify-content: space-between; align-items: stretch; gap: 12px; margin-bottom: 16px; }
  .meta > div:first-child { flex: 1; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; background: #f8fafc; }
  .total { background: #0f172a; color: #fff; padding: 10px 16px; border-radius: 4px; text-align: right; min-width: 150px; }
  .total span { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; }
  .total strong { font-size: 18px; }

  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .5px; color: #0f172a;
    margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #0f172a; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left;
    font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #334155; }
  td { border: 1px solid #cbd5e1; padding: 5px 8px; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tr { page-break-inside: avoid; }
  tfoot td { background: #e2e8f0; font-weight: bold; border-top: 2px solid #0f172a; }

  .num { text-align: right; white-space: nowrap; }
  .alerta { color: #b91c1c; font-weight: bold; }
  .sub { color: #64748b; font-size: 9px; }
  .pie { margin: 14px 0; font-size: 9px; color: #64748b; }

  .pie-pagina { position: fixed; bottom: 0; left: 0; right: 0; border-top: 1px solid #cbd5e1;
    padding-top: 5px; font-size: 8px; color: #64748b; display: flex; justify-content: space-between; }
`;

export const abrirImpresionA4 = ({ titulo, documento, cuerpo }) => {
  const fecha = new Date().toLocaleString('es-AR');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
    <title>${escaparHtml(titulo)}</title><style>${ESTILOS_A4}</style></head><body>
    <div class="membrete">
      <div class="empresa"><h1>IMCAYPER S.A.</h1><p>Sistema de Gestión de Pañol</p></div>
      <div class="doc"><strong>${escaparHtml(documento)}</strong><p>Emitido el ${fecha}</p></div>
    </div>
    ${cuerpo}
    <div class="pie-pagina">
      <span>Generado automáticamente por el Sistema de Gestión IMCAYPER · ${fecha}</span>
      <span>Documento interno válido sin firma manuscrita</span>
    </div>
    <script>window.onload = function () { window.print(); };</script>
    </body></html>`;

  const ventana = window.open('', '_blank');
  if (!ventana) {
    alert('El navegador bloqueó la ventana emergente. Permití ventanas emergentes para este sitio y volvé a intentar.');
    return;
  }
  ventana.document.write(html);
  ventana.document.close();
  ventana.focus();
};
