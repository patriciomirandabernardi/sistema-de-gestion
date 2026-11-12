import { Package } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';

function AltaRapida() {
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: '',
    proveedor: '',
    es_critico: false,
    stock_actual: 0,
    stock_ideal: 0,
    punto_pedido: 0
  });
  const [mensaje, setMensaje] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const itemData = {
        nombre: formData.nombre,
        categoria: formData.categoria,
        proveedor_habitual: formData.proveedor,
        es_critico: formData.es_critico,
        stock_actual: parseInt(formData.stock_actual),
        stock_ideal: parseInt(formData.stock_ideal),
        punto_pedido: parseInt(formData.punto_pedido)
      };

      await axios.post('http://localhost:8000/items/', itemData);
      
      setMensaje('Ítem guardado exitosamente');
      setFormData({
        nombre: '',
        categoria: '',
        proveedor: '',
        es_critico: false,
        stock_actual: 0,
        stock_ideal: 0,
        punto_pedido: 0
      });

      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      setMensaje('Error al guardar el ítem');
      console.error('Error:', error);
      setTimeout(() => setMensaje(''), 3000);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Package className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-800">Alta Rápida de Ítem</h2>
      </div>

      {mensaje && (
        <div className={`p-3 rounded-lg text-center font-semibold ${
          mensaje.includes('exitosamente') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {mensaje}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nombre del Ítem
          </label>
          <input
            type="text"
            name="nombre"
            value={formData.nombre}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="Ej: Tornillo M8"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Categoría
          </label>
          <select
            name="categoria"
            value={formData.categoria}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            required
          >
            <option value="">Seleccionar categoría</option>
            <option value="Ferretería">Ferretería</option>
            <option value="Electricidad">Electricidad</option>
            <option value="Herramientas">Herramientas</option>
            <option value="Seguridad">Seguridad</option>
            <option value="Limpieza">Limpieza</option>
            <option value="Oficina">Oficina</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Proveedor Habitual
          </label>
          <input
            type="text"
            name="proveedor"
            value={formData.proveedor}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="Ej: Ferretería Central"
            required
          />
        </div>

        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
          <input
            type="checkbox"
            name="es_critico"
            checked={formData.es_critico}
            onChange={handleChange}
            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
          />
          <label className="text-sm font-semibold text-gray-700">
            ¿Es un ítem crítico?
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Stock Actual
            </label>
            <input
              type="number"
              name="stock_actual"
              value={formData.stock_actual}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Stock Ideal
            </label>
            <input
              type="number"
              name="stock_ideal"
              value={formData.stock_ideal}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Punto de Pedido
            </label>
            <input
              type="number"
              name="punto_pedido"
              value={formData.punto_pedido}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              min="0"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        >
          Guardar Ítem
        </button>
      </form>
    </div>
  );
}

export default AltaRapida;
