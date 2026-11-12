import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPedidosPendientesAprobacion, aprobarPedido, mensajeError } from '../api';
import CalculoPrecio from './CalculoPrecio';
import { PantallaCarga, EtiquetaSolicitud } from './ui';
import { claseBotonHeader } from '../estilos';
import { ChartColumn, LogOut, MessageSquare, Check } from 'lucide-react';

export default function PanelAprobacion() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [cantidadFinal, setCantidadFinal] = useState(1);
  const [cotizacionElegida, setCotizacionElegida] = useState('');
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    cargarPedidos();
  }, []);

  const cargarPedidos = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const data = await getPedidosPendientesAprobacion();
      setPedidos(data);
      setLoading(false);
    } catch (error) {
      console.error("Error cargando pedidos:", error);
      setLoading(false);
    }
  };

  const handleAprobar = async (estado) => {
    if (estado === 'Aprobado' && !cotizacionElegida) {
      alert('Debes seleccionar una cotización para aprobar');
      return;
    }

    if (!confirm(`¿Confirmar que deseas ${estado.toLowerCase()} este pedido?`)) return;

    setEnviando(true);

    try {
      await aprobarPedido(pedidoSeleccionado.id, {
        cotizacion_id: cotizacionElegida ? parseInt(cotizacionElegida) : null,
        cantidad_aprobada: cantidadFinal || null,
        estado: estado
      });
      alert(`Pedido ${estado.toLowerCase()}`);
      setPedidoSeleccionado(null);
      cargarPedidos();
    } catch (err) {
      alert(`Error al procesar pedido: ${mensajeError(err)}`);
    } finally {
      setEnviando(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) return <PantallaCarga subtitulo="Panel de Aprobación - Gerencia" header="bg-slate-900" />;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Panel de Aprobación - Gerencia</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/gastos')} className={claseBotonHeader()}>
            <ChartColumn size={16} /> Control de Gastos
          </button>
          <button onClick={handleLogout} className={claseBotonHeader('salir')}>
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Pedidos Pendientes de Aprobación</h2>
          {pedidos.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center text-slate-500">
              No hay pedidos pendientes de aprobación
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pedidos.map(pedido => (
                <div key={pedido.id} className="bg-white rounded-xl shadow-lg border-t-4 border-blue-500 overflow-hidden">
                  <div className="p-5 border-b bg-slate-50">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-slate-800">{pedido.cantidad_solicitada}x {pedido.insumo_nombre}</h3>
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
                      <p className="text-sm mt-2 bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-200 flex gap-2">
                        <MessageSquare size={14} className="mt-0.5 shrink-0" /> {pedido.observaciones}
                      </p>
                    )}
                  </div>

                  <div className="p-5">
                    <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Cotizaciones</h4>
                    <div className="space-y-3">
                      {pedido.cotizaciones.map(cot => {
                        const esMejor = pedido.mejor_cotizacion?.id === cot.id;
                        return (
                          <div
                            key={cot.id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              esMejor ? 'bg-green-50 border-green-400 ring-2 ring-green-300' : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div>
                              <p className="font-bold text-slate-800">{cot.proveedor_nombre}</p>
                              <CalculoPrecio cantidad={pedido.cantidad_solicitada} unitario={cot.precio_unitario} className="text-sm" />
                            </div>
                            {esMejor && (
                              <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded">
                                <Check size={12} /> Mejor opción
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        setPedidoSeleccionado(pedido);
                        setCantidadFinal(pedido.cantidad_solicitada);
                        setCotizacionElegida(pedido.mejor_cotizacion?.id?.toString() || '');
                      }}
                      className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
                    >
                      Revisar y Decidir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Modal de Aprobación */}
        {pedidoSeleccionado && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-bold mb-4">Aprobar: {pedidoSeleccionado.insumo_nombre}</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className="p-3 bg-slate-100 border rounded-lg">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Solicitado (supervisor)</p>
                    <p className="text-2xl font-bold text-slate-800">{pedidoSeleccionado.cantidad_solicitada}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cantidad a Aprobar</label>
                    <input
                      type="number"
                      min="1"
                      value={cantidadFinal}
                      onChange={(e) => setCantidadFinal(parseInt(e.target.value) || 0)}
                      className="w-full border rounded-lg p-3 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none text-xl font-bold"
                    />
                  </div>
                </div>
                {cantidadFinal > 0 && cantidadFinal !== pedidoSeleccionado.cantidad_solicitada && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Vas a aprobar {cantidadFinal} de {pedidoSeleccionado.cantidad_solicitada} solicitados. Ambos números quedan registrados en el historial.
                  </p>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Elegir Proveedor (totales calculados con la cantidad a aprobar)</label>
                  <div className="space-y-2">
                    {pedidoSeleccionado.cotizaciones.map(cot => {
                      const elegida = String(cot.id) === cotizacionElegida;
                      const esMejor = pedidoSeleccionado.mejor_cotizacion?.id === cot.id;
                      return (
                        <label key={cot.id}
                          className={`flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition ${elegida ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-400'}`}>
                          <input type="radio" name="cotizacion" className="mt-1" checked={elegida}
                            onChange={() => setCotizacionElegida(String(cot.id))} />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-800">{cot.proveedor_nombre}</span>
                              {esMejor && <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded"><Check size={12} /> Mejor opción</span>}
                            </div>
                            <CalculoPrecio cantidad={cantidadFinal} unitario={cot.precio_unitario} className="text-sm" />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => handleAprobar('Aprobado')}
                    disabled={enviando}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition disabled:bg-slate-300"
                  >
                    {enviando ? 'Procesando...' : 'Aprobar'}
                  </button>
                  <button
                    onClick={() => handleAprobar('Postergado')}
                    disabled={enviando}
                    className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 rounded-lg transition disabled:bg-slate-300"
                  >
                    Postergar
                  </button>
                  <button
                    onClick={() => handleAprobar('Rechazado')}
                    disabled={enviando}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition disabled:bg-slate-300"
                  >
                    Rechazar
                  </button>
                </div>

                <button
                  onClick={() => setPedidoSeleccionado(null)}
                  className="w-full text-slate-600 hover:bg-slate-100 py-2 rounded transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
