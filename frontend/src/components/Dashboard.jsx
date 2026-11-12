import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

function Dashboard() {
  const [alertas, setAlertas] = useState({ criticas: [], no_criticas: [], stock_ok: 0 });
  
  const criticos = alertas.criticas.length;
  const paraReponer = alertas.no_criticas.length;
  const stockOk = alertas.stock_ok || 0;

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

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Semáforo de Stock</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 text-sm font-semibold uppercase tracking-wide">Críticos</p>
              <p className="text-5xl font-bold text-red-700 mt-2">{criticos}</p>
              <p className="text-red-500 text-xs mt-1">Requieren atención urgente</p>
            </div>
            <AlertTriangle className="w-16 h-16 text-red-400" />
          </div>
        </div>

        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-700 text-sm font-semibold uppercase tracking-wide">Para Reponer</p>
              <p className="text-5xl font-bold text-yellow-800 mt-2">{paraReponer}</p>
              <p className="text-yellow-600 text-xs mt-1">Stock bajo punto de pedido</p>
            </div>
            <AlertCircle className="w-16 h-16 text-yellow-400" />
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-semibold uppercase tracking-wide">Stock OK</p>
              <p className="text-5xl font-bold text-green-700 mt-2">{stockOk}</p>
              <p className="text-green-500 text-xs mt-1">Niveles saludables</p>
            </div>
            <CheckCircle className="w-16 h-16 text-green-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
