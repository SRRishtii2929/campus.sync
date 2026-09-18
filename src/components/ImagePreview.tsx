import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X } from 'lucide-react';

interface ImagePreviewProps {
  /** Storage path from the DB `image_path` column */
  path: string | null;
  /** Alt text for the image */
  alt: string;
  /** Optional CSS classes for the container */
  className?: string;
  /** Max height in rem for the card thumbnail */
  maxHeight?: string;
}

export default function ImagePreview({ path, alt, className = '', maxHeight = 'max-h-56' }: ImagePreviewProps) {
  const [lightbox, setLightbox] = useState(false);

  if (!path) return null;

  const { data } = supabase.storage.from('posters').getPublicUrl(path);
  const url = data.publicUrl;

  return (
    <>
      <div className={`relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 ${className}`}>
        <img
          src={url}
          alt={alt}
          onClick={() => setLightbox(true)}
          className={`w-full ${maxHeight} object-contain cursor-pointer hover:opacity-90 transition-opacity`}
          loading="lazy"
        />
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
