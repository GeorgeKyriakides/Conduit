import { generate } from 'otp-generator';

/**
 * Generates a six digit numeric token used for SMS verification.
 *
 * @returns {string} The generated token.
 */
export function generateToken(): string {
  return generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
}
