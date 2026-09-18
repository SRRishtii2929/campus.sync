interface InterestTagsProps {
  interests?: string[] | null;
  variant?: 'compact' | 'full';
}

export default function InterestTags({ interests, variant = 'full' }: InterestTagsProps) {
  if (!interests || interests.length === 0) return null;

  if (variant === 'compact') {
    return (
      <div className="mt-1 flex items-center gap-1 flex-wrap">
        {interests.slice(0, 3).map((interest) => (
          <span key={interest} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
            {interest}
          </span>
        ))}
        {interests.length > 3 && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">+{interests.length - 3} more</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Interests:</span>
      {interests.map((interest) => (
        <span key={interest} className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
          {interest}
        </span>
      ))}
    </div>
  );
}
