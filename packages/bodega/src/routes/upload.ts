// POST /api/bodega/upload — image upload from /studio ProductEditor.
//
// Accepts multipart/form-data with a 'file' field. Owner-gated. Uploads to
// Vercel Blob as a public asset under product-images/ with a random path
// so different merchants can't guess each other's URLs.
//
// Mount at app/api/bodega/upload/route.ts:
//   export { POST } from '@mitcheman/bodega/routes/upload';

import { NextResponse, type NextRequest } from 'next/server';
import { put } from '@vercel/blob';
import { requireOwner } from '../auth/require-session.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per image
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function randomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (auth instanceof NextResponse) return auth;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { message: 'Storage is not configured. Contact support.' },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { message: 'Expected multipart/form-data body.' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { message: 'No file attached. Field name must be "file".' },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        message: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      {
        message: `Unsupported image type (${file.type}). Use JPEG, PNG, WebP, GIF, or AVIF.`,
      },
      { status: 415 },
    );
  }

  // Random ID + sanitized original name → stable unique URL without
  // leaking merchant structure and without collision risk.
  const pathname = `product-images/${randomId()}-${sanitizeFilename(file.name)}`;

  try {
    const { url } = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType: file.type,
      token,
    });
    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.';
    return NextResponse.json({ message }, { status: 502 });
  }
}
