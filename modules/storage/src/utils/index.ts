import { GetUserCommand, IAMClient } from '@aws-sdk/client-iam';
import { IFileParams, IStorageProvider, StorageConfig } from '../interfaces/index.js';
import { isNil } from 'lodash-es';
import path from 'path';
import { File } from '../models/index.js';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { randomUUID } from 'node:crypto';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';

/**
 * Converts a readable stream into a single {@link Buffer}.
 *
 * @param {NodeJS.ReadableStream} readableStream The stream to buffer.
 * @returns {Promise<Buffer>} Promise resolving with the buffered data.
 */
export async function streamToBuffer(readableStream: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data: any) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      // shouldn't really provide an error
      // @ts-expect-error
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}

/**
 * Retrieves the AWS account id using the provided configuration.
 * When a custom endpoint is used, a random uuid is returned instead.
 *
 * @param {StorageConfig} config Storage configuration containing AWS credentials.
 * @returns {Promise<string>} The AWS account identifier.
 */
export async function getAwsAccountId(config: StorageConfig) {
  // when using non AWS S3 storage provider
  if (config.aws.endpoint) {
    return randomUUID();
  }
  const iamClient = new IAMClient({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  });
  const res = await iamClient.send(new GetUserCommand({}));
  const userId = res?.User?.UserId;
  if (isNil(userId)) {
    throw new Error('Unable to get AWS account ID');
  }
  return userId;
}

/**
 * Ensures folder paths have a leading and trailing slash and are normalized.
 *
 * @param {string} [folderPath] Path to normalize.
 * @returns {string} Normalized folder path.
 */
export function normalizeFolderPath(folderPath?: string) {
  if (!folderPath || folderPath.trim() === '' || folderPath.trim() === '/') return '/';
  return `${path.normalize(folderPath.trim()).replace(/^\/|\/$/g, '')}/`;
}

function getNestedPaths(inputPath: string): string[] {
  const paths: string[] = [];
  const strippedPath = !inputPath.trim()
    ? ''
    : path.normalize(inputPath.trim()).replace(/^\/|\/$/g, '');
  if (strippedPath !== '') {
    const pathSegments = strippedPath.split('/');
    let currentPath = '';
    for (const segment of pathSegments) {
      currentPath = path.join(currentPath, segment);
      paths.push(`${currentPath}/`);
    }
  }
  return paths;
}

/**
 * Iteratively calls the provided handler for each segment of an input path.
 *
 * @param {string} inputPath Path to iterate over.
 * @param {(inputPath: string, isLast: boolean) => Promise<void>} handler Function invoked for each path segment.
 */
export async function deepPathHandler(
  inputPath: string,
  handler: (inputPath: string, isLast: boolean) => Promise<void>,
): Promise<void> {
  const paths = getNestedPaths(inputPath);
  for (let i = 0; i < paths.length; i++) {
    await handler(paths[i], i === paths.length - 1);
  }
}

/**
 * Stores a new file using the given provider and persists it in the database.
 *
 * @param {IStorageProvider} storageProvider Provider to store the file with.
 * @param {IFileParams} params Parameters describing the file.
 * @returns {Promise<File>} The created file document.
 */
export async function storeNewFile(
  storageProvider: IStorageProvider,
  params: IFileParams,
): Promise<File> {
  const { name, alias, data, container, folder, mimeType, isPublic } = params;
  const buffer = Buffer.from(data as string, 'base64');
  const size = buffer.byteLength;
  const fileName = (folder === '/' ? '' : folder) + name;
  await storageProvider.container(container).store(fileName, buffer, isPublic);
  const publicUrl = isPublic
    ? await storageProvider.container(container).getPublicUrl(fileName)
    : null;
  ConduitGrpcSdk.Metrics?.increment('files_total');
  ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', size);
  return await File.getInstance().create({
    name,
    alias,
    mimeType,
    folder: folder,
    container: container,
    size,
    isPublic,
    url: publicUrl,
  });
}

/**
 * Creates a file entry and generates an upload URL for direct uploads.
 *
 * @param {IStorageProvider} storageProvider Provider to generate the URL from.
 * @param {IFileParams} params File parameters.
 * @returns {Promise<{ file: File; url: string }>} The created file and upload URL.
 */
export async function _createFileUploadUrl(
  storageProvider: IStorageProvider,
  params: IFileParams,
): Promise<{ file: File; url: string }> {
  const { name, alias, container, folder, mimeType, isPublic, size } = params;
  const fileName = (folder === '/' ? '' : folder) + name;
  await storageProvider
    .container(container)
    .store(fileName, Buffer.from('PENDING UPLOAD'), isPublic);
  const publicUrl = isPublic
    ? await storageProvider.container(container).getPublicUrl(fileName)
    : null;
  ConduitGrpcSdk.Metrics?.increment('files_total');
  ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', size);
  const file = await File.getInstance().create({
    name,
    alias,
    mimeType,
    size,
    folder: folder,
    container: container,
    isPublic,
    url: publicUrl,
  });
  const url = (await storageProvider
    .container(container)
    .getUploadUrl(fileName)) as string;
  return {
    file,
    url,
  };
}

