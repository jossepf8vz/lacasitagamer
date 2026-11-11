'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type ConfirmationItem = {
  name: string;
  variantId: string;
  quantity: number;
  priceUsd: number;
};

type ConfirmationDetails = {
  items: ConfirmationItem[];
  email: string;
  submittedAt: number;
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') ?? '';
  const [details, setDetails] = useState<ConfirmationDetails | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(300);

  useEffect(() => {
    if (!orderId) return;

    try {
      const saved = sessionStorage.getItem(`checkout-success-${orderId}`);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<ConfirmationDetails>;
      if (!Array.isArray(parsed.items) || typeof parsed.submittedAt !== 'number') return;
      setDetails(parsed as ConfirmationDetails);
      setSecondsRemaining(Math.max(0, 300 - Math.floor((Date.now() - parsed.submittedAt) / 1000)));
    } catch (error) {
      console.error('No se pudo recuperar el resumen de confirmación del pedido.', error);
    }
  }, [orderId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    const minutes = Math.floor(secondsRemaining / 60).toString().padStart(2, '0');
    const seconds = (secondsRemaining % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [secondsRemaining]);

  const confetti = useMemo(
    () => Array.from({ length: 36 }, (_, index) => ({
      left: `${(index * 37 + 13) % 100}%`,
      delay: `${(index % 12) * -0.23}s`,
      color: ['#a78bfa', '#22d3ee', '#34d399', '#fbbf24', '#f472b6'][index % 5],
    })),
    []
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-12 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((piece, index) => (
          <span
            key={index}
            className="checkout-confetti absolute top-[-12px] h-2.5 w-1.5 rounded-sm opacity-80"
            style={{ left: piece.left, backgroundColor: piece.color, animationDelay: piece.delay }}
          />
        ))}
      </div>

      <section className="relative mx-auto max-w-xl rounded-3xl border border-slate-800 bg-slate-900/95 p-6 text-center shadow-2xl shadow-purple-950/30 sm:p-9">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl text-emerald-300" aria-hidden="true">
          ✓
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Pedido recibido</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">¡Gracias por tu compra!</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-300">
          Tu pedido ha sido recibido con éxito. En breve verificaremos tu pago y te enviaremos tu clave/producto a los datos de contacto proporcionados.
        </p>

        {orderId ? (
          <p className="mt-5 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400">
            Número de pedido: <strong className="font-mono text-purple-300">{`LCG-${orderId.slice(0, 8).toUpperCase()}`}</strong>
          </p>
        ) : (
          <p role="alert" className="mt-5 rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
            No se encontró el identificador del pedido. Si recibiste esta página después de pagar, contacta a soporte.
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tiempo estimado de validación y despacho</p>
          <p className="mt-2 font-mono text-4xl font-black tabular-nums text-cyan-300" aria-live="polite">{countdown}</p>
          {secondsRemaining === 0 && (
            <p className="mt-2 text-xs text-slate-400">La validación puede tardar un poco más; tu pedido sigue registrado.</p>
          )}
        </div>

        {details && (
          <div className="mt-6 text-left">
            <h2 className="text-sm font-bold text-white">Resumen de tu pedido</h2>
            <ul className="mt-2 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950 px-4">
              {details.items.map((item, index) => (
                <li key={`${item.variantId}-${index}`} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="text-slate-200">{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</span>
                  <span className="shrink-0 font-mono text-cyan-300">${(item.priceUsd * item.quantity).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">Confirmación enviada para: {details.email}</p>
          </div>
        )}

        <a href="/" className="mt-7 inline-flex rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold transition hover:bg-purple-500">
          Volver a la tienda
        </a>
      </section>

      <style jsx global>{`
        @keyframes checkout-confetti-fall {
          0% { transform: translate3d(0, -4vh, 0) rotate(0deg); }
          100% { transform: translate3d(18px, 105vh, 0) rotate(720deg); }
        }
        .checkout-confetti {
          animation: checkout-confetti-fall 5s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .checkout-confetti { animation: none; }
        }
      `}</style>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950 p-8 text-center text-slate-300">Cargando confirmación…</main>}>
      <SuccessContent />
    </Suspense>
  );
}
