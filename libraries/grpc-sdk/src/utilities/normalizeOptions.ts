import { AuthzOptions, PopulateAuthzOptions } from '../types';
import { isNil } from 'lodash';

/**
 * Normalizes the arguments used for authorization options.
 *
 * @param {string | AuthzOptions} [userIdOrOptions] Either a user id or an options object.
 * @param {string} [scope] Authorization scope when the first argument is a string.
 * @returns {AuthzOptions} A normalized options object.
 */
export function normalizeAuthzOptions(
  userIdOrOptions?: string | AuthzOptions,
  scope?: string,
): AuthzOptions {
  if (typeof userIdOrOptions === 'string' || isNil(userIdOrOptions)) {
    return { userId: userIdOrOptions, scope };
  }
  return userIdOrOptions;
}

/**
 * Normalizes populate arguments for authorization options.
 *
 * @param {string | string[] | PopulateAuthzOptions} [populateOrOptions] Populate value or options object.
 * @param {string} [userId] The user id when providing populate as string or array.
 * @param {string} [scope] Authorization scope.
 */
export function normalizePopulateAuthzOptions(
  populateOrOptions?: string | string[] | PopulateAuthzOptions,
  userId?: string,
  scope?: string,
) {
  if (
    typeof populateOrOptions === 'string' ||
    Array.isArray(populateOrOptions) ||
    isNil(populateOrOptions)
  ) {
    return { populate: populateOrOptions, userId, scope };
  }
  return populateOrOptions;
}
