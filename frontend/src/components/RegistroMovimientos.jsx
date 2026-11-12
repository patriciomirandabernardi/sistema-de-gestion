import { ArrowDownCircle, ArrowUpCircle, Activity } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

function RegistroMovimientos() {
  const [items, setItems] = useState([]);
  const [formData, setFormData] = useState({
    item_id: '',
    tipo_movimiento: 'ingreso',
    cantidad: 0
  });
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await axios.get('http://localhost:8000/items/');
        setItems(response.data);
      } catch (error) {
        console.error('Error al cargar ítems:', error);
      }
    };

    fetchItems();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const movimientoData = {
        item_id: parseInt(formData.item_id),
        tipo_movimiento: formData.tipo_movimiento,
        cantidad: parseInt(formData.cantidad)
      };

      await axios.post('http://localhost:8000/movimientos/', movimientoData);
      
      setMensaje('Movimiento registrado exitosamente');
      setFormData({
        item_id: '',
        tipo_movimiento: 'ingreso',
        cantidad: 0
      });

      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      setMensaje('Error al registrar el movimiento');
      console.error('Error:', error);
      setTimeout(() => setMensaje(''), 3000);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-8 h-8 text-green-600" />
        <h2 className="text-2xl font-bold text-gray-800">Registro de Movimientos</h2>
      </div>

      {mensaje && (
        <div className={`p-3 rounded-lg text-center font-semibold mb-4 ${
          mensaje.includes('exitosamente') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {mensaje}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Seleccionar Ítem
          </label>
          <select
            name="item_id"
            value={formData.item_id}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            required
          >
            <option value="">-- Seleccione un ítem --</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} ({item.categoria})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Tipo de Movimiento
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tipo_movimiento: 'ingreso' })}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                formData.tipo_movimiento === 'ingreso'
                  ? 'bg-green-600 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ArrowDownCircle className="w-5 h-5" />
              Ingreso
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, tipo_movimiento: 'egreso' })}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                formData.tipo_movimiento === 'egreso'
                  ? 'bg-orange-600 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ArrowUpCircle className="w-5 h-5" />
              Egreso
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Cantidad
          </label>
          <input
            type="number"
            name="cantidad"
            value={formData.cantidad}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            min="1"
            required
          />
        </div>

        <button
          type="submit"
          className={`w-full text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 ${
            formData.tipo_movimiento === 'ingreso'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-orange-600 hover:bg-orange-700'
          }`}
        >
          {formData.tipo_movimiento === 'ingreso' ? 'Registrar Ingreso' : 'Registrar Egreso'}
        </button>
      </form>
    </div>
  );
}

export default RegistroMovimientos;
