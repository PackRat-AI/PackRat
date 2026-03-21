export function convertToGrams(weight: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 'kg':
      return weight * 1000;
    case 'g':
      return weight;
    case 'oz':
      return weight * 28.3495;
    case 'lb':
      return weight * 453.592;
    default:
      return weight;
  }
}
