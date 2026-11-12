import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPedidosAprobados, getOrdenesCompra, emitirOrdenCompra, mensajeError } from '../api';
import { formatearMoneda, formatearFecha, numeroRequerimiento, textoCantidades, ALICUOTAS_IVA, IVA_POR_DEFECTO, textoAlicuota } from '../constants';
import { cantidadAprobada, subtotalPedido as subtotal, precioNetoOC, alicuotaOC, imprimirOrdenCompra } from '../ordenCompra';
import { PantallaCarga, EtiquetaSolicitud } from './ui';
import { claseAccion, claseBotonHeader, claseBotonPagina } from '../estilos';
import { ArrowLeft, FileText, FileDown, Paperclip } from 'lucide-react';

export default function OrdenesCompra() {
  const [aprobados, setAprobados] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [seleccion, setSeleccion] = useState(new Set());
  const [cargando, setCargando] = useState(true);
  const [emitiendo, setEmitiendo] = useState(null);
  const [iva, setIva] = useState(IVA_POR_DEFECTO);
  const navigate = useNavigate();

  const cargar = async () => {
    try {
      const [pedidos, ocs] = await Promise.all([getPedidosAprobados(), getOrdenesCompra()]);
      setAprobados(pedidos.filter(p => p.estado === 'Aprobado'));
      setOrdenes(ocs);
    } catch (err) {
      alert(mensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('token')) return navigate('/login');
    cargar();
  }, []);

  // Agrupados por el proveedor que eligió Gerencia: una OC por proveedor
  const porProveedor = aprobados.reduce((grupos, p) => {
    const clave = p.proveedor_final || 'Sin proveedor';
    (grupos[clave] ||= []).push(p);
    return grupos;
  }, {});

  const alternar = (id) => {
    const nueva = new Set(seleccion);
    nueva.has(id) ? nueva.delete(id) : nueva.add(id);
    setSeleccion(nueva);
  };

  const alternarGrupo = (pedidos) => {
    const todos = pedidos.every(p => seleccion.has(p.id));
    const nueva = new Set(seleccion);
    pedidos.forEach(p => (todos ? nueva.delete(p.id) : nueva.add(p.id)));
    setSeleccion(nueva);
  };

  const generarOC = async (proveedor, pedidos) => {
    const ids = pedidos.filter(p => seleccion.has(p.id)).map(p => p.id);
    if (!window.confirm(`¿Emitir una Orden de Compra a ${proveedor} con ${ids.length} artículo(s) e IVA ${textoAlicuota(iva)}?`)) return;
    setEmitiendo(proveedor);
    try {
      const oc = await emitirOrdenCompra(ids, iva);
      const nueva = new Set(seleccion);
      ids.forEach(id => nueva.delete(id));
      setSeleccion(nueva);
      await cargar();
      imprimirOrdenCompra(oc);
    } catch (err) {
      alert(mensajeError(err));
    } finally {
      setEmitiendo(null);
    }
  };

  if (cargando) return <PantallaCarga subtitulo="Emitir Órdenes de Compra" />;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Emitir Órdenes de Compra</p>
        </div>
        <button onClick={() => navigate('/cotizacion')} className={claseBotonHeader()}>
          <ArrowLeft size={16} /> Volver al Panel
        </button>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full space-y-8">
        <section>
          <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-1">Pedidos aprobados sin OC</h2>
              <p className="text-sm text-slate-600">Seleccioná los artículos de un mismo proveedor y generá la OC. Los pedidos pasan a estado "OC Emitida".</p>
            </div>
            {aprobados.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">IVA de la OC</label>
                <select value={iva} onChange={(e) => setIva(Number(e.target.value))}
                  className="w-32 border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-blue-600 outline-none">
                  {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{textoAlicuota(a)}</option>)}
                </select>
              </div>
            )}
          </div>
          {aprobados.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center text-slate-500">No hay pedidos aprobados pendientes de OC</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(porProveedor).map(([proveedor, pedidos]) => {
                const elegidos = pedidos.filter(p => seleccion.has(p.id));
                const totalElegido = elegidos.reduce((s, p) => s + subtotal(p), 0);
                return (
                  <div key={proveedor} className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="flex flex-wrap justify-between items-center gap-3 p-4 bg-slate-50 border-b">
                      <div>
                        <p className="text-xs uppercase text-slate-500 font-semibold">Proveedor</p>
                        <p className="text-lg font-bold text-slate-800">{proveedor}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-sm text-slate-600">
                          {elegidos.length} de {pedidos.length} seleccionados · <span className="font-bold text-slate-900">{formatearMoneda(totalElegido)}</span> neto
                        </p>
                        <button onClick={() => generarOC(proveedor, pedidos)} disabled={!elegidos.length || emitiendo} className={claseBotonPagina('primaria')}>
                          <FileText size={16} /> {emitiendo === proveedor ? 'Emitiendo...' : 'Generar OC'}
                        </button>
                      </div>
                    </div>
                    <table className="w-full">
                      <thead className="bg-slate-100 text-sm">
                        <tr>
                          <th className="p-3 w-10">
                            <input type="checkbox" checked={pedidos.every(p => seleccion.has(p.id))} onChange={() => alternarGrupo(pedidos)} title="Seleccionar todos" />
                          </th>
                          <th className="p-3 text-left text-slate-700">Requerimiento</th>
                          <th className="p-3 text-left text-slate-700">Insumo</th>
                          <th className="p-3 text-left text-slate-700">Cantidad Aprobada</th>
                          <th className="p-3 text-right text-slate-700">P. Unit (Neto)</th>
                          <th className="p-3 text-right text-slate-700">Subtotal (Neto)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pedidos.map(p => (
                          <tr key={p.id} onClick={() => alternar(p.id)} className={`border-b cursor-pointer ${seleccion.has(p.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                            <td className="p-3 text-center"><input type="checkbox" checked={seleccion.has(p.id)} onChange={() => alternar(p.id)} onClick={(e) => e.stopPropagation()} /></td>
                            <td className="p-3">
                              <p className="font-mono text-sm">{numeroRequerimiento(p.id)}</p>
                              <EtiquetaSolicitud codigo={p.codigo_solicitud} className="mt-1" />
                            </td>
                            <td className="p-3">
                              <p className="font-bold text-slate-800">{p.insumo_nombre}</p>
                              <p className="text-xs text-slate-500">Solicitó: {p.supervisor_nombre} · {p.criticidad}</p>
                            </td>
                            <td className="p-3">{textoCantidades(p)}</td>
                            <td className="p-3 text-right">{formatearMoneda(precioNetoOC(p))}</td>
                            <td className="p-3 text-right font-semibold">{formatearMoneda(subtotal(p))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Órdenes de Compra emitidas</h2>
          {ordenes.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center text-slate-500">Todavía no se emitieron órdenes de compra</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left text-slate-700">Nº OC</th>
                    <th className="p-3 text-left text-slate-700">Proveedor</th>
                    <th className="p-3 text-left text-slate-700">Emisión</th>
                    <th className="p-3 text-left text-slate-700">Artículos</th>
                    <th className="p-3 text-right text-slate-700">Total</th>
                    <th className="p-3 text-left text-slate-700">Estado</th>
                    <th className="p-3 text-left text-slate-700">Documento</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenes.map(oc => (
                    <tr key={oc.id} className="border-b hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold">{oc.numero_oc}</td>
                      <td className="p-3">{oc.proveedor}</td>
                      <td className="p-3 text-sm text-slate-600">{formatearFecha(oc.fecha_emision)}</td>
                      <td className="p-3 text-sm">
                        {oc.pedidos.map(p => <p key={p.id}>{cantidadAprobada(p)} × {p.insumo_nombre}</p>)}
                      </td>
                      <td className="p-3 text-right">
                        <p className="font-semibold">{formatearMoneda(oc.total_final)}</p>
                        <p className="text-xs text-slate-500">{formatearMoneda(oc.total)} neto + IVA {textoAlicuota(alicuotaOC(oc))}</p>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${oc.estado === 'Recibida' ? 'bg-gray-100 text-gray-700' : 'bg-teal-100 text-teal-800'}`}>{oc.estado}</span>
                        {oc.tiene_factura && <span className="ml-2 inline-flex align-middle text-slate-500" title="Factura adjunta"><Paperclip size={14} /></span>}
                      </td>
                      <td className="p-3">
                        <button onClick={() => imprimirOrdenCompra(oc)} className={claseAccion('neutra')}>
                          <FileDown size={13} /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
