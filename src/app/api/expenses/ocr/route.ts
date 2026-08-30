import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/rbac';
import { getStorageProvider, validateUploadedFile } from '@/lib/providers/storage';
import { getOcrProvider } from '@/lib/providers/ocr';
import { ok, fail } from '@/lib/api-response';

/**
 * Uploads a bill/expense photo and runs OCR on it. Returns the stored
 * image URL plus best-effort extracted fields — the caller (sales app
 * "Upload Bill" screen) MUST show these in an editable form and let the
 * salesman correct them before calling POST /api/expenses; nothing here
 * is saved as an expense automatically.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) throw new UnauthorizedError('Please log in.');
    if (session.role !== 'SALES_BOY' && session.role !== 'SALES_MANAGER') {
      throw new ForbiddenError('Only sales staff can submit expense bills.');
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) throw new ForbiddenError('No file was provided.');

    const buffer = Buffer.from(await file.arrayBuffer());
    const { mime } = validateUploadedFile(buffer);

    const stored = await getStorageProvider().save({ buffer, originalName: file.name, mimeType: file.type }, 'bills');

    let ocr = null;
    if (mime === 'image/jpeg' || mime === 'image/png') {
      // OCR only runs on images — a PDF bill is still stored and can be
      // filled in manually (see docs/ARCHITECTURE.md "OCR scope").
      ocr = await getOcrProvider().extract(buffer);
    }

    return ok({ billImageUrl: stored.url, ocr }, 201);
  } catch (err) {
    return fail(err);
  }
}
