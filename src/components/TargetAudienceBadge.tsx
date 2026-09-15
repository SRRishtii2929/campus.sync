import { Target, GraduationCap, Calendar } from 'lucide-react';

interface TargetAudienceBadgeProps {
  branches?: string[] | null;
  years?: string[] | null;
  branch?: string | null;
  year?: string | null;
  section?: string | null;
  variant?: 'compact' | 'full';
}

export default function TargetAudienceBadge({
  branches,
  years,
  branch,
  year,
  section,
  variant = 'full',
}: TargetAudienceBadgeProps) {
  const hasTargeting = (branches && branches.length > 0) || (years && years.length > 0) || branch || year;

  if (!hasTargeting) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
        <Target className="w-3 h-3" /> All Students
      </span>
    );
  }

  if (variant === 'compact') {
    const parts: string[] = [];
    if (branch) parts.push(branch);
    if (year) parts.push(year);
    if (section) parts.push(`Sec ${section}`);
    if (branches && branches.length > 0) parts.push(branches.join(', '));
    if (years && years.length > 0) parts.push(years.join(', '));
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
        <Target className="w-3 h-3" /> {parts.join(' · ')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {branch && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-600 text-white">
          <GraduationCap className="w-3 h-3" /> {branch}
        </span>
      )}
      {year && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-600 text-white">
          <Calendar className="w-3 h-3" /> {year}
        </span>
      )}
      {section && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-600 text-white">
          Section {section}
        </span>
      )}
      {branches && branches.length > 0 && branches.map((b) => (
        <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-600 text-white">
          <GraduationCap className="w-3 h-3" /> {b}
        </span>
      ))}
      {years && years.length > 0 && years.map((y) => (
        <span key={y} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-600 text-white">
          <Calendar className="w-3 h-3" /> {y}
        </span>
      ))}
    </div>
  );
}
