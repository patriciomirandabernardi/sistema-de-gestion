import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PantallaCarga } from './ui';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('pedidos');
  const [solicitudes, setSolicitudes] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para la ventana de Cotización
  const [solicitudACotizar, setSolicitudACotizar] = useState(null);
  const [cotizacion, setCotizacion] = useState({
    proveedor_1: '', precio_unitario_1: '',
    proveedor_2: '', precio_unitario_2: '',
    proveedor_3: '', precio_unitario_3: ''
  });

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
      const [resSolicitudes, resItems] = await Promise.all([
        fetch('http://140.191.1.137:8001/solicitudes/', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('http://140.191.1.137:8001/items/', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (resSolicitudes.status === 401) {
        navigate('/login');
        return;
      }

      setSolicitudes(await resSolicitudes.json());
      setItems(await resItems.json());
      setLoading(false);
    } catch (error) {
      console.error("Error", error);
    }
  };

  const guardarCotizacion = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://140.191.1.137:8001/solicitudes/${solicitudACotizar.id}/cotizar`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          proveedor_1: cotizacion.proveedor_1 || null,
          precio_unitario_1: cotizacion.precio_unitario_1 ? parseFloat(cotizacion.precio_unitario_1) : null,
          proveedor_2: cotizacion.proveedor_2 || null,
          precio_unitario_2: cotizacion.precio_unitario_2 ? parseFloat(cotizacion.precio_unitario_2) : null,
          proveedor_3: cotizacion.proveedor_3 || null,
          precio_unitario_3: cotizacion.precio_unitario_3 ? parseFloat(cotizacion.precio_unitario_3) : null,
        })
      });

      if (res.ok) {
        setSolicitudACotizar(null);
        setCotizacion({ proveedor_1: '', precio_unitario_1: '', proveedor_2: '', precio_unitario_2: '', proveedor_3: '', precio_unitario_3: '' });
        cargarDatos();
      }
    } catch (error) {
      console.error("Error cotizando", error);
    }
  };

  const actualizarEstado = async (id, nuevoEstado) => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`http://140.191.1.137:8001/solicitudes/${id}/estado`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ estado: nuevoEstado })
      });
      if (res.ok) cargarDatos();
    } catch (error) {
      console.error("Error", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) return <PantallaCarga />;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-300">Panel de Administración - Patricio</p>
        </div>
        <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded font-bold transition">Cerrar Sesión</button>
      </header>

      <div className="bg-white border-b flex px-6 space-x-6">
        <button onClick={() => setActiveTab('pedidos')} className={`py-4 font-bold border-b-4 ${activeTab === 'pedidos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Gestión de Pedidos</button>
        <button onClick={() => setActiveTab('catalogo')} className={`py-4 font-bold border-b-4 ${activeTab === 'catalogo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>Catálogo y Stock</button>
      </div>

      <main className="p-6 flex-1">
        {activeTab === 'pedidos' && (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase text-xs">
                  <th className="p-4 border-b">Insumo / Cant</th>
                  <th className="p-4 border-b">Solicitante</th>
                  <th className="p-4 border-b">Estado</th>
                  <th className="p-4 border-b">Resolución Gerencia</th>
                  <th className="p-4 border-b">Acción Patricio</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(sol => (
                  <tr key={sol.id} className="hover:bg-slate-50 border-b">
                    <td className="p-4">
                      <p className="font-bold text-gray-800">{sol.cantidad}x {sol.item_nombre}</p>
                      <p className="text-xs text-gray-500">{sol.sector_maquina} | {sol.prioridad}</p>
                    </td>
                    <td className="p-4 text-sm">{sol.solicitante_nombre}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        sol.estado === 'Pendiente de Cotizar' ? 'bg-yellow-100 text-yellow-700' : 
                        sol.estado === 'Para Aprobar' ? 'bg-blue-100 text-blue-700' :
                        sol.estado === 'Aprobado' ? 'bg-green-100 text-green-700' : 
                        sol.estado === 'Postergado' ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {sol.estado}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-700">
                      {sol.proveedor_elegido ? (
                        <span>Aprobado: <b>{sol.proveedor_elegido}</b> (${sol.precio_aprobado})</span>
                      ) : (
                        <span className="text-gray-400 italic">Esperando...</span>
                      )}
                    </td>
                    <td className="p-4">
                      {sol.estado === 'Pendiente de Cotizar' && (
                        <button onClick={() => setSolicitudACotizar(sol)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold">
                          Cargar Precios
                        </button>
                      )}
                      {sol.estado === 'Para Aprobar' && (
                        <span className="text-xs text-gray-500">Esperando a Miguel...</span>
                      )}
                      {(sol.estado === 'Aprobado' || sol.estado === 'En Camino') && (
                        <select 
                          className="border rounded p-1 text-sm bg-white"
                          value={sol.estado}
                          onChange={(e) => actualizarEstado(sol.id, e.target.value)}
                        >
                          <option value="Aprobado">Aprobado (Falta pedir)</option>
                          <option value="En Camino">En Camino</option>
                          <option value="Recibido">Marcar Recibido (Ingresar a Pañol)</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PESTAÑA CATÁLOGO (VACÍA POR AHORA PARA ENFOCARNOS EN COMPRAS) */}
        {activeTab === 'catalogo' && (
          <div className="p-10 text-center text-gray-500">
            Catálogo en construcción. Enfocate en probar los pedidos.
          </div>
        )}
      </main>

      {/* VENTANA EMERGENTE PARA COTIZAR */}
      {solicitudACotizar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Cotizar: {solicitudACotizar.item_nombre}</h2>
            <p className="text-sm text-gray-600 mb-4">Ingresá hasta 3 opciones para que Miguel decida.</p>
            
            <form onSubmit={guardarCotizacion} className="space-y-4">
              {/* Opción 1 */}
              <div className="flex gap-2">
                <input type="text" placeholder="Proveedor 1" value={cotizacion.proveedor_1} onChange={e => setCotizacion({...cotizacion, proveedor_1: e.target.value})} className="flex-1 border p-2 rounded" required />
                <input type="number" step="0.01" placeholder="$ Precio Unitario" value={cotizacion.precio_unitario_1} onChange={e => setCotizacion({...cotizacion, precio_unitario_1: e.target.value})} className="w-1/3 border p-2 rounded" required />
              </div>
              {/* Opción 2 */}
              <div className="flex gap-2">
                <input type="text" placeholder="Proveedor 2 (Opcional)" value={cotizacion.proveedor_2} onChange={e => setCotizacion({...cotizacion, proveedor_2: e.target.value})} className="flex-1 border p-2 rounded" />
                <input type="number" step="0.01" placeholder="$" value={cotizacion.precio_unitario_2} onChange={e => setCotizacion({...cotizacion, precio_unitario_2: e.target.value})} className="w-1/3 border p-2 rounded" />
              </div>
              {/* Opción 3 */}
              <div className="flex gap-2">
                <input type="text" placeholder="Proveedor 3 (Opcional)" value={cotizacion.proveedor_3} onChange={e => setCotizacion({...cotizacion, proveedor_3: e.target.value})} className="flex-1 border p-2 rounded" />
                <input type="number" step="0.01" placeholder="$" value={cotizacion.precio_unitario_3} onChange={e => setCotizacion({...cotizacion, precio_unitario_3: e.target.value})} className="w-1/3 border p-2 rounded" />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setSolicitudACotizar(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded">Guardar y Enviar a Gerencia</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}