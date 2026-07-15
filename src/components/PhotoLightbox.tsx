import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Pencil, Loader2 } from 'lucide-react';

type Props = {
  urls: string[];
  index: number;
  captions?: (string | null | undefined)[];
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  // Step 18+: optional caption editing. Provide both to enable.
  canEdit?: (index: number) => boolean;
  onCaptionSave?: (index: number, caption: string | null) => Promise<void>;
};

export default function PhotoLightbox({
  urls,
  index,
  captions,
  onClose,
  onNavigate,
  canEdit,
  onCaptionSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset edit state when navigating between photos.
  useEffect(() => {
    setEditing(false);
    setSaving(false);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return; // Don't intercept keys while editing.
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onNavigate(Math.max(0, index - 1));
      else if (e.key === 'ArrowRight') onNavigate(Math.min(urls.length - 1, index + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, urls.length, onClose, onNavigate, editing]);

  if (urls.length === 0 || index < 0 || index >= urls.length) return null;

  const url = urls[index];
  const caption = captions?.[index];
  const editable = canEdit?.(index) && !!onCaptionSave;

  const beginEdit = () => {
    if (!editable) return;
    setDraft(caption ?? '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  const saveEdit = async () => {
    if (!onCaptionSave) return;
    setSaving(true);
    try {
      const trimmed = draft.trim();
      await onCaptionSave(index, trimmed.length === 0 ? null : trimmed);
      setEditing(false);
    } catch (e) {
      console.warn('[lightbox] save caption failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1400] bg-black/95 backdrop-blur flex flex-col"
      onClick={() => {
        if (editing) return; // Block backdrop-close while editing.
        onClose();
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white/70 text-xs font-mono tracking-widest">
        <span>
          {index + 1} / {urls.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (editing) cancelEdit();
            else onClose();
          }}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Photo */}
      <div className="flex-1 flex items-center justify-center px-4 relative min-h-0">
        {index > 0 && !editing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(index - 1);
            }}
            aria-label="Previous"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        <img
          src={url}
          alt={caption ?? ''}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain rounded-lg select-none"
        />
        {index < urls.length - 1 && !editing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(index + 1);
            }}
            aria-label="Next"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Caption */}
      <div className="px-4 md:px-6 py-4 max-w-2xl w-full mx-auto" onClick={(e) => e.stopPropagation()}>
        {editing ? (
          <div className="bg-zinc-900 border border-white/10 rounded-xl p-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // The global lightbox key handler ignores keys while editing,
                // so cancel on Esc here (users expect Esc to back out of the
                // caption edit, not do nothing).
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  cancelEdit();
                }
              }}
              autoFocus
              rows={2}
              maxLength={280}
              placeholder="Add a caption…"
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-haunt-red resize-none"
            />
            <div className="flex items-center justify-between mt-2 gap-2">
              <span className="text-[10px] font-mono text-white/40">
                {draft.length}/280
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-mono tracking-widest text-white/70 disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-haunt-red hover:bg-red-600 text-xs font-mono tracking-widest text-white inline-flex items-center gap-x-1.5 disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  SAVE
                </button>
              </div>
            </div>
          </div>
        ) : caption ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              beginEdit();
            }}
            disabled={!editable}
            className={`w-full text-center text-sm text-white/80 px-3 py-2 rounded-lg ${
              editable ? 'hover:bg-white/5 cursor-pointer inline-flex items-center justify-center gap-2' : ''
            }`}
          >
            <span>{caption}</span>
            {editable && <Pencil className="w-3 h-3 text-white/40 shrink-0" />}
          </button>
        ) : editable ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              beginEdit();
            }}
            className="w-full text-center text-xs font-mono text-white/40 tracking-widest hover:text-white/70 transition-colors inline-flex items-center justify-center gap-1.5 py-2"
          >
            <Pencil className="w-3 h-3" /> ADD CAPTION
          </button>
        ) : null}
      </div>
    </div>
  );
}
