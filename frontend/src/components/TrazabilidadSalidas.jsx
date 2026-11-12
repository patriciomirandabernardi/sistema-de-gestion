import { useState, useEffect } from 'react';
import { getSalidas, mensajeError } from '../api';
import { MAQUINAS_FLOTA, DESTINO_EPP, MESES, formatearMoneda, formatearFecha } from '../constants';
import { abrirImpresionA4, escaparHtml } from '../imprimir';
import { CargaSeccion, Spinner } from './ui';
import { claseBotonPagina } from '../estilos';
import { FileDown, Wrench, History, ClipboardList } from 'lucide-react';

const ANIO_INICIAL = 2025;
const AVISO_EPP = 'Mirar Planilla Física de EPP';

const textoDestino = (s) => s.tipo_destino === 'operario'
  ? AVISO_EPP
  : `${s.maquina}${s.parte_maquina ? ` — ${s.parte_maquina}` : ''}`;

// Historial de salidas del pañol con ranking de consumo por máquina (Admin y Gerencia)
export default function TrazabilidadSalidas() {
  const hoy = new Date();
  const [anio, setAnio] = useState(String(hoy.getFullYear()));
  const [mes, setMes] = useState(String(hoy.getMonth() + 1));
  const [maquina, setMaquina] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const anios = Array.from({ length: hoy.getFullYear() - ANIO_INICIAL + 1 }, (_, i) => String(hoy.getFullYear() - i));

  // Espera a que el usuario deje de tipear antes de consultar
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    setCargando(true);
    setError('');
    getSalidas({ anio, mes: anio ? mes : '', maquina, q: busquedaAplicada })
      .then(setReporte)
      .catch(err => setError(mensajeError(err)))
      .finally(() => setCargando(false));
  }, [anio, mes, maquina, busquedaAplicada]);

  const periodoTexto = !anio ? 'Todos los períodos' : mes ? `${MESES[mes - 1]} ${anio}` : `Año ${anio}`;
  const filtrosTexto = [periodoTexto, maquina || 'Todas las máquinas', busquedaAplicada && `Búsqueda: "${busquedaAplicada}"`].filter(Boolean).join(' · ');
  const maxTotal = Math.max(...(reporte?.por_maquina.map(m => m.total) || [0]), 0);

  const exportarPDF = () => {
    const filasRanking = reporte.por_maquina.filter(m => m.retiros > 0).map(m => `
      <tr><td><b>${escaparHtml(m.maquina)}</b><div class="sub">${escaparHtml(m.descripcion || '')}</div></td>
      <td class="num">${m.retiros}</td><td class="num">${m.unidades}</td>
      <td class="num">${formatearMoneda(m.total)}</td><td class="num">${m.porcentaje.toFixed(1)}%</td></tr>`).join('');
    const filasDetalle = reporte.detalle.map(s => `
      <tr><td>${formatearFecha(s.fecha)}</td>
      <td>${escaparHtml(s.insumo)}<div class="sub">${escaparHtml(s.categoria_gasto || '')}</div></td>
      <td class="num">${s.cantidad}</td><td class="num">${formatearMoneda(s.precio_unitario)}</td>
      <td class="num">${formatearMoneda(s.total)}</td>
      <td>${escaparHtml(s.retirado_por || '-')}</td><td>${escaparHtml(textoDestino(s))}</td></tr>`).join('');

    abrirImpresionA4({
      titulo: `Trazabilidad de Salidas - ${periodoTexto}`,
      documento: 'Trazabilidad de Salidas del Pañol por Máquina',
      cuerpo: `
        <div class="meta">
          <div><b>Filtros:</b> ${escaparHtml(filtrosTexto)}<br><b>Retiros:</b> ${reporte.detalle.length} · <b>Unidades:</b> ${reporte.total_unidades}</div>
          <div class="total"><span>CONSUMO VALORIZADO</span><strong>${formatearMoneda(reporte.total)}</strong></div>
        </div>
        <h2>Consumo por Máquina</h2>
        <table><thead><tr><th>Máquina</th><th class="num">Retiros</th><th class="num">Unidades</th><th class="num">Costo ($)</th><th class="num">% del total</th></tr></thead>
          <tbody>${filasRanking || '<tr><td colspan="5">Sin salidas en el período</td></tr>'}</tbody>
          <tfoot><tr><td>Total</td><td class="num">${reporte.detalle.length}</td><td class="num">${reporte.total_unidades}</td><td class="num">${formatearMoneda(reporte.total)}</td><td class="num">100%</td></tr></tfoot>
        </table>
        <h2>Detalle de Salidas</h2>
        <table><thead><tr><th>Fecha</th><th>Insumo</th><th class="num">Cant.</th><th class="num">P. Unit. ($)</th><th class="num">Costo Total ($)</th><th>Retirado por</th><th>Destino</th></tr></thead>
          <tbody>${filasDetalle || '<tr><td colspan="7">Sin salidas en el período</td></tr>'}</tbody>
          <tfoot><tr><td colspan="4">TOTAL CONSUMIDO</td><td class="num">${formatearMoneda(reporte.total)}</td><td colspan="2"></td></tr></tfoot>
        </table>
        <p class="pie">Costo Total = Cantidad × precio unitario del insumo al momento del retiro. Las entregas a operarios se detallan en la Planilla Física de EPP.</p>`
    });
  };

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <section className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Año</label>
          <select value={anio} onChange={(e) => setAnio(e.target.value)} className="border rounded-lg p-2 bg-slate-50">
            <option value="">Todos</option>
            {anios.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Mes</label>
          <select value={anio ? mes : ''} onChange={(e) => setMes(e.target.value)} disabled={!anio}
            className="border rounded-lg p-2 bg-slate-50 disabled:opacity-50">
            <option value="">Todo el año</option>
            {MESES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Máquina</label>
          <select value={maquina} onChange={(e) => setMaquina(e.target.value)} className="border rounded-lg p-2 bg-slate-50">
            <option value="">Todas</option>
            {MAQUINAS_FLOTA.map(m => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)}
            <option value={DESTINO_EPP}>EPP / Operarios</option>
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Buscar</label>
          <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder='Ej: "6310", "parante", "Eduardo"'
            className="w-full border rounded-lg p-2 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        {cargando && reporte && <Spinner className="h-5 w-5 border-2 mb-2.5" />}
        <button onClick={exportarPDF} disabled={!reporte || cargando} className={claseBotonPagina()}>
          <FileDown size={16} /> Exportar Trazabilidad PDF
        </button>
      </section>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg">{error}</div>}

      {/* Al cambiar filtros o buscar se mantiene el reporte anterior atenuado: sin saltos de pantalla */}
      {!reporte ? <CargaSeccion /> : (
        <div className={`space-y-6 transition-opacity duration-200 ${cargando ? 'opacity-50' : ''}`}>
          {/* Ranking por máquina */}
          <section className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-wrap justify-between items-baseline gap-2 mb-4">
              <h2 className="text-lg font-bold text-slate-800 inline-flex items-center gap-2"><Wrench size={18} className="text-slate-500" /> Consumo por Máquina</h2>
              <p className="text-sm text-slate-600">
                {periodoTexto} · <span className="font-bold text-slate-900">{formatearMoneda(reporte.total)}</span> en {reporte.detalle.length} retiros ({reporte.total_unidades} u.)
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {reporte.por_maquina.map((m, idx) => (
                <div key={m.maquina} className={`p-3 border rounded-lg ${m.retiros ? 'border-slate-300' : 'border-slate-100 opacity-50'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="font-bold text-slate-800">
                        {m.retiros > 0 && idx < 3 && (
                          <span className="mr-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-slate-800 text-white text-[11px] font-bold align-middle">{idx + 1}</span>
                        )}
                        {m.maquina}
                      </p>
                      <p className="text-xs text-slate-500 leading-tight">{m.descripcion}</p>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="font-bold text-slate-900">{formatearMoneda(m.total)}</p>
                      <p className="text-xs text-slate-500">{m.porcentaje.toFixed(1)}% · {m.retiros} retiros · {m.unidades} u.</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2 overflow-hidden">
                    <div className="bg-orange-600 h-2 rounded-full" style={{ width: `${maxTotal ? (m.total * 100) / maxTotal : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tabla de trazabilidad */}
          <section className="bg-white rounded-lg shadow overflow-hidden">
            <h2 className="text-lg font-bold text-slate-800 p-4 border-b flex items-center gap-2"><History size={18} className="text-slate-500" /> Historial de Salidas</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left text-slate-700 font-semibold">Fecha</th>
                    <th className="p-3 text-left text-slate-700 font-semibold">Insumo</th>
                    <th className="p-3 text-right text-slate-700 font-semibold">Cantidad</th>
                    <th className="p-3 text-right text-slate-700 font-semibold">Costo Total ($)</th>
                    <th className="p-3 text-left text-slate-700 font-semibold">Retirado por</th>
                    <th className="p-3 text-left text-slate-700 font-semibold">Destino</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.detalle.length === 0 && (
                    <tr><td colSpan="6" className="p-8 text-center text-slate-500">Sin salidas para los filtros seleccionados</td></tr>
                  )}
                  {reporte.detalle.map(s => (
                    <tr key={s.movimiento_id} className="border-b hover:bg-slate-50">
                      <td className="p-3 text-sm text-slate-600">{formatearFecha(s.fecha)}</td>
                      <td className="p-3">
                        <p className="font-medium text-slate-800">{s.insumo}</p>
                        <p className="text-xs text-slate-500">{s.categoria_gasto}</p>
                      </td>
                      <td className="p-3 text-right">{s.cantidad}</td>
                      <td className="p-3 text-right">
                        <p className="font-semibold">{formatearMoneda(s.total)}</p>
                        <p className="text-xs text-slate-500">{s.cantidad} u. × {formatearMoneda(s.precio_unitario)} c/u</p>
                      </td>
                      <td className="p-3 text-sm">{s.retirado_por || '-'}</td>
                      <td className="p-3 text-sm">
                        {s.tipo_destino === 'operario' ? (
                          <span className="text-blue-700 inline-flex items-center gap-1"><ClipboardList size={14} /> {AVISO_EPP}</span>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-800">{s.maquina}</p>
                            {s.parte_maquina && <p className="text-xs text-slate-500">{s.parte_maquina}</p>}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {reporte.detalle.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-800 text-white">
                      <td colSpan="3" className="p-3 font-bold">TOTAL CONSUMIDO</td>
                      <td className="p-3 text-right font-bold">{formatearMoneda(reporte.total)}</td>
                      <td colSpan="2"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
