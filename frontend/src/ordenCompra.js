import { formatearMoneda, numeroRequerimiento, redondear2, desgloseIva, textoAlicuota, IVA_POR_DEFECTO } from './constants';
import { abrirImpresionA4, escaparHtml } from './imprimir';

export const cantidadAprobada = (p) => p.cantidad_aprobada ?? p.cantidad_solicitada;
// Neto pactado en la OC (cotización aprobada): no cambia aunque al recibir la factura venga distinta
export const precioNetoOC = (p) => p.precio_unitario_oc ?? p.precio_unitario_final ?? 0;
export const subtotalPedido = (p) => redondear2(cantidadAprobada(p) * precioNetoOC(p)); // Neto

// IVA guardado en la OC; las OC previas a esta función toman el de sus pedidos
export const alicuotaOC = (oc) => oc.alicuota_iva ?? oc.pedidos?.[0]?.alicuota_iva ?? IVA_POR_DEFECTO;

// Desglose de la OC: los precios aprobados son netos y el IVA se suma al final
export const totalesOrdenCompra = (pedidos, iva = IVA_POR_DEFECTO) =>
  desgloseIva(pedidos.reduce((s, p) => s + subtotalPedido(p), 0), iva);

// PDF formal de la Orden de Compra, listo para enviar por email al proveedor.
// Se arma con los datos guardados (precio neto pactado e IVA de la OC), así las reimpresiones salen idénticas al original.
export const imprimirOrdenCompra = (oc) => {
  const iva = alicuotaOC(oc);
  const filas = oc.pedidos.map((p, i) => `
    <tr><td class="num">${i + 1}</td>
      <td>${numeroRequerimiento(p.id)}${p.codigo_solicitud ? `<div class="sub">${escaparHtml(p.codigo_solicitud)}</div>` : ''}</td>
      <td><b>${escaparHtml(p.insumo_nombre)}</b></td>
      <td class="num">${cantidadAprobada(p)}</td><td class="num">${formatearMoneda(precioNetoOC(p))}</td>
      <td class="num">${formatearMoneda(subtotalPedido(p))}</td></tr>`).join('');
  const totales = totalesOrdenCompra(oc.pedidos, iva);
  const filaTotal = (etiqueta, valor, estilo = '') =>
    `<tr><td colspan="5" class="num" style="${estilo}">${etiqueta}</td><td class="num" style="${estilo}">${formatearMoneda(valor)}</td></tr>`;

  abrirImpresionA4({
    titulo: `${oc.numero_oc} - ${oc.proveedor}`,
    documento: 'Orden de Compra',
    cuerpo: `
      <div class="meta">
        <div>
          <b>Proveedor:</b> ${escaparHtml(oc.proveedor)}<br>
          <b>Fecha de emisión:</b> ${new Date(oc.fecha_emision).toLocaleDateString('es-AR')}<br>
          <b>Emitida por:</b> ${escaparHtml(oc.emitida_por_nombre || '-')} (Compras / Pañol)
        </div>
        <div class="total"><span>ORDEN DE COMPRA</span><strong>${escaparHtml(oc.numero_oc)}</strong></div>
      </div>
      <p>Por la presente solicitamos la provisión de los siguientes artículos, a los precios unitarios pactados:</p>
      <table>
        <thead><tr><th class="num">#</th><th>Req. Interno / Solicitud</th><th>Artículo</th><th class="num">Cantidad</th><th class="num">P. Unit (Neto)</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot>
          ${filaTotal('Subtotal', totales.subtotal, 'background:#f8fafc;font-weight:600')}
          ${filaTotal(`IVA (${textoAlicuota(iva)})`, totales.iva, 'background:#f8fafc;font-weight:600;border-top:1px solid #cbd5e1')}
          ${filaTotal('TOTAL FINAL', totales.total, 'background:#0f172a;color:#fff;font-size:12px')}
        </tfoot>
      </table>
      <p class="pie" style="margin-top:4px">Los precios indicados son netos. El IVA correspondiente se encuentra desglosado en los totales.</p>
      <h2>Condiciones</h2>
      <ul>
        <li>Precios unitarios netos según cotización aprobada por Gerencia (${escaparHtml(oc.emitida_por_nombre || 'Compras')}).</li>
        <li>Indicar el número <b>${escaparHtml(oc.numero_oc)}</b> en el remito y en la factura.</li>
        <li>Entregar en Pañol de IMCAYPER S.A.</li>
      </ul>`
  });
};
