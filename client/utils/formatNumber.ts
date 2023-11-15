/**
 * Formats a number to a string with two decimal places and adds a thousands separator.
 *
 * @param {number} num - The number to be formatted.
 * @return {string} The formatted number as a string.
 */
export function formatNumber(num) {
  if (num != null) {
    return Number(num).toLocaleString();
  }
}
