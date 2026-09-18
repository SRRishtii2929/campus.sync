import { AlertTriangle, Clock, Calendar } from 'lucide-react';
import type { ClashDetail } from '@/lib/clashDetection';

export default function ClashBadge({ clash }: { clash: ClashDetail }) {
  return (
    <div className="rounded-xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white">
              Schedule Clash Detected
            </span>
            <span className="text-xs font-medium text-red-700 dark:text-red-300 capitalize">
              {clash.type.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-800 dark:text-slate-200 font-medium">{clash.message}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {clash.date || 'Recurring weekly'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Overlap: {clash.overlapStart} – {clash.overlapEnd}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="rounded-lg bg-white dark:bg-slate-800/70 px-3 py-2 border border-red-200 dark:border-red-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{clash.activityA.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{clash.activityA.start} – {clash.activityA.end}</p>
            </div>
            <div className="rounded-lg bg-white dark:bg-slate-800/70 px-3 py-2 border border-red-200 dark:border-red-800">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{clash.activityB.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{clash.activityB.start} – {clash.activityB.end}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
