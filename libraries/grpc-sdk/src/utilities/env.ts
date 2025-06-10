import fs from 'fs-extra';

/**
 * Reads environment variables or files and parses them as JSON.
 *
 * @template JsonFormat
 * @param {string} envName Name of the environment variable.
 * @param {string} [envValue] Direct value or file path containing JSON.
 * @param {(value: string) => object} [handleString] Optional handler for plain strings.
 * @returns {JsonFormat | undefined} The parsed JSON object or undefined when not provided.
 */
export function getJsonEnv<JsonFormat extends object>(
  envName: string,
  envValue?: string,
  handleString?: (value: string) => object,
): JsonFormat | undefined {
  envValue ??= process.env[envName];
  if (!envValue) return undefined;
  let jsonConfig: object;
  if (envValue.startsWith('{')) {
    try {
      jsonConfig = JSON.parse(envValue);
    } catch (e) {
      throw new Error(`Invalid JSON in ${envName}`);
    }
  } else {
    try {
      jsonConfig = JSON.parse(fs.readFileSync(envValue).toString().trimEnd());
    } catch (e) {
      if (handleString) {
        jsonConfig = handleString(envValue);
      } else {
        throw new Error(`Invalid JSON in ${envName}`);
      }
    }
  }
  return jsonConfig as JsonFormat;
}
