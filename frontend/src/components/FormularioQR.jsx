import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function FormularioQR() {
  const [items, setItems] = useState([]);
  const [carrito, setCarrito] = useState([]); // Nueva lista para el carrito
  const [formData, setFormData] = useState({
    item_id: '',
    item_otro: '',
    cantidad: 1,
    sector_maquina: '',
    prioridad: 'Normal',
    observaciones: ''
  });
  const [estado, setEstado] = useState('idle');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch('http://140.191.1.137:8001/items/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setItems(data))
      .catch(err => console.error("Error cargando items:", err));
  }, [navigate]);

  const agregarAlCarrito = (e) => {
    e.preventDefault();
    
    // Buscamos el nombre para mostrarlo lindo en el resumen
    let nombreDisplay = formData.item_otro;
    if (formData.item_id !== 'otro') {
      const itemEncontrado = items.find(i => i.id === parseInt(formData.item_id));
      if (itemEncontrado) nombreDisplay = itemEncontrado.nombre;
    }

    setCarrito([...carrito, { ...formData, nombre_display: nombreDisplay }]);
    
    // Limpiamos el formulario pero dejamos el sector para agilizar la carga
    setFormData({ 
      ...formData, 
      item_id: '', item_otro: '', cantidad: 1, 
      prioridad: 'Normal', observaciones: '' 
    });
  };

  const eliminarDelCarrito = (index) => {
    setCarrito(carrito.filter((_, i) => i !== index));
  };

  const enviarPedidoCompleto = async () => {
    setEstado('loading');
    const token = localStorage.getItem('token');

    try {
      // Mandamos cada item del carrito como una solicitud individual a la base de datos
      for (const item of carrito) {
        await fetch('http://140.191.1.137:8001/solicitudes/', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            item_id: item.item_id === 'otro' ? null : parseInt(item.item_id),
            item_otro: item.item_id === 'otro' ? item.item_otro : null,
            cantidad: parseInt(item.cantidad),
            sector_maquina: item.sector_maquina,
            prioridad: item.prioridad,
            observaciones: item.observaciones
          })
        });
      }

      setEstado('success');
      setCarrito([]); // Vaciamos el carrito
      setFormData({ ...formData, sector_maquina: '' }); // Ahora sí limpiamos el sector
      setTimeout(() => setEstado('idle'), 3000);
      
    } catch (error) {
      setEstado('error');
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (estado === 'success') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-green-50 p-6 text-center">
        <div className="bg-green-500 text-white rounded-full p-4 mb-4">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h2 className="text-2xl font-bold text-green-800">¡Pedidos Enviados!</h2>
        <p className="text-green-600 mt-2">La solicitud ya ingresó al pañol de IMCAYPER.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex flex-col items-center pb-10">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-6 mt-4 relative">
        <button onClick={handleLogout} className="absolute top-4 right-4 text-sm text-red-500 font-semibold hover:text-red-700">
          Cerrar Sesión
        </button>
        
        <h1 className="text-2xl font-bold text-gray-800 mb-6 mt-2 text-center">Solicitud de Insumos</h1>
        
        {/* FORMULARIO DE CARGA */}
        <form onSubmit={agregarAlCarrito} className="space-y-4 border-b pb-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">¿Qué necesitás?</label>
            <select name="item_id" value={formData.item_id} onChange={handleChange} required className="w-full border rounded-lg p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccioná un repuesto/insumo...</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.nombre}</option>
              ))}
              <option value="otro" className="font-bold text-blue-600">Otro (No está en la lista)</option>
            </select>
          </div>

          {formData.item_id === 'otro' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-medium text-blue-800 mb-1">Nombre del repuesto:</label>
              <input type="text" name="item_otro" value={formData.item_otro} onChange={handleChange} required className="w-full border rounded-lg p-3 bg-white outline-none focus:ring-2 focus:ring-blue-500"/>
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input type="number" name="cantidad" min="1" value={formData.cantidad} onChange={handleChange} required className="w-full border rounded-lg p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
              <select name="prioridad" value={formData.prioridad} onChange={handleChange} className="w-full border rounded-lg p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500">
                <option value="Baja">Baja</option>
                <option value="Normal">Normal</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sector o Máquina destino</label>
            <input type="text" name="sector_maquina" value={formData.sector_maquina} onChange={handleChange} required placeholder="Ej: Torno 3" className="w-full border rounded-lg p-3 bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones (Opcional)</label>
            <textarea name="observaciones" rows="1" value={formData.observaciones} onChange={handleChange} className="w-full border rounded-lg p-3 bg-gray-50 outline-none resize-none focus:ring-2 focus:ring-blue-500"></textarea>
          </div>

          <button type="submit" className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-lg transition-colors">
            + Agregar a la lista
          </button>
        </form>

        {/* RESUMEN DEL CARRITO */}
        <div>
          <h3 className="font-bold text-gray-800 mb-3 flex items-center justify-between">
            Lista de Pedido
            <span className="bg-blue-100 text-blue-800 text-xs py-1 px-2 rounded-full">{carrito.length} items</span>
          </h3>
          
          {carrito.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No agregaste nada todavía.</p>
          ) : (
            <ul className="space-y-3 mb-6 max-h-48 overflow-y-auto pr-1">
              {carrito.map((item, index) => (
                <li key={index} className="bg-gray-50 border rounded p-3 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-gray-800">{item.cantidad}x {item.nombre_display}</p>
                    <p className="text-xs text-gray-500">{item.sector_maquina} | {item.prioridad}</p>
                  </div>
                  <button onClick={() => eliminarDelCarrito(index)} className="text-red-500 hover:text-red-700 p-2 text-xl font-bold">×</button>
                </li>
              ))}
            </ul>
          )}

          <button 
            onClick={enviarPedidoCompleto}
            disabled={carrito.length === 0 || estado === 'loading'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg text-lg transition-colors disabled:bg-slate-300"
          >
            {estado === 'loading' ? 'Enviando...' : `Enviar Pedido Completo`}
          </button>
        </div>

      </div>
    </div>
  );
}