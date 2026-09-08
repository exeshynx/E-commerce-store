import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { AppError } from '../../http/errors/app-error.js';

export const uploadsRoot = fileURLToPath(new URL('../../../uploads', import.meta.url));
const productsDirectory = path.join(uploadsRoot, 'products');
mkdirSync(productsDirectory, { recursive: true });

const extensionsByMimeType: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const productIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const storage = multer.diskStorage({
  destination: (request, _file, callback) => {
    const productId = request.params.id;
    if (typeof productId !== 'string') {
      callback(new AppError(422, 'INVALID_PRODUCT_ID', 'A valid product is required.'), '');
      return;
    }
    if (!productIdPattern.test(productId)) {
      callback(new AppError(422, 'INVALID_PRODUCT_ID', 'A valid product is required.'), '');
      return;
    }
    const productDirectory = path.join(productsDirectory, productId);
    mkdirSync(productDirectory, { recursive: true });
    callback(null, productDirectory);
  },
  filename: (_request, file, callback) => {
    const extension = extensionsByMimeType[file.mimetype];
    if (!extension) {
      callback(new AppError(422, 'UNSUPPORTED_IMAGE_TYPE', 'Use a JPEG, PNG, or WebP image.'), '');
      return;
    }
    callback(null, `${randomUUID()}${extension}`);
  },
});

export const productImageUpload = multer({
  fileFilter: (_request, file, callback) => {
    if (!extensionsByMimeType[file.mimetype]) {
      callback(new AppError(422, 'UNSUPPORTED_IMAGE_TYPE', 'Use a JPEG, PNG, or WebP image.'));
      return;
    }
    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  storage,
}).single('image');

export const productImageStorage = {
  publicPath: (productId: string, filename: string) => `/uploads/products/${productId}/${filename}`,
  validate: async (publicPath: string) => {
    const relativePath = publicPath.replace('/uploads/products/', '');
    const [productId, filename, extra] = relativePath.split('/');
    if (
      extra ||
      !productIdPattern.test(productId ?? '') ||
      !filename ||
      filename !== path.basename(filename)
    ) {
      throw new Error('Refusing to read a file outside the product upload directory');
    }

    const handle = await open(path.join(productsDirectory, productId!, filename), 'r');
    try {
      const header = Buffer.alloc(12);
      await handle.read(header, 0, header.length, 0);
      const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      const isPng = header.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
      const isWebp =
        header.subarray(0, 4).toString('ascii') === 'RIFF' &&
        header.subarray(8, 12).toString('ascii') === 'WEBP';

      if (!isJpeg && !isPng && !isWebp) {
        throw new AppError(
          422,
          'INVALID_IMAGE_CONTENT',
          'The uploaded file is not a valid JPEG, PNG, or WebP image.',
        );
      }
    } finally {
      await handle.close();
    }
  },
  remove: async (publicPath: string) => {
    const relativePath = publicPath.replace('/uploads/products/', '');
    const [productId, filename, extra] = relativePath.split('/');
    if (
      extra ||
      !productIdPattern.test(productId ?? '') ||
      !filename ||
      filename !== path.basename(filename)
    ) {
      throw new Error('Refusing to remove a file outside the product upload directory');
    }
    try {
      await unlink(path.join(productsDirectory, productId!, filename));
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
  },
};
