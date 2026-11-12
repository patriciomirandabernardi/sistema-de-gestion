import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPedidosPendientesCotizacion, agregarCotizaciones, recibirPedido, reactivarPedido, getStockAlertas, getPedidosAprobados, getHistorialPedidos, subirFactura, mensajeError } from '../api';
import { compraDirecta, BADGE_ESTADO, formatearMoneda, formatearFecha, textoEstado, textoCantidades, numeroRequerimiento,
  ALICUOTAS_IVA, IVA_POR_DEFECTO, textoAlicuota, redondear2, desgloseIva, totalConIva } from '../constants';
import { useCategorias } from '../useCategorias';
import CalculoPrecio from './CalculoPrecio';
import { PantallaCarga, EtiquetaSolicitud } from './ui';
import { claseAccion, claseBotonHeader, claseBotonPagina } from '../estilos';
import { Package, FileText, ChartColumn, Users, LogOut, CircleCheck, MessageSquare, Paperclip, Info, PackageCheck, RotateCcw, Wrench } from 'lucide-react';
import ModalGenerarOC from './ModalGenerarOC';

export default function PanelCotizacion() {
  const [alertas, setAlertas] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [pedidosAprobados, setPedidosAprobados] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [cotizaciones, setCotizaciones] = useState([
    { proveedor_nombre: '', precio_unitario: '' },
    { proveedor_nombre: '', precio_unitario: '' },
    { proveedor_nombre: '', precio_unitario: '' }
  ]);
  const [pedidoRecepcion, setPedidoRecepcion] = useState(null);
  const [formRecepcion, setFormRecepcion] = useState({ precio_neto: '', iva: IVA_POR_DEFECTO, categoria_gasto: '', ubicacion_uso: '' });
  const [archivoFactura, setArchivoFactura] = useState(null);
  const [errorRecepcion, setErrorRecepcion] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [seleccionOC, setSeleccionOC] = useState(new Set()); // Pedidos aprobados tildados para emitir OC
  const [modalOC, setModalOC] = useState(false);
  const [pedidoReactivar, setPedidoReactivar] = useState(null);
  const categorias = useCategorias();
  const navigate = useNavigate();

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const [alertasData, pedidosData, aprobadosData, historialData] = await Promise.all([
        getStockAlertas(),
        getPedidosPendientesCotizacion(),
        getPedidosAprobados(),
        getHistorialPedidos()
      ]);
      setAlertas(alertasData);
      setPedidos(pedidosData);
      setPedidosAprobados(aprobadosData);
      setHistorial(historialData);
      setLoading(false);
    } catch (error) {
      console.error("Error cargando datos:", error);
      setLoading(false);
    }
  };

  const handleAgregarCotizaciones = async (e) => {
    e.preventDefault();
    setEnviando(true);

    const cotizacionesValidas = cotizaciones.filter(c => c.proveedor_nombre && c.precio_unitario);

    try {
      await agregarCotizaciones(pedidoSeleccionado.id, cotizacionesValidas);
      alert('Cotizaciones agregadas y pedido enviado a aprobación');
      setPedidoSeleccionado(null);
      setCotizaciones([
        { proveedor_nombre: '', precio_unitario: '' },
        { proveedor_nombre: '', precio_unitario: '' },
        { proveedor_nombre: '', precio_unitario: '' }
      ]);
      cargarDatos();
    } catch (err) {
      alert(`Error al agregar cotizaciones: ${mensajeError(err)}`);
    } finally {
      setEnviando(false);
    }
  };

  const abrirRecepcion = (pedido) => {
    // Se precarga el precio neto aprobado por Gerencia; se corrige si la factura vino distinta
    setFormRecepcion({ precio_neto: pedido.precio_unitario_final ?? '', iva: pedido.alicuota_iva ?? IVA_POR_DEFECTO, categoria_gasto: '', ubicacion_uso: '' });
    setArchivoFactura(null);
    setErrorRecepcion('');
    setPedidoRecepcion(pedido);
  };

  const confirmarRecepcion = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErrorRecepcion('');
    const esNuevo = !pedidoRecepcion.insumo_id;
    try {
      // Neto y alícuota viajan por separado: el backend guarda ambos y calcula el gasto real con IVA
      await recibirPedido(pedidoRecepcion.id, {
        precio_unitario: redondear2(parseFloat(formRecepcion.precio_neto) || 0),
        alicuota_iva: formRecepcion.iva,
        ...(esNuevo && { categoria_gasto: formRecepcion.categoria_gasto, ubicacion_uso: formRecepcion.ubicacion_uso })
      });
      // La factura se sube después de recibir: si falla, la recepción ya quedó registrada y se avisa aparte
      let avisoFactura = '';
      if (archivoFactura) {
        try {
          await subirFactura(pedidoRecepcion.id, archivoFactura);
          avisoFactura = '\nFactura adjuntada.';
        } catch (err) {
          avisoFactura = `\nAtención: la recepción se registró, pero la factura no se pudo adjuntar: ${mensajeError(err)}`;
        }
      }
      setPedidoRecepcion(null);
      alert((esNuevo ? 'Pedido recibido. El insumo fue dado de alta en el catálogo con su stock.' : 'Pedido recibido y stock actualizado') + avisoFactura);
      cargarDatos();
    } catch (err) {
      setErrorRecepcion(mensajeError(err));
    } finally {
      setEnviando(false);
    }
  };

  const cantidadFinal = (pedido) => pedido.cantidad_aprobada || pedido.cantidad_solicitada;

  const precioConIva = (neto, iva) => redondear2((parseFloat(neto) || 0) * (1 + iva / 100)); // Solo para mostrar el costo unitario real
  const desgloseRecepcion = pedidoRecepcion
    ? desgloseIva(cantidadFinal(pedidoRecepcion) * (parseFloat(formRecepcion.precio_neto) || 0), formRecepcion.iva)
    : null;

  const getEstadoBadge = (estado) => BADGE_ESTADO[estado] || 'bg-gray-100 text-gray-700';

  const sinOC = pedidosAprobados.filter(p => !p.numero_oc).length;

  // Solo los pedidos "Aprobado" (todavía sin OC) se pueden tildar; la selección se limpia sola si un pedido cambia de estado
  const aprobadosSinOC = pedidosAprobados.filter(p => p.estado === 'Aprobado');
  const seleccionados = aprobadosSinOC.filter(p => seleccionOC.has(p.id));
  const todosTildados = aprobadosSinOC.length > 0 && seleccionados.length === aprobadosSinOC.length;

  const alternarSeleccion = (id) => setSeleccionOC(actual => {
    const nueva = new Set(actual);
    nueva.has(id) ? nueva.delete(id) : nueva.add(id);
    return nueva;
  });
  const alternarTodos = () => setSeleccionOC(todosTildados ? new Set() : new Set(aprobadosSinOC.map(p => p.id)));

  const confirmarReactivacion = async (destino) => {
    setEnviando(true);
    try {
      const r = await reactivarPedido(pedidoReactivar.id, destino);
      setPedidoReactivar(null);
      alert(r.mensaje);
      cargarDatos();
    } catch (err) {
      alert(`No se pudo reactivar: ${mensajeError(err)}`);
    } finally {
      setEnviando(false);
    }
  };

  const alEmitirOC = (oc, idsEmitidos) => {
    setModalOC(false);
    setSeleccionOC(actual => new Set([...actual].filter(id => !idsEmitidos.includes(id))));
    alert(`Orden de Compra ${oc.numero_oc} emitida a ${oc.proveedor} con ${idsEmitidos.length} ${idsEmitidos.length === 1 ? 'ítem' : 'ítems'}.`);
    cargarDatos();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) return <PantallaCarga subtitulo="Panel de Cotización - Patricio" />;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Panel de Cotización - Patricio</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <button onClick={() => navigate('/catalogo')} className={claseBotonHeader()}>
            <Package size={16} /> Catálogo de Insumos
          </button>
          <button onClick={() => navigate('/ordenes-compra')} className={claseBotonHeader('primaria')}>
            <FileText size={16} /> Emitir Órdenes de Compra{sinOC > 0 && <span className="bg-white text-blue-800 rounded-full px-2 text-xs">{sinOC}</span>}
          </button>
          <button onClick={() => navigate('/gastos')} className={claseBotonHeader()}>
            <ChartColumn size={16} /> Control de Gastos
          </button>
          <button onClick={() => navigate('/servicios-externos')} className={claseBotonHeader()}>
            <Wrench size={16} /> Servicios Externos
          </button>
          <button onClick={() => navigate('/usuarios')} className={claseBotonHeader()}>
            <Users size={16} /> Usuarios
          </button>
          <button onClick={handleLogout} className={claseBotonHeader('salir')}>
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full space-y-8">
        {/* Semáforo de Stock */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Semáforo de Stock</h2>
          {alertas.length === 0 ? (
            <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center text-green-700">
              <p className="text-lg font-semibold inline-flex items-center gap-2"><CircleCheck size={20} /> Stock en buen estado</p>
              <p className="text-sm">No hay insumos por debajo del punto de pedido</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alertas.map(alerta => (
                <div key={alerta.id} className={`p-4 rounded-lg border-2 ${
                  alerta.es_critico ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-400'
                }`}>
                  <h3 className="font-bold text-lg">{alerta.nombre}</h3>
                  <p className="text-sm text-slate-600">Stock actual: <span className="font-bold">{alerta.stock_actual}</span></p>
                  <p className="text-sm text-slate-600">Mínimo: {alerta.stock_minimo}</p>
                  <p className={`text-sm font-bold ${alerta.es_critico ? 'text-red-600' : 'text-yellow-600'}`}>
                    Déficit: {alerta.deficit} unidades
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pedidos Pendientes de Cotización */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Pedidos Pendientes de Cotización</h2>
          {pedidos.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center text-slate-500">
              No hay pedidos pendientes de cotización
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {pedidos.map(pedido => (
                <div key={pedido.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg">{pedido.cantidad_solicitada}x {pedido.insumo_nombre}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      pedido.criticidad === 'Alta' ? 'bg-red-100 text-red-700' :
                      pedido.criticidad === 'Normal' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {pedido.criticidad}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">Solicitado por: {pedido.supervisor_nombre}</p>
                  <EtiquetaSolicitud codigo={pedido.codigo_solicitud} className="mt-1" />
                  {pedido.observaciones && (
                    <p className="text-sm text-slate-500 mt-2 bg-slate-50 p-2 rounded flex gap-2"><MessageSquare size={14} className="mt-0.5 shrink-0" /> {pedido.observaciones}</p>
                  )}
                  <button
                    onClick={() => setPedidoSeleccionado(pedido)}
                    className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition"
                  >
                    Agregar Cotizaciones
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Mercadería en Camino */}
        <section>
          <div className="flex flex-wrap justify-between items-end gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Mercadería en Camino</h2>
              {aprobadosSinOC.length > 0 && (
                <p className="text-sm text-slate-500">Tildá los ítems aprobados que van en una misma Orden de Compra.</p>
              )}
            </div>
            {aprobadosSinOC.length > 0 && (
              <button onClick={() => setModalOC(true)} disabled={seleccionados.length === 0} className={claseBotonPagina('primaria')}>
                <FileText size={16} /> Generar OC para Seleccionados{seleccionados.length > 0 && ` (${seleccionados.length})`}
              </button>
            )}
          </div>
          {pedidosAprobados.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center text-slate-500">
              No hay mercadería en camino
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-4 w-10">
                      {aprobadosSinOC.length > 0 && (
                        <input type="checkbox" checked={todosTildados} onChange={alternarTodos}
                          title="Seleccionar todos los aprobados sin OC" aria-label="Seleccionar todos los aprobados sin OC" />
                      )}
                    </th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Insumo</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Cantidad</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Solicitante</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Proveedor / OC</th>
                    <th className="p-4 text-right text-slate-700 font-semibold">P. Unit (Neto)</th>
                    <th className="p-4 text-right text-slate-700 font-semibold">Subtotal (Neto)</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidosAprobados.map(pedido => {
                    const seleccionable = pedido.estado === 'Aprobado';
                    const tildado = seleccionable && seleccionOC.has(pedido.id);
                    return (
                    <tr key={pedido.id} className={`border-b ${tildado ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <td className="p-4 text-center">
                        {seleccionable && (
                          <input type="checkbox" checked={tildado} onChange={() => alternarSeleccion(pedido.id)}
                            aria-label={`Seleccionar ${pedido.insumo_nombre} para la OC`} />
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{pedido.insumo_nombre}</p>
                        <p className="text-xs text-slate-500">
                          {numeroRequerimiento(pedido.id)} · {pedido.criticidad}{!pedido.insumo_id && ' · Insumo nuevo (sin catálogo)'}
                        </p>
                        <EtiquetaSolicitud codigo={pedido.codigo_solicitud} className="mt-1" />
                      </td>
                      <td className="p-4">{textoCantidades(pedido)}</td>
                      <td className="p-4 text-sm">{pedido.supervisor_nombre}</td>
                      <td className="p-4 text-sm">
                        <p>{pedido.proveedor_final || '-'}</p>
                        {pedido.numero_oc
                          ? <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-800">{pedido.numero_oc}</span>
                          : <span className="inline-block mt-1 text-xs text-amber-700">Sin OC</span>}
                      </td>
                      <td className="p-4 text-sm text-right">{formatearMoneda(pedido.precio_unitario_final)}</td>
                      <td className="p-4 text-sm text-right font-semibold">{formatearMoneda(cantidadFinal(pedido) * pedido.precio_unitario_final)}</td>
                      <td className="p-4">
                        <button onClick={() => abrirRecepcion(pedido)} className={claseAccion('primaria')}>
                          <PackageCheck size={14} /> Marcar como Recibido
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Historial de Pedidos */}
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Historial de Pedidos</h2>
          {historial.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center text-slate-500">
              No hay pedidos en el historial
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-4 text-left text-slate-700 font-semibold">Insumo</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Cantidad</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Solicitante</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Fecha</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Estado</th>
                    <th className="p-4 text-center text-slate-700 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(pedido => (
                    <tr key={pedido.id} className="border-b hover:bg-slate-50">
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{pedido.insumo_nombre}</p>
                        <p className="text-xs text-slate-500 font-mono inline-flex items-center gap-1">
                          {numeroRequerimiento(pedido.id)}{pedido.numero_oc && ` · ${pedido.numero_oc}`}
                          {pedido.tiene_factura && <span title="Factura adjunta" className="inline-flex items-center"> · <Paperclip size={12} /></span>}
                        </p>
                        <EtiquetaSolicitud codigo={pedido.codigo_solicitud} className="mt-1 block w-fit" />
                      </td>
                      <td className="p-4">{textoCantidades(pedido)}</td>
                      <td className="p-4 text-sm">{pedido.supervisor_nombre}</td>
                      <td className="p-4 text-sm text-slate-600">
                        {new Date(pedido.fecha_creacion).toLocaleDateString('es-AR')}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getEstadoBadge(pedido.estado)}`}>
                          {textoEstado(pedido.estado)}
                        </span>
                        {compraDirecta(pedido) && (
                          <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${compraDirecta(pedido).badge}`} title={pedido.observaciones || ''}>
                            {compraDirecta(pedido).etiqueta}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {pedido.estado === 'Postergado' && (
                          <button onClick={() => setPedidoReactivar(pedido)} className={claseAccion('neutra')}
                            title="Devolver el pedido al flujo de compra">
                            <RotateCcw size={13} /> Reactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Modal de Cotización */}
        {pedidoSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Cotizar: {pedidoSeleccionado.insumo_nombre}</h2>
              <p className="text-sm text-slate-600 mb-1">Cantidad solicitada: {pedidoSeleccionado.cantidad_solicitada}</p>
              <p className="text-xs text-slate-500 mb-4">Cargá el precio <span className="font-bold">por unidad</span>, no el total del pedido.</p>

              {pedidoSeleccionado.ultimo_precio_unitario > 0 && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900">
                  <Info size={14} className="inline -mt-0.5 mr-1" /><span className="font-semibold">Última compra:</span> {formatearMoneda(pedidoSeleccionado.ultimo_precio_unitario)} neto c/u (+IVA {textoAlicuota(pedidoSeleccionado.ultima_alicuota_iva ?? IVA_POR_DEFECTO)})
                  {pedidoSeleccionado.ultimo_proveedor && <> a <span className="font-semibold">{pedidoSeleccionado.ultimo_proveedor}</span></>}
                  {pedidoSeleccionado.fecha_ultima_compra && <> el {formatearFecha(pedidoSeleccionado.fecha_ultima_compra)}</>}
                  {' '}— Por las {pedidoSeleccionado.cantidad_solicitada} unidades pedidas hoy equivaldría a{' '}
                  <span className="font-bold">{formatearMoneda(totalConIva(pedidoSeleccionado.ultimo_precio_unitario, pedidoSeleccionado.cantidad_solicitada, pedidoSeleccionado.ultima_alicuota_iva))}</span> con IVA.
                  Las cotizaciones se cargan en precio neto.
                </div>
              )}

              <form onSubmit={handleAgregarCotizaciones} className="space-y-4">
                {cotizaciones.map((cot, index) => (
                  <div key={index}>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={`Proveedor ${index + 1}`}
                      value={cot.proveedor_nombre}
                      onChange={(e) => {
                        const nuevas = [...cotizaciones];
                        nuevas[index].proveedor_nombre = e.target.value;
                        setCotizaciones(nuevas);
                      }}
                      className="flex-1 border rounded-lg p-2"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="$ Unitario"
                      value={cot.precio_unitario}
                      onChange={(e) => {
                        const nuevas = [...cotizaciones];
                        nuevas[index].precio_unitario = parseFloat(e.target.value) || '';
                        setCotizaciones(nuevas);
                      }}
                      className="w-32 border rounded-lg p-2"
                    />
                  </div>
                  {cot.precio_unitario > 0 && (
                    <CalculoPrecio cantidad={pedidoSeleccionado.cantidad_solicitada} unitario={cot.precio_unitario} className="text-xs ml-1" />
                  )}
                  </div>
                ))}

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={() => setPedidoSeleccionado(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded disabled:bg-slate-300"
                  >
                    {enviando ? 'Enviando...' : 'Enviar a Aprobación'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Recepción */}
        {pedidoRecepcion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[92vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-1">Recibir: {pedidoRecepcion.insumo_nombre}</h2>
              <p className="text-sm text-slate-600 mb-4">
                {textoCantidades(pedidoRecepcion)} unidades · Proveedor: {pedidoRecepcion.proveedor_final || '-'}
                {pedidoRecepcion.numero_oc && <> · <span className="font-bold text-teal-800">{pedidoRecepcion.numero_oc}</span></>}
              </p>
              <form onSubmit={confirmarRecepcion} className="space-y-4">
                <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio Unitario (Neto)</label>
                    <input type="number" step="0.01" min="0" required value={formRecepcion.precio_neto}
                      onChange={(e) => setFormRecepcion({ ...formRecepcion, precio_neto: e.target.value })}
                      className="w-full border border-slate-300 rounded-md p-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">IVA</label>
                    <select value={formRecepcion.iva} onChange={(e) => setFormRecepcion({ ...formRecepcion, iva: Number(e.target.value) })}
                      className="w-full border border-slate-300 rounded-md p-2.5 bg-slate-50 focus:ring-2 focus:ring-blue-600 outline-none">
                      {ALICUOTAS_IVA.map(a => <option key={a} value={a}>{textoAlicuota(a)}</option>)}
                    </select>
                  </div>
                </div>
                <p className="-mt-2 text-xs text-slate-500">Aprobado por Gerencia: {formatearMoneda(pedidoRecepcion.precio_unitario_oc ?? pedidoRecepcion.precio_unitario_final)} c/u (neto){pedidoRecepcion.numero_oc && ` · IVA de la ${pedidoRecepcion.numero_oc}: ${textoAlicuota(pedidoRecepcion.alicuota_iva)}`}</p>

                <dl className="p-3 bg-slate-50 border rounded-md text-sm space-y-1">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-600">
                      {cantidadFinal(pedidoRecepcion)} u. × {formatearMoneda(parseFloat(formRecepcion.precio_neto) || 0)} (neto)
                    </dt>
                    <dd className="font-medium text-slate-800">{formatearMoneda(desgloseRecepcion.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-600">IVA ({textoAlicuota(formRecepcion.iva)})</dt>
                    <dd className="font-medium text-slate-800">{formatearMoneda(desgloseRecepcion.iva)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t pt-1.5">
                    <dt className="font-bold text-slate-900">Total Final de la Factura</dt>
                    <dd className="font-bold text-slate-900">{formatearMoneda(desgloseRecepcion.total)}</dd>
                  </div>
                  <p className="flex items-start gap-1.5 pt-1 text-xs text-slate-500">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    Se guardan el precio neto y el IVA por separado. Costo real para el stock: {formatearMoneda(precioConIva(formRecepcion.precio_neto, formRecepcion.iva))} c/u.
                  </p>
                </dl>

                {!pedidoRecepcion.insumo_id && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                    <p className="text-sm text-blue-800 font-semibold">Insumo nuevo: se dará de alta en el catálogo con este stock.</p>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Categoría de Gasto *</label>
                      <select required value={formRecepcion.categoria_gasto}
                        onChange={(e) => setFormRecepcion({ ...formRecepcion, categoria_gasto: e.target.value })}
                        className="w-full border rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="">Seleccionar...</option>
                        {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Ubicación / Uso (opcional)</label>
                      <input type="text" value={formRecepcion.ubicacion_uso} placeholder="¿En qué máquina o sector se usa?"
                        onChange={(e) => setFormRecepcion({ ...formRecepcion, ubicacion_uso: e.target.value })}
                        className="w-full border rounded-lg p-3 bg-white focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Factura / Remito del proveedor (opcional){pedidoRecepcion.numero_oc && ` · se adjunta a la ${pedidoRecepcion.numero_oc}`}
                  </label>
                  {pedidoRecepcion.tiene_factura ? (
                    <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2 flex gap-2">
                      <Paperclip size={14} className="mt-0.5 shrink-0" /> La factura de la {pedidoRecepcion.numero_oc} ya está adjunta (se cargó al recibir otro artículo de esta OC).
                    </p>
                  ) : (
                    <>
                      <input type="file" accept=".pdf,image/*" onChange={(e) => setArchivoFactura(e.target.files[0] || null)}
                        className="w-full text-sm border rounded-lg p-2 bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-slate-700 file:text-white" />
                      <p className="text-xs text-slate-500 mt-1">PDF o imagen, hasta 10 MB. Una vez adjunta no se puede reemplazar.</p>
                    </>
                  )}
                </div>

                {errorRecepcion && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{errorRecepcion}</div>}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setPedidoRecepcion(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancelar</button>
                  <button type="submit" disabled={enviando} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded disabled:bg-slate-300">
                    {enviando ? 'Procesando...' : 'Confirmar Recepción'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {modalOC && seleccionados.length > 0 && (
        <ModalGenerarOC pedidos={seleccionados} onCerrar={() => setModalOC(false)} onEmitida={alEmitirOC} />
      )}

      {/* Modal de Reactivación (pedido postergado) */}
      {pedidoReactivar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-1">Reactivar pedido</h2>
            <p className="text-sm text-slate-600 mb-4">
              {pedidoReactivar.cantidad_solicitada}x {pedidoReactivar.insumo_nombre} · {numeroRequerimiento(pedidoReactivar.id)}
            </p>
            <p className="text-sm text-slate-700 mb-4">¿A qué etapa del circuito lo devolvés?</p>
            <div className="space-y-3">
              <button onClick={() => confirmarReactivacion('aprobacion')} disabled={enviando}
                className="w-full text-left p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition disabled:opacity-50">
                <p className="font-bold text-slate-800">Enviar a Aprobación (Gerencia)</p>
                <p className="text-xs text-slate-500 mt-1">Conserva las cotizaciones cargadas. Útil si solo se frenó la compra por una decisión de caja.</p>
              </button>
              <button onClick={() => confirmarReactivacion('cotizacion')} disabled={enviando}
                className="w-full text-left p-4 border-2 border-slate-200 rounded-lg hover:border-amber-500 hover:bg-amber-50 transition disabled:opacity-50">
                <p className="font-bold text-slate-800">Enviar a Cotización (Compras)</p>
                <p className="text-xs text-slate-500 mt-1">Vuelve a la cola para recargar precios. Útil si las cotizaciones quedaron viejas.</p>
              </button>
            </div>
            <button onClick={() => setPedidoReactivar(null)}
              className="mt-4 w-full text-slate-600 hover:bg-slate-100 py-2 rounded transition">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
