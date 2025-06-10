/**
 * Async helper that resolves after a specified number of milliseconds.
 *
 * @param {number} ms Milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the timeout.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
