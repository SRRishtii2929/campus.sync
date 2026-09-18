import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

type AnimationPhase = 'logo' | 'whirlpool' | 'vortex' | 'bell-pop' | 'bell-strike' | 'strokes' | 'hold' | 'done';

const PHASE_TIMINGS: Record<AnimationPhase, number> = {
  logo: 700,
  whirlpool: 900,
  vortex: 400,
  'bell-pop': 350,
  'bell-strike': 450,
  strokes: 600,
  hold: 300,
  done: 0,
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

/** SVG bell icon matching the CampusSync brand style */
function BrandBell({ size = 56, color = '#7564e8' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path
        d="M50 18c-15 0-23 11-23 28v11c0 9-4 14-8 19-2 3 0 6 5 6h17c2 6 5 9 9 9s7-3 9-9h17c5 0 7-3 5-6-4-5-8-10-8-19V46c0-17-8-28-23-28Z"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M43 19c0-5 3-8 7-8s7 3 7 8"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SVG CampusSync logo with notification strokes */
function BrandLogo({ compact = false }: { compact?: boolean }) {
  const iconSize = compact ? 36 : 80;
  const titleSize = compact ? 'text-lg sm:text-xl' : 'text-3xl sm:text-4xl';
  const taglineSize = compact ? 'text-[8px]' : 'text-xs sm:text-sm';
  const purple = '#7564e8';

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 100 100" style={{ width: iconSize, height: iconSize }} className="shrink-0 cs-brand-icon" fill="none" aria-hidden="true">
        <path
          d="M50 18c-15 0-23 11-23 28v11c0 9-4 14-8 19-2 3 0 6 5 6h17c2 6 5 9 9 9s7-3 9-9h17c5 0 7-3 5-6-4-5-8-10-8-19V46c0-17-8-28-23-28Z"
          className="cs-brand-navy"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M43 19c0-5 3-8 7-8s7 3 7 8"
          className="cs-brand-navy"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M62 43c-3-3-6-5-11-5-8 0-13 5-13 13s5 13 13 13c5 0 8-2 11-5"
          className="cs-brand-navy"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path d="M78 25l8-13M88 36l12-5M89 49l12 1" stroke={purple} strokeWidth="6" strokeLinecap="round" />
      </svg>
      <div className="text-center">
        <div className={`${titleSize} font-semibold leading-none tracking-tight whitespace-nowrap`}>
          <span className="cs-brand-navy-text">Campus</span>
          <span style={{ color: purple }}>Sync</span>
        </div>
        <p className={`${taglineSize} mt-1.5 font-medium tracking-[0.08em] text-slate-500 dark:text-slate-400 whitespace-nowrap`}>
          Notices · Events · Opportunities
        </p>
      </div>
    </div>
  );
}

function FullAnimation({ onComplete, appReady }: { onComplete: () => void; appReady: boolean }) {
  const [phase, setPhase] = useState<AnimationPhase>('logo');
  const [strokeCount, setStrokeCount] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (phase === 'done') {
      // Only proceed if the app is ready; otherwise hold until it is
      if (appReady) {
        setFadingOut(true);
        const t = setTimeout(() => {
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete();
          }
        }, 350);
        return () => clearTimeout(t);
      }
      // App not ready yet — wait, checking periodically
      const t = setTimeout(() => setPhase('done'), 100);
      return () => clearTimeout(t);
    }

    if (phase === 'strokes') {
      if (strokeCount < 3) {
        const t = setTimeout(() => setStrokeCount((c) => c + 1), strokeCount === 0 ? 150 : 180);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('hold'), 250);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      const order: AnimationPhase[] = ['logo', 'whirlpool', 'vortex', 'bell-pop', 'bell-strike', 'strokes', 'hold', 'done'];
      const idx = order.indexOf(phase);
      if (idx < order.length - 1) setPhase(order[idx + 1]);
    }, PHASE_TIMINGS[phase]);
    return () => clearTimeout(t);
  }, [phase, strokeCount, onComplete, appReady]);

  // When app becomes ready during hold phase, speed up transition
  useEffect(() => {
    if (appReady && phase === 'hold') {
      const t = setTimeout(() => setPhase('done'), 100);
      return () => clearTimeout(t);
    }
  }, [appReady, phase]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden ls-screen-bg"
      style={{
        animation: fadingOut ? 'ls-overlay-fade-out 0.35s ease-out forwards' : undefined,
      }}
    >
      {/* Vortex glow layer */}
      {(phase === 'whirlpool' || phase === 'vortex') && (
        <div
          className="absolute rounded-full"
          style={{
            width: 'min(220px, 60vw)',
            height: 'min(220px, 60vw)',
            background: 'radial-gradient(circle, rgba(117,100,232,0.3) 0%, rgba(98,80,207,0.12) 40%, transparent 70%)',
            filter: 'blur(24px)',
            animation: 'ls-vortex-glow 0.6s ease-in-out infinite',
          }}
        />
      )}

      {/* Whirlpool: concentric spinning rings */}
      {phase === 'whirlpool' && (
        <div className="relative flex items-center justify-center" style={{ animation: 'ls-whirlpool-fade-in 0.3s ease-out forwards' }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute rounded-full border-2"
              style={{
                width: 60 + i * 28,
                height: 60 + i * 28,
                borderColor: `rgba(117,100,232,${0.15 + i * 0.08})`,
                borderTopColor: `rgba(117,100,232,${0.5 + i * 0.1})`,
                animation: `ls-whirlpool-spin ${0.8 + i * 0.15}s linear infinite ${i % 2 === 0 ? 'normal' : 'reverse'}`,
              }}
            />
          ))}
        </div>
      )}

      {/* Vortex collapse */}
      {phase === 'vortex' && (
        <div
          className="absolute rounded-full border-2"
          style={{
            width: 'min(180px, 50vw)',
            height: 'min(180px, 50vw)',
            borderColor: 'rgba(117,100,232,0.4)',
            borderTopColor: 'rgba(117,100,232,0.8)',
            animation: 'ls-vortex-spin 0.4s ease-in forwards',
          }}
        >
          <div
            className="absolute inset-2 rounded-full border-2"
            style={{
              borderColor: 'rgba(98,80,207,0.3)',
              borderBottomColor: 'rgba(98,80,207,0.7)',
            }}
          />
        </div>
      )}

      {/* Logo phase — real SVG branding */}
      {phase === 'logo' && (
        <div
          className="flex flex-col items-center"
          style={{ animation: 'ls-fade-in-scale 0.5s ease-out forwards' }}
        >
          <BrandLogo />
        </div>
      )}

      {/* Logo spiraling into whirlpool */}
      {phase === 'whirlpool' && (
        <div
          className="absolute flex flex-col items-center"
          style={{ animation: 'ls-logo-spiral 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
        >
          <BrandLogo />
        </div>
      )}

      {/* Bell phase: pop + strike + notification strokes */}
      {(phase === 'bell-pop' || phase === 'bell-strike' || phase === 'strokes' || phase === 'hold') && (
        <div className="relative flex items-center justify-center">
          {/* Ring ripples during bell-strike */}
          {phase === 'bell-strike' && (
            <>
              <div
                className="absolute rounded-full border border-teal-300/40"
                style={{ width: 80, height: 80, animation: 'ls-ring-ripple 0.6s ease-out forwards' }}
              />
              <div
                className="absolute rounded-full border border-teal-300/30"
                style={{ width: 80, height: 80, animation: 'ls-ring-ripple 0.6s ease-out 0.15s forwards' }}
              />
            </>
          )}

          {/* Bell icon with pop or strike animation */}
          <div
            style={{
              animation:
                phase === 'bell-pop'
                  ? 'ls-bell-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                  : phase === 'bell-strike'
                  ? 'ls-bell-ring 0.45s ease-in-out forwards'
                  : undefined,
              transformOrigin: 'top center',
              filter: 'drop-shadow(0 4px 14px rgba(117,100,232,0.3))',
            }}
          >
            <BrandBell size={56} color="#6250cf" />
          </div>

          {/* Notification strokes — three purple arcs appearing one by one */}
          {(phase === 'strokes' || phase === 'hold') && (
            <div className="absolute" style={{ top: -8, right: -16 }}>
              <div className="relative" style={{ width: 48, height: 48 }}>
                {strokeCount >= 1 && (
                  <svg
                    className="absolute"
                    style={{ top: 4, right: 32, animation: 'ls-notification-stroke 0.3s ease-out forwards' }}
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path d="M2 10 Q6 2, 10 10" stroke="#7564e8" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>
                )}
                {strokeCount >= 2 && (
                  <svg
                    className="absolute"
                    style={{ top: 0, right: 22, animation: 'ls-notification-stroke 0.3s ease-out forwards' }}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path d="M2 12 Q8 1, 14 12" stroke="#6250cf" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>
                )}
                {strokeCount >= 3 && (
                  <svg
                    className="absolute"
                    style={{ top: -4, right: 12, animation: 'ls-notification-stroke 0.3s ease-out forwards' }}
                    width="28"
                    height="28"
                    viewBox="0 0 28 28"
                    fill="none"
                  >
                    <path d="M2 14 Q10 0, 20 14" stroke="#503fae" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                  </svg>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReducedMotionLoader({ onComplete, appReady }: { onComplete: () => void; appReady: boolean }) {
  const completedRef = useRef(false);

  useEffect(() => {
    if (appReady && !completedRef.current) {
      completedRef.current = true;
      const t = setTimeout(onComplete, 300);
      return () => clearTimeout(t);
    }
  }, [appReady, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center px-4 overflow-hidden ls-screen-bg"
    >
      <BrandLogo />
      <div className="mt-6 w-32 h-1 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #7564e8, #6250cf)',
            animation: 'ls-progress-pulse 0.6s ease-in-out infinite alternate',
          }}
        />
      </div>
    </div>
  );
}

export default function LoadingScreen({ onComplete, appReady }: { onComplete: () => void; appReady: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    document.body.classList.add('ls-loading');
    return () => { document.body.classList.remove('ls-loading'); };
  }, []);

  if (!mounted) return null;

  return createPortal(
    reduced ? <ReducedMotionLoader onComplete={onComplete} appReady={appReady} /> : <FullAnimation onComplete={onComplete} appReady={appReady} />,
    document.body,
  );
}
