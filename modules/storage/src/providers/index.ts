import { IStorageProvider, StorageConfig } from '../interfaces/index.js';
import { GoogleCloudStorage } from './google/index.js';
import { LocalStorage } from './local/index.js';
import { AzureStorage } from './azure/index.js';
import { AWSS3Storage } from './aws/index.js';
import { AliyunStorage } from './aliyun/index.js';

/**
 * Factory function creating an appropriate storage provider instance.
 *
 * @param {keyof StorageConfig} provider The storage provider type.
 * @param {StorageConfig} options Configuration options passed to the provider.
 * @returns {IStorageProvider} Instantiated storage provider.
 */
export function createStorageProvider(
  provider: keyof StorageConfig,
  options: StorageConfig,
): IStorageProvider {
  switch (provider) {
    case 'google':
      return new GoogleCloudStorage(options);
    case 'azure':
      return new AzureStorage(options);
    case 'aws':
      return new AWSS3Storage(options);
    case 'aliyun':
      return new AliyunStorage(options);
    case 'local':
      return new LocalStorage(options);
    default:
      return new LocalStorage(options);
  }
}
