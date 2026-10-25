import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface IStorageService {
  upload(file: Buffer | Uint8Array, fileName: string, mimeType: string): Promise<string>;
}

export class LocalStorageService implements IStorageService {
  private uploadDir: string;

  constructor(uploadDir = './uploads') {
    this.uploadDir = uploadDir;
  }

  async upload(file: Buffer | Uint8Array, fileName: string, _mimeType: string): Promise<string> {
    if (!existsSync(this.uploadDir)) {
      await mkdir(this.uploadDir, { recursive: true });
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueFileName = `${Date.now()}-${safeName}`;
    const targetPath = join(this.uploadDir, uniqueFileName);

    await writeFile(targetPath, file);
    return `/uploads/${uniqueFileName}`;
  }
}

export class VercelBlobStorageService implements IStorageService {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async upload(file: Buffer | Uint8Array, fileName: string, mimeType: string): Promise<string> {
    const { put } = await import('@vercel/blob');
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
    const blob = await put(safeName, buffer, {
      access: 'public',
      contentType: mimeType,
      token: this.token,
    });
    return blob.url;
  }
}

export function getStorageService(): IStorageService {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken && blobToken.trim().length > 0) {
    return new VercelBlobStorageService(blobToken);
  }
  return new LocalStorageService();
}
