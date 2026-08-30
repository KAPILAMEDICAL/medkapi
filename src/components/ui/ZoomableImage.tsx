'use client';

import { useState } from 'react';
import Image from 'next/image';
import { X, ZoomIn } from 'lucide-react';

/** Click-to-zoom bill/receipt viewer (§11 "View after submission" / "Zoom"). */
export function ZoomableImage({ src, alt, width = 600, height = 400 }: { src: string; alt: string; width?: number; height?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="group relative block w-full">
        <Image src={src} alt={alt} width={width} height={height} className="w-full rounded-sm object-contain" />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 p-1.5 opacity-80 group-hover:opacity-100">
          <ZoomIn size={14} className="text-white" />
        </span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setOpen(false)}>
          <button className="absolute right-4 top-4 text-white" onClick={() => setOpen(false)}>
            <X size={28} />
          </button>
          <Image src={src} alt={alt} width={1000} height={1200} className="max-h-full max-w-full rounded-md object-contain" />
        </div>
      )}
    </>
  );
}
