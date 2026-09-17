import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';

type AnimationPhase = 'logo' | 'spiral' | 'vortex' | 'bell-pop' | 'bell-ring' | 'strokes' | 'hold' | 'done';

const PHASE_TIMINGS: Record<AnimationPhase, number> = {
  logo: 500,
  spiral: 700,
  vortex: 300,
  'bell-pop': 300,
  'bell-ring': 300,
  strokes: 400,
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

function FullAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<AnimationPhase>('logo');
  const [strokeCount, setStrokeCount] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (phase === 'done') {
      setFadingOut(true);
      const t = setTimeout(onComplete, 300);
      return () => clearTimeout(t);
    }

    if (phase === 'strokes') {
      if (strokeCount < 3) {
        const t = setTimeout(() => setStrokeCount((c) => c + 1), strokeCount === 0 ? 100 : 130);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase('hold'), 200);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      const order: AnimationPhase[] = ['logo', 'spiral', 'vortex', 'bell-pop', 'bell-ring', 'strokes', 'hold', 'done'];
      const idx = order.indexOf(phase);
      if (idx < order.length - 1) setPhase(order[idx + 1]);
    }, PHASE_TIMINGS[phase]);
    return () => clearTimeout(t);
  }, [phase, strokeCount, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #faf9ff 0%, #f5f3ff 50%, #efedff 100%)',
        animation: fadingOut ? 'ls-overlay-fade-out 0.3s ease-out forwards' : undefined,
      }}
    >
      {/* Vortex glow layer */}
      {(phase === 'spiral' || phase === 'vortex') && (
        <div
          className="absolute rounded-full"
          style={{
            width: 200,
            height: 200,
            background: 'radial-gradient(circle, rgba(117,100,232,0.3) 0%, rgba(98,80,207,0.15) 40%, transparent 70%)',
            filter: 'blur(20px)',
            animation: 'ls-vortex-glow 0.5s ease-in-out infinite',
          }}
        />
      )}

      {/* Vortex spiral */}
      {phase === 'vortex' && (
        <div
          className="absolute rounded-full border-2"
          style={{
            width: 160,
            height: 160,
            borderColor: 'rgba(117,100,232,0.4)',
            borderTopColor: 'rgba(117,100,232,0.8)',
            animation: 'ls-vortex-spin 0.3s ease-in forwards',
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

      {/* Logo phase */}
      {phase === 'logo' && (
        <div
          className="flex flex-col items-center"
          style={{ animation: 'ls-fade-in-scale 0.4s ease-out forwards' }}
        >
          <img src="/image copy 2.png" alt="CampusSync" className="w-44 h-16 object-contain" />
          <p className="mt-2 text-sm font-medium text-slate-400 tracking-wide">Notices · Events · Opportunities</p>
        </div>
      )}

      {/* Logo spiraling into vortex */}
      {phase === 'spiral' && (
        <div
          className="flex flex-col items-center"
          style={{ animation: 'ls-logo-spiral 0.7s cubic-bezier(0.4, 0, 0.2, 1) forwards' }}
        >
          <img src="/image copy 2.png" alt="CampusSync" className="w-44 h-16 object-contain" />
        </div>
      )}

      {/* Bell phase: pop + ring */}
      {(phase === 'bell-pop' || phase === 'bell-ring' || phase === 'strokes' || phase === 'hold') && (
        <div className="relative flex items-center justify-center">
          {/* Ring ripples during bell-ring */}
          {phase === 'bell-ring' && (
            <>
              <div
                className="absolute rounded-full border border-teal-300/40"
                style={{ width: 72, height: 72, animation: 'ls-ring-ripple 0.6s ease-out forwards' }}
              />
              <div
                className="absolute rounded-full border border-teal-300/30"
                style={{ width: 72, height: 72, animation: 'ls-ring-ripple 0.6s ease-out 0.15s forwards' }}
              />
            </>
          )}

          {/* Bell icon with pop or ring animation */}
          <div
            style={{
              animation:
                phase === 'bell-pop'
                  ? 'ls-bell-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
                  : phase === 'bell-ring'
                  ? 'ls-bell-ring 0.3s ease-in-out forwards'
                  : undefined,
              transformOrigin: 'top center',
            }}
          >
            <BellRing
              className="w-14 h-14"
              style={{ color: '#6250cf', filter: 'drop-shadow(0 4px 12px rgba(117,100,232,0.3))' }}
              strokeWidth={1.8}
            />
          </div>

          {/* Notification strokes */}
          {(phase === 'strokes' || phase === 'hold') && (
            <div className="absolute" style={{ top: -4, right: -8 }}>
              <div className="relative" style={{ width: 40, height: 40 }}>
                {strokeCount >= 1 && (
                  <svg
                    className="absolute"
                    style={{ top: 2, right: 28, animation: 'ls-notification-stroke 0.25s ease-out forwards' }}
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M2 10 Q6 2, 10 10"
                      stroke="#7564e8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                )}
                {strokeCount >= 2 && (
                  <svg
                    className="absolute"
                    style={{ top: 0, right: 20, animation: 'ls-notification-stroke 0.25s ease-out forwards' }}
                    width="22"
                    height="22"
                    viewBox="0 0 22 22"
                    fill="none"
                  >
                    <path
                      d="M2 11 Q8 1, 14 11"
                      stroke="#6250cf"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                )}
                {strokeCount >= 3 && (
                  <svg
                    className="absolute"
                    style={{ top: -2, right: 12, animation: 'ls-notification-stroke 0.25s ease-out forwards' }}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M2 12 Q10 0, 18 12"
                      stroke="#503fae"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      fill="none"
                    />
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

function ReducedMotionLoader({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 400);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #faf9ff 0%, #f5f3ff 50%, #efedff 100%)' }}
    >
      <img src="/image copy 2.png" alt="CampusSync" className="w-44 h-16 object-contain" />
      <p className="mt-2 text-sm font-medium text-slate-400 tracking-wide">Notices · Events · Opportunities</p>
      <div className="mt-6 w-32 h-1 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #7564e8, #6250cf)',
            animation: 'ls-fade-in-scale 0.4s ease-in-out infinite alternate',
          }}
        />
      </div>
    </div>
  );
}

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (reduced) return <ReducedMotionLoader onComplete={onComplete} />;
  return <FullAnimation onComplete={onComplete} />;
}
