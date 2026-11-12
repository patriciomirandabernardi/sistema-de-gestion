import { formatearMoneda } from '../constants';

// Muestra siempre ambos valores: "10 u. × $5.000 c/u = $50.000 Total"
export default function CalculoPrecio({ cantidad, unitario, className = '' }) {
  const cant = Number(cantidad) || 0;
  const unit = Number(unitario) || 0;
  return (
    <span className={`whitespace-nowrap ${className}`}>
      <span className="text-slate-500">{cant} u. × {formatearMoneda(unit)} c/u = </span>
      <span className="font-bold text-slate-900">{formatearMoneda(cant * unit)}</span>
      <span className="text-slate-500"> Total</span>
    </span>
  );
}
