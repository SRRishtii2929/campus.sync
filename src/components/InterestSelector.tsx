import { INTERESTS } from '@/lib/interests';
import { Sparkles } from 'lucide-react';

interface InterestSelectorProps {
  selected: string[];
  onChange: (interests: string[]) => void;
  label?: string;
  hint?: string;
  optional?: boolean;
}

export default function InterestSelector({ selected, onChange, label, hint, optional }: InterestSelectorProps) {
  const toggle = (interest: string) => {
    if (selected.includes(interest)) {
      onChange(selected.filter((i) => i !== interest));
    } else {
      onChange([...selected, interest]);
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-teal-500" />
          {label}
          {optional && <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">(optional)</span>}
        </label>
      )}
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((interest) => {
          const isSelected = selected.includes(interest);
          return (
            <button
              key={interest}
              type="button"
              onClick={() => toggle(interest)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isSelected
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400'
              }`}
            >
              {interest}
            </button>
          );
        })}
      </div>
    </div>
  );
}
