import { ShoppingCart, AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

function ListaCompras() {
  const [alertas, setAlertas] = useState({ criticas: [], no_criticas: [] });

  useEffect(() => {
    const fetchAlertas = async () => {
      try {
        const response = await axios.get('http://localhost:8000/alertas/');
        setAlertas(response.data);
      } catch (error) {
        console.error('Error al obtener alertas:', error);
      }
    };

    fetchAlertas();
  }, []);

  const calcularFaltante = (item) => {
    return item.punto_pedido - item.stock_actual;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <ShoppingCart className="w-8 h-8 text-purple-600" />
        <h2 className="text-2xl font-bold text-gray-800">Lista de Compras Pendientes</h2>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-bold text-red-700">Urgentes (Críticos)</h3>
          </div>
          
          {alertas.criticas.length === 0 ? (
            <p className="text-gray-500 italic">No hay ítems críticos pendientes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-red-100">
                    <th className="border border-red-300 px-4 py-2 text-left text-sm font-semibold text-red-800">Ítem</th>
                    <th className="border border-red-300 px-4 py-2 text-left text-sm font-semibold text-red-800">Proveedor</th>
                    <th className="border border-red-300 px-4 py-2 text-center text-sm font-semibold text-red-800">Stock Actual</th>
                    <th className="border border-red-300 px-4 py-2 text-center text-sm font-semibold text-red-800">Punto Pedido</th>
                    <th className="border border-red-300 px-4 py-2 text-center text-sm font-semibold text-red-800">Faltante</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.criticas.map((item) => (
                    <tr key={item.id} className="hover:bg-red-50">
                      <td className="border border-red-200 px-4 py-2 text-sm">{item.nombre}</td>
                      <td className="border border-red-200 px-4 py-2 text-sm">{item.proveedor_habitual}</td>
                      <td className="border border-red-200 px-4 py-2 text-sm text-center font-semibold text-red-600">{item.stock_actual}</td>
                      <td className="border border-red-200 px-4 py-2 text-sm text-center">{item.punto_pedido}</td>
                      <td className="border border-red-200 px-4 py-2 text-sm text-center font-bold text-red-700">{calcularFaltante(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <ShoppingCart className="w-5 h-5 text-yellow-600" />
            <h3 className="text-lg font-bold text-yellow-700">Regulares (No Críticos)</h3>
          </div>
          
          {alertas.no_criticas.length === 0 ? (
            <p className="text-gray-500 italic">No hay ítems regulares pendientes</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-yellow-100">
                    <th className="border border-yellow-300 px-4 py-2 text-left text-sm font-semibold text-yellow-800">Ítem</th>
                    <th className="border border-yellow-300 px-4 py-2 text-left text-sm font-semibold text-yellow-800">Proveedor</th>
                    <th className="border border-yellow-300 px-4 py-2 text-center text-sm font-semibold text-yellow-800">Stock Actual</th>
                    <th className="border border-yellow-300 px-4 py-2 text-center text-sm font-semibold text-yellow-800">Punto Pedido</th>
                    <th className="border border-yellow-300 px-4 py-2 text-center text-sm font-semibold text-yellow-800">Faltante</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.no_criticas.map((item) => (
                    <tr key={item.id} className="hover:bg-yellow-50">
                      <td className="border border-yellow-200 px-4 py-2 text-sm">{item.nombre}</td>
                      <td className="border border-yellow-200 px-4 py-2 text-sm">{item.proveedor_habitual}</td>
                      <td className="border border-yellow-200 px-4 py-2 text-sm text-center font-semibold text-yellow-600">{item.stock_actual}</td>
                      <td className="border border-yellow-200 px-4 py-2 text-sm text-center">{item.punto_pedido}</td>
                      <td className="border border-yellow-200 px-4 py-2 text-sm text-center font-bold text-yellow-700">{calcularFaltante(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ListaCompras;
