import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInsumos, getMisPedidos } from '../api';
import { BADGE_ESTADO, textoEstado, numeroRequerimiento } from '../constants';
import { abrirImpresionA4, escaparHtml } from '../imprimir';
import { PantallaCarga, EtiquetaSolicitud } from './ui';
import { claseAccion, claseBotonHeader, claseBotonPagina } from '../estilos';
import { LogOut, Plus, FileDown, CircleCheck, X } from 'lucide-react';
import ModalNuevoPedido from './ModalNuevoPedido';

// Remito interno de la solicitud: todos los ítems pedidos juntos (o el pedido suelto, si es anterior a las solicitudes)
const descargarComprobante = (pedido, misPedidos) => {
  const renglones = pedido.codigo_solicitud
    ? misPedidos.filter(p => p.codigo_solicitud === pedido.codigo_solicitud).sort((a, b) => a.id - b.id)
    : [pedido];
  const referencia = pedido.codigo_solicitud || numeroRequerimiento(pedido.id);
  const filas = renglones.map(p => `
    <tr><td>${numeroRequerimiento(p.id)}</td>
      <td><b>${escaparHtml(p.insumo_nombre)}</b>${p.insumo_id ? '' : '<div class="sub">Insumo nuevo (no está en el catálogo)</div>'}
        ${p.observaciones ? `<div class="sub">${escaparHtml(p.observaciones)}</div>` : ''}</td>
      <td class="num">${p.cantidad_solicitada}</td>
      <td>${escaparHtml(p.criticidad)}</td>
      <td>${escaparHtml(textoEstado(p.estado))}</td></tr>`).join('');

  abrirImpresionA4({
    titulo: `Comprobante ${referencia}`,
    documento: `Remito Interno de Solicitud · ${referencia}`,
    cuerpo: `
      <div class="meta">
        <div><b>Fecha:</b> ${new Date(pedido.fecha_creacion).toLocaleString('es-AR')}<br>
          <b>Supervisor solicitante:</b> ${escaparHtml(pedido.supervisor_nombre)}<br>
          <b>Ítems:</b> ${renglones.length}</div>
        <div class="total"><span>SOLICITUD</span><strong>${escaparHtml(referencia)}</strong></div>
      </div>
      <table>
        <thead><tr><th>Requerimiento</th><th>Insumo / Justificación</th><th class="num">Cantidad Solicitada</th><th>Criticidad</th><th>Estado actual</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <p class="pie">Comprobante interno de requerimiento. Cada ítem se cotiza y aprueba por separado; la cantidad solicitada no puede modificarse y Gerencia define la cantidad aprobada.</p>`
  });
};

export default function PanelSupervisor() {
  const [insumos, setInsumos] = useState([]);
  const [misPedidos, setMisPedidos] = useState([]);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    if (!localStorage.getItem('token')) {
      navigate('/login');
      return;
    }
    try {
      const [insumosData, pedidosData] = await Promise.all([getInsumos(), getMisPedidos()]);
      setInsumos(insumosData);
      setMisPedidos(pedidosData);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const alCrear = ({ codigo_solicitud, pedidos }) => {
    setModalNuevo(false);
    setAviso(`Solicitud ${codigo_solicitud} enviada con ${pedidos.length} ${pedidos.length === 1 ? 'ítem' : 'ítems'}.`);
    cargarDatos();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  if (loading) return <PantallaCarga subtitulo="Panel de Supervisor - Carga de Pedidos" />;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="bg-slate-800 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h1 className="text-2xl font-bold">IMCAYPER</h1>
          <p className="text-sm text-slate-400">Panel de Supervisor - Carga de Pedidos</p>
        </div>
        <button onClick={handleLogout} className={claseBotonHeader('salir')}><LogOut size={16} /> Cerrar Sesión</button>
      </header>

      <main className="p-6 max-w-5xl mx-auto w-full space-y-6">
        <section className="bg-white rounded-lg shadow p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Nuevo Pedido de Compra</h2>
            <p className="text-sm text-slate-500">Podés pedir varios insumos en una misma solicitud.</p>
          </div>
          <button onClick={() => setModalNuevo(true)} className={`${claseBotonPagina('primaria')} text-base px-5 py-2.5`}>
            <Plus size={18} /> Nuevo Pedido
          </button>
        </section>

        {aviso && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded-lg flex justify-between items-center">
            <span className="inline-flex items-center gap-2"><CircleCheck size={16} /> {aviso}</span>
            <button onClick={() => setAviso('')} className="text-green-700 hover:text-green-900 p-1 rounded-md" aria-label="Cerrar aviso"><X size={16} /></button>
          </div>
        )}

        {/* Seguimiento de mis Pedidos */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Seguimiento de mis Pedidos</h2>
          {misPedidos.length === 0 ? (
            <div className="text-center text-slate-500">No has creado pedidos aún</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-4 text-left text-slate-700 font-semibold">Requerimiento</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Insumo</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Cantidad</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Fecha</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Estado</th>
                    <th className="p-4 text-left text-slate-700 font-semibold">Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {misPedidos.map(pedido => (
                    <tr key={pedido.id} className="border-b hover:bg-slate-50">
                      <td className="p-4">
                        <p className="font-mono text-sm text-slate-700">{numeroRequerimiento(pedido.id)}</p>
                        <EtiquetaSolicitud codigo={pedido.codigo_solicitud} className="mt-1" />
                      </td>
                      <td className="p-4">
                        <p className="font-bold text-slate-800">{pedido.insumo_nombre}</p>
                        <p className="text-xs text-slate-500">{pedido.criticidad}{pedido.observaciones && ` · ${pedido.observaciones}`}</p>
                      </td>
                      <td className="p-4">
                        <p>Solicitado: <span className="font-bold">{pedido.cantidad_solicitada}</span></p>
                        {pedido.cantidad_aprobada != null && (
                          <p className={`text-xs ${pedido.cantidad_aprobada !== pedido.cantidad_solicitada ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
                            Aprobado: {pedido.cantidad_aprobada}
                          </p>
                        )}
                      </td>
                      <td className="p-4 text-sm text-slate-600">{new Date(pedido.fecha_creacion).toLocaleDateString('es-AR')}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${BADGE_ESTADO[pedido.estado] || 'bg-gray-100 text-gray-700'}`}>
                          {textoEstado(pedido.estado)}
                        </span>
                      </td>
                      <td className="p-4">
                        <button onClick={() => descargarComprobante(pedido, misPedidos)} className={claseAccion('neutra')}
                          title={pedido.codigo_solicitud ? 'Incluye todos los ítems de la solicitud' : undefined}>
                          <FileDown size={13} /> Descargar Comprobante
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

      {modalNuevo && <ModalNuevoPedido insumos={insumos} onCerrar={() => setModalNuevo(false)} onCreado={alCrear} />}
    </div>
  );
}
