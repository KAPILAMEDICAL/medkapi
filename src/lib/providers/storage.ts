import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * File storage provider abstraction, used for bill photos, cheque photos,
 * payment receipts, product images, and offer posters.
 *
 * PRODUCTION INTEGRATION POINT
 * -----------------------------------------------------------------------
 * `LocalDiskStorageProvider` writes into /public/uploads and is meant for
 * local development only (files live on the container's ephemeral disk
 * and vanish on redeploy). Before production, implement an
 * `S3StorageProvider` against any S3-compatible bucket (AWS S3,
 * Cloudflare R2, DigitalOcean Spaces...) using the S3_* env vars in
 * .env.example, and switch STORAGE_PROVIDER=s3. No calling code changes.
 */

export type UploadCategory =
  | 'bills'
  | 'cheques'
  | 'receipts'
  | 'products'
  | 'offers'
  | 'company-logos';

export interface StoredFile {
  url: string;
  key: string;
  sizeBytes: number;
}

export interface StorageProvider {
  save(input: { buffer: Buffer; originalName: string; mimeType: string }, category: UploadCategory): Promise<StoredFile>;
}

// --- Server-side file safety validation ------------------------------------
// Never trust the client-supplied filename or MIME type alone — sniff the
// real file signature (magic bytes) so a renamed executable can't slip
// through as "photo.jpg".

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

const ALLOWED_SIGNATURES: { mime: string; ext: string; check: (buf: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', check: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/png',
    ext: 'png',
    check: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: 'application/pdf',
    ext: 'pdf',
    check: (b) => b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
];

export class UnsafeFileError extends Error {}

/** Validates size + real file signature. Returns the detected safe extension. */
export function validateUploadedFile(buffer: Buffer): { ext: string; mime: string } {
  if (buffer.length === 0) {
    throw new UnsafeFileError('The uploaded file is empty.');
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new UnsafeFileError(
      `File is too large (${(buffer.length / (1024 * 1024)).toFixed(1)} MB). Maximum allowed is ` +
        `${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
    );
  }
  const match = ALLOWED_SIGNATURES.find((sig) => sig.check(buffer));
  if (!match) {
    throw new UnsafeFileError('Unsupported file type. Please upload a JPG, PNG, or PDF file.');
  }
  return { ext: match.ext, mime: match.mime };
}

class LocalDiskStorageProvider implements StorageProvider {
  private baseDir = path.join(process.cwd(), 'public', 'uploads');

  async save(
    input: { buffer: Buffer; originalName: string; mimeType: string },
    category: UploadCategory,
  ): Promise<StoredFile> {
    const { ext } = validateUploadedFile(input.buffer);
    const dir = path.join(this.baseDir, category);
    await mkdir(dir, { recursive: true });
    // Server-generated filename — the client's original filename is never
    // trusted or reused, closing off path traversal / overwrite attacks.
    const key = `${category}/${randomUUID()}.${ext}`;
    await writeFile(path.join(this.baseDir, category, `${key.split('/')[1]}`), input.buffer);
    return { url: `/uploads/${key}`, key, sizeBytes: input.buffer.length };
  }
}

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  const kind = process.env.STORAGE_PROVIDER ?? 'local';
  switch (kind) {
    case 'local':
      cached = new LocalDiskStorageProvider();
      break;
    default:
      throw new Error(
        `STORAGE_PROVIDER="${kind}" has no implementation yet. Implement an ` +
          `S3-compatible provider in src/lib/providers/storage.ts before use.`,
      );
  }
  return cached;
}