/**
 * Updates a file both on the storage provider and in the database.
 *
 * @param {IStorageProvider} storageProvider Provider holding the file.
 * @param {File} file Existing file document.
 * @param {IFileParams} params Updated file parameters.
 * @returns {Promise<File>} The updated file document.
 */
export async function _updateFile(
  storageProvider: IStorageProvider,
  file: File,
  params: IFileParams,
): Promise<File> {
  const { name, alias, data, folder, container, mimeType } = params;
  const onlyDataUpdate =
    name === file.name && folder === file.folder && container === file.container;
  await storageProvider
    .container(container)
    .store((folder === '/' ? '' : folder) + name, data, file.isPublic);
  if (!onlyDataUpdate) {
    await storageProvider
      .container(file.container)
      .delete((file.folder === '/' ? '' : file.folder) + file.name);
  }
  const url = file.isPublic
    ? await storageProvider
        .container(container)
        .getPublicUrl((folder === '/' ? '' : folder) + name)
    : null;
  const updatedFile = (await File.getInstance().findByIdAndUpdate(file._id, {
    name,
    alias,
    folder,
    container,
    url,
    mimeType,
  })) as File;
  updateFileMetrics(file.size, (data as Buffer).byteLength);
  return updatedFile;
}

/**
 * Updates a file entry and generates a new upload URL when needed.
 *
 * @param {IStorageProvider} storageProvider Provider to generate the URL from.
 * @param {File} file Existing file document.
 * @param {IFileParams} params Updated parameters.
 * @returns {Promise<{ file: File; url: string }>} Updated file and upload URL.
 */
export async function _updateFileUploadUrl(
  storageProvider: IStorageProvider,
  file: File,
  params: IFileParams,
): Promise<{ file: File; url: string }> {
  const { name, alias, folder, container, mimeType, size } = params;
  let updatedFile;
  const onlyDataUpdate =
    name === file.name && folder === file.folder && container === file.container;
  if (onlyDataUpdate) {
    updatedFile = await File.getInstance().findByIdAndUpdate(file._id, {
      mimeType,
      alias,
      ...{ size: size ?? file.size },
    });
  } else {
    await storageProvider
      .container(container)
      .store(
        (folder === '/' ? '' : folder) + name,
        Buffer.from('PENDING UPLOAD'),
        file.isPublic,
      );
    await storageProvider
      .container(file.container)
      .delete((file.folder === '/' ? '' : file.folder) + file.name);
    const url = file.isPublic
      ? await storageProvider
          .container(container)
          .getPublicUrl((folder === '/' ? '' : folder) + name)
      : null;
    updatedFile = await File.getInstance().findByIdAndUpdate(file._id, {
      name,
      alias,
      folder,
      container,
      url,
      mimeType,
      ...{ size: size ?? file.size },
    });
  }
  if (!isNil(size)) updateFileMetrics(file.size, size!);
  const uploadUrl = (await storageProvider
    .container(container)
    .getUploadUrl((folder === '/' ? '' : folder) + name)) as string;
  return { file: updatedFile!, url: uploadUrl };
}

/**
 * Updates Prometheus metrics for storage size when a file changes.
 *
 * @param {number} currentSize The previous file size in bytes.
 * @param {number} newSize The new file size in bytes.
 */
export function updateFileMetrics(currentSize: number, newSize: number) {
  const fileSizeDiff = Math.abs(currentSize - newSize);
  fileSizeDiff < 0
    ? ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', fileSizeDiff)
    : ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSizeDiff);
}

/**
 * Validates and possibly modifies a file name to avoid conflicts.
 *
 * @param {string | undefined} name Desired file name.
 * @param {string} folder Folder where the file will reside.
 * @param {string} container Storage container/bucket.
 * @returns {Promise<string>} A valid and possibly suffixed file name.
 */
export async function validateName(
  name: string | undefined,
  folder: string,
  container: string,
) {
  if (!name) {
    return randomUUID();
  }
  const config = ConfigController.getInstance().config;
  const extension = path.extname(name);
  const escapedExtension = extension.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const baseName = path.basename(name, extension);
  const escapedBaseName = baseName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regexPattern = `^${escapedBaseName} \\(\\d+\\)${escapedExtension}$`;

  const count = await File.getInstance().countDocuments({
    $and: [
      { $or: [{ name }, { name: { $regex: regexPattern } }] },
      { folder: folder },
      { container: container },
    ],
  });
  if (count === 0) {
    return name;
  } else if (!config.suffixOnNameConflict) {
    throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
  } else {
    if (extension !== '') {
      return `${baseName} (${count})${extension}`;
    }
    return `${name} (${count})`;
  }
}
