import { useState } from 'react';
import { emitirOrdenCompra, mensajeError } from '../api';
import { formatearMoneda, numeroRequerimiento, ALICUOTAS_IVA, IVA_POR_DEFECTO, textoAlicuota } from '../constants';
import { cantidadAprobada, subtotalPedido, precioNetoOC, totalesOrdenCompra, imprimirOrdenCompra } from '../ordenCompra';
import { EtiquetaSolicitud } from './ui';
import { FileText, Info } from 'lucide-react';

const SIN_PROVEEDOR = 'Sin proveedor';

// Emite una OC con los pedidos aprobados que se tildaron en el panel.
// El proveedor de cada ítem es el de la cotización que eligió Gerencia: si la selección mezcla proveedores,
// se elige uno y la OC incluye solo sus ítems (los demás quedan tildados para la siguiente OC).
export default function ModalGenerarOC({ pedidos, onCerrar, onEmitida }) {
  const proveedores = [...new Set(pedidos.map(p => p.proveedor_final || SIN_PROVEEDOR))].sort();
  const [proveedor, setProveedor] = useState(proveedores.length === 1 ? proveedores[0] : '');
  const [iva, setIva] = useState(IVA_POR_DEFECTO);
  const [error, setError] = useState('');
  const [emitiendo, setEmitiendo] = useState(false);

  const incluidos = pedidos.filter(p => (p.proveedor_final || SIN_PROVEEDOR) === proveedor);
  const totales = totalesOrdenCompra(incluidos, iva);
  const restantes = pedidos.length - incluidos.length;

  const confirmar = async () => {
    if (!proveedor) return setError('Seleccioná el proveedor de la Orden de Compra.');
    if (proveedor === SIN_PROVEEDOR) return setError('Estos pedidos no tienen proveedor aprobado: no se puede emitir la OC.');
    setError('');
    setEmitiendo(true);
    try {
      const oc = await emitirOrdenCompra(incluidos.map(p => p.id), iva);
      imprimirOrdenCompra(oc); // Usa el IVA ya guardado en la OC
      onEmitida(oc, incluidos.map(p => p.id));
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setEmitiendo(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-aparecer">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[92vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText size={22} className="text-slate-500" /> Generar Orden de Compra</h2>
        <p className="text-sm text-slate-600 mb-5">
          {pedidos.length} {pedidos.length === 1 ? 'ítem seleccionado' : 'ítems seleccionados'}. Se emitirá una única OC con número correlativo y su PDF.
        </p>

        <div className="mb-4 flex flex-wrap gap-4 items-start">
          <div className="flex-1 min-w-[16rem]">
            <label className="block text-sm font-medium text-slate-700 mb-1">Proveedor</label>
            <select value={proveedor} onChange={(e) => setProveedor(e.target.value)}
              className="w-full border border-slate-300 rounded-md p-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none">
              {proveedores.length > 1 && <option value="" disabled>Seleccioná el proveedor...</option>}
              {proveedores.map(pr => {
                const cantidad = pedidos.filter(p => (p.proveedor_final || SIN_PROVEEDOR) === pr).length;
                return <option key={pr} value={pr}>{pr} ({cantidad} {cantidad === 1 ? 'ítem' : 'ítems'})</option>;
              })}
            </select>
            <p className="text-xs text-slate-500 mt-1">Es el proveedor de la cotización aprobada por Gerencia para cada ítem.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">IVA</label>
            <select value={iva} onChange={(e) => setIva(Number(e.target.value))}
              className="w-32 border border-slate-300 rounded-md p-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none">
              {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{textoAlicuota(a)}</option>)}
            </select>
          </div>
        </div>

        {restantes > 0 && proveedor && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-900 flex gap-2">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>{restantes} {restantes === 1 ? 'ítem seleccionado es' : 'ítems seleccionados son'} de otro proveedor y {restantes === 1 ? 'queda tildado' : 'quedan tildados'} para emitir otra OC.</span>
          </div>
        )}

        {proveedor && (
          <div className="border rounded-md overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2.5 text-left text-slate-700">Requerimiento / Solicitud</th>
                  <th className="p-2.5 text-left text-slate-700">Artículo</th>
                  <th className="p-2.5 text-right text-slate-700">Cantidad</th>
                  <th className="p-2.5 text-right text-slate-700">P. Unit (Neto)</th>
                  <th className="p-2.5 text-right text-slate-700">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {incluidos.map(p => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2.5">
                      <p className="font-mono">{numeroRequerimiento(p.id)}</p>
                      <EtiquetaSolicitud codigo={p.codigo_solicitud} className="mt-1" />
                    </td>
                    <td className="p-2.5">
                      <p className="font-semibold text-slate-800">{p.insumo_nombre}</p>
                      <p className="text-xs text-slate-500">Solicitó: {p.supervisor_nombre}</p>
                    </td>
                    <td className="p-2.5 text-right">{cantidadAprobada(p)}</td>
                    <td className="p-2.5 text-right">{formatearMoneda(precioNetoOC(p))}</td>
                    <td className="p-2.5 text-right font-semibold">{formatearMoneda(subtotalPedido(p))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-300">
                <tr className="bg-slate-50">
                  <td colSpan="4" className="p-2.5 text-right text-slate-600">Subtotal</td>
                  <td className="p-2.5 text-right font-semibold">{formatearMoneda(totales.subtotal)}</td>
                </tr>
                <tr className="bg-slate-50 border-t">
                  <td colSpan="4" className="p-2.5 text-right text-slate-600">IVA ({textoAlicuota(iva)})</td>
                  <td className="p-2.5 text-right font-semibold">{formatearMoneda(totales.iva)}</td>
                </tr>
                <tr className="bg-slate-800 text-white">
                  <td colSpan="4" className="p-2.5 text-right font-bold">TOTAL FINAL</td>
                  <td className="p-2.5 text-right font-bold">{formatearMoneda(totales.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {proveedor && (
          <p className="-mt-2 mb-4 text-xs text-slate-500">Los precios indicados son netos. El IVA correspondiente se encuentra desglosado en los totales.</p>
        )}

        {error && <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">{error}</div>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCerrar} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md">Cancelar</button>
          <button type="button" onClick={confirmar} disabled={emitiendo || !proveedor}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-md disabled:bg-slate-300">
            <FileText size={16} /> {emitiendo ? 'Emitiendo...' : `Emitir OC y generar PDF${proveedor ? ` (${incluidos.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
