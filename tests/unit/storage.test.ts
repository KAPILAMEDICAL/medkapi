import { describe, it, expect } from 'vitest';
import { validateUploadedFile, UnsafeFileError } from '@/lib/providers/storage';

function bytes(...values: number[]): Buffer {
  return Buffer.from(values);
}

describe('validateUploadedFile', () => {
  it('accepts a JPEG by its real magic bytes', () => {
    const buf = Buffer.concat([bytes(0xff, 0xd8, 0xff), Buffer.alloc(100)]);
    expect(validateUploadedFile(buf)).toEqual({ ext: 'jpg', mime: 'image/jpeg' });
  });

  it('accepts a PNG by its real magic bytes', () => {
    const buf = Buffer.concat([bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), Buffer.alloc(100)]);
    expect(validateUploadedFile(buf)).toEqual({ ext: 'png', mime: 'image/png' });
  });

  it('accepts a PDF by its real magic bytes', () => {
    const buf = Buffer.concat([Buffer.from('%PDF-1.4'), Buffer.alloc(100)]);
    expect(validateUploadedFile(buf)).toEqual({ ext: 'pdf', mime: 'application/pdf' });
  });

  it('rejects a file whose content does not match any allowed signature, regardless of extension claims', () => {
    // Simulates an attacker renaming a script to "photo.jpg" — the
    // uploaded bytes are what get checked, never the filename.
    const fakeImage = Buffer.from('#!/bin/sh\necho pwned\n');
    expect(() => validateUploadedFile(fakeImage)).toThrow(UnsafeFileError);
  });

  it('rejects an empty file', () => {
    expect(() => validateUploadedFile(Buffer.alloc(0))).toThrow(UnsafeFileError);
  });

  it('rejects a file over the size limit', () => {
    const oversized = Buffer.concat([bytes(0xff, 0xd8, 0xff), Buffer.alloc(9 * 1024 * 1024)]);
    expect(() => validateUploadedFile(oversized)).toThrow(UnsafeFileError);
  });
});
