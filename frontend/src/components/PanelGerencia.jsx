import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PantallaCarga } from './ui';

export default function PanelGerencia() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
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
      // Usamos tu IP para que Miguel pueda entrar desde su máquina
      const res = await fetch('http://140.191.1.137:8001/solicitudes/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        navigate('/login');
        return;
      }

      const data = await res.json();
      setSolicitudes(data);
      setLoading(false);
    } catch (error) {
      console.error("Error", error);
      setLoading(false);
    }
  };

  const tomarDecision = async (id, estado, proveedor = null, precio = null) => {
    const accion = estado === 'Aprobado' ? `comprar a ${proveedor}` : 'postergar este pedido';
    if (!window.confirm(`¿Estás seguro de ${accion}?`)) return;

    const token = localStorage.getItem('token');
    try {
      // Usamos tu IP nuevamente acá
      const res = await fetch(`http://140.191.1.137:8001/solicitudes/${id}/decision`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          estado: estado,
          proveedor_elegido: proveedor,
          precio_aprobado: precio
        })
      });

      if (res.ok) {
        cargarDatos(); // Recarga la pantalla y hace desaparecer la tarjeta
      }
    } catch (error) {
      console.error("Error al enviar decisión", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Filtramos para que Miguel solo vea lo que Patricio ya cotizó
  const pendientesDeAprobacion = solicitudes.filter(sol => sol.estado === 'Para Aprobar');

  // Función para mostrar la plata con formato de moneda
  const formatearPlata = (monto) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(monto);
  };

  if (loading) return <PantallaCarga header="bg-slate-900" />;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-900 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Panel de Gerencia - Autorización de Compras</p>
        </div>
        <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold transition">Cerrar Sesión</button>
      </header>

      <main className="p-6 max-w-7xl mx-auto w-full">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800">Pendientes de Aprobación</h2>
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full font-bold text-sm">
            {pendientesDeAprobacion.length} solicitudes
          </span>
        </div>

        {pendientesDeAprobacion.length === 0 ? (
          <div className="bg-white p-10 rounded-xl shadow text-center text-slate-500 text-lg">
            No hay compras pendientes de autorización en este momento.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pendientesDeAprobacion.map(sol => (
              <div key={sol.id} className="bg-white rounded-xl shadow-lg border-t-4 border-blue-500 overflow-hidden flex flex-col">
                
                {/* CABECERA DE LA TARJETA */}
                <div className="p-5 border-b bg-slate-50">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-slate-800">{sol.cantidad}x {sol.item_nombre}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      sol.prioridad === 'Urgente' ? 'bg-red-100 text-red-700' : 
                      sol.prioridad === 'Normal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'
                    }`}>
                      {sol.prioridad}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold">Solicita:</span> {sol.solicitante_nombre} <br/>
                    <span className="font-semibold">Destino:</span> {sol.sector_maquina}
                  </p>
                  {sol.observaciones && (
                    <p className="text-sm mt-2 bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-200">
                      {sol.observaciones}
                    </p>
                  )}
                </div>

                {/* OPCIONES DE COTIZACIÓN */}
                <div className="p-5 flex-1">
                  <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Opciones de Compra (Cargadas por Pañol)</h4>
                  <div className="space-y-3">
                    
                    {/* Opción 1 */}
                    {sol.proveedor_1 && (
                      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition">
                        <div>
                          <p className="font-bold text-slate-800">{sol.proveedor_1}</p>
                          <p className="text-sm text-slate-500">Unitario: {formatearPlata(sol.precio_unitario_1)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg text-green-700 mb-1">{formatearPlata(sol.precio_unitario_1 * sol.cantidad)}</p>
                          <button 
                            onClick={() => tomarDecision(sol.id, 'Aprobado', sol.proveedor_1, sol.precio_unitario_1)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1 rounded"
                          >
                            Aprobar Opción 1
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Opción 2 */}
                    {sol.proveedor_2 && (
                      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition">
                        <div>
                          <p className="font-bold text-slate-800">{sol.proveedor_2}</p>
                          <p className="text-sm text-slate-500">Unitario: {formatearPlata(sol.precio_unitario_2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg text-green-700 mb-1">{formatearPlata(sol.precio_unitario_2 * sol.cantidad)}</p>
                          <button 
                            onClick={() => tomarDecision(sol.id, 'Aprobado', sol.proveedor_2, sol.precio_unitario_2)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1 rounded"
                          >
                            Aprobar Opción 2
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Opción 3 */}
                    {sol.proveedor_3 && (
                      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition">
                        <div>
                          <p className="font-bold text-slate-800">{sol.proveedor_3}</p>
                          <p className="text-sm text-slate-500">Unitario: {formatearPlata(sol.precio_unitario_3)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-lg text-green-700 mb-1">{formatearPlata(sol.precio_unitario_3 * sol.cantidad)}</p>
                          <button 
                            onClick={() => tomarDecision(sol.id, 'Aprobado', sol.proveedor_3, sol.precio_unitario_3)}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1 rounded"
                          >
                            Aprobar Opción 3
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                {/* BOTÓN DE POSTERGAR */}
                <div className="p-4 bg-slate-100 border-t text-center">
                  <button 
                    onClick={() => tomarDecision(sol.id, 'Postergado')}
                    className="text-red-600 hover:text-red-800 text-sm font-bold underline"
                  >
                    No comprar por ahora (Postergar)
                  </button>
                </div>

              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}