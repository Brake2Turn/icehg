import { useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Avatar } from '../../components/Avatar';
import { cropToDataUrl, readFile, type Area } from './photo';

/** One button: the phone offers Take Photo or Photo Library; then a circular crop. */
export function PhotoPicker({ name, photo, onChange }: { name: string; photo?: string; onChange: (p: string | undefined) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [error, setError] = useState('');

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || '?'} photo={photo} size={72} />
      <div className="flex flex-col gap-2">
        <button type="button" className="btn btn-ghost !py-2 text-sm" onClick={() => input.current?.click()}>
          {photo ? 'Change photo' : 'Add photo'}
        </button>
        {photo && (
          <button type="button" className="text-xs text-mute underline text-left" onClick={() => onChange(undefined)}>
            Remove photo
          </button>
        )}
        {error && <div className="text-xs text-chip-red">{error}</div>}
      </div>
      <input
        ref={input}
        id="photo-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            setError('');
            setSrc(await readFile(f));
            setZoom(1);
            setCrop({ x: 0, y: 0 });
          } catch {
            setError("That photo couldn't be opened. Try another one.");
          }
        }}
      />
      {src && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col">
          <div className="relative flex-1">
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, px) => setArea(px)}
            />
          </div>
          <div className="safe-bottom px-4 pt-3 flex flex-col gap-3 bg-ink-2">
            <label className="flex items-center gap-3 text-sm text-mute" htmlFor="photo-zoom">
              Zoom
              <input id="photo-zoom" type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--color-gold)]" />
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setSrc(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-gold flex-1"
                disabled={!area}
                onClick={async () => {
                  if (!area) return;
                  onChange(await cropToDataUrl(src, area));
                  setSrc(null);
                }}
              >
                Use photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
