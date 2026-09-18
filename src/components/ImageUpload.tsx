import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ImagePlus, X, Loader2, AlertCircle } from 'lucide-react';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ImageUploadProps {
  /** Storage sub-folder, e.g. "notices", "events", "announcements" */
  folder: string;
  /** Existing image path from DB (when editing) */
  existingPath: string | null;
  /** Called when a new image is selected (with a pending File) or removed */
  onImageChange: (file: File | null, removedExisting: boolean) => void;
}

export default function ImageUpload({ folder, existingPath, onImageChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    existingPath ? supabase.storage.from('posters').getPublicUrl(existingPath).data.publicUrl : null
  );
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Please upload a valid image within the allowed size.');
      setPreviewUrl(existingPath ? supabase.storage.from('posters').getPublicUrl(existingPath).data.publicUrl : null);
      onImageChange(null, false);
      return;
    }

    if (file.size > MAX_SIZE) {
      setError('Please upload a valid image within the allowed size.');
      setPreviewUrl(existingPath ? supabase.storage.from('posters').getPublicUrl(existingPath).data.publicUrl : null);
      onImageChange(null, false);
      return;
    }

    setError('');
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    onImageChange(file, false);
  }

  function handleRemove() {
    setPreviewUrl(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
    onImageChange(null, true);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        Poster / Image (optional)
      </label>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
        Upload one image (JPG, PNG, or WEBP, max 5 MB).
      </p>

      {error && (
        <div className="mb-2 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!previewUrl && !uploading && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-teal-400 dark:hover:border-teal-500 transition-colors text-slate-400 dark:text-slate-500 hover:text-teal-500 dark:hover:text-teal-400"
        >
          <ImagePlus className="w-7 h-7 mb-1" />
          <span className="text-sm font-medium">Click to upload a poster</span>
        </button>
      )}

      {previewUrl && (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-w-sm">
          <img
            src={previewUrl}
            alt="Poster preview"
            className="w-full h-auto max-h-48 object-contain bg-slate-50 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-colors"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
