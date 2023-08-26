type WeightUnit = 'g' | 'kg' | 'oz' | 'lb' | 'lbs';

/**
 * Converts weight from one unit to another.
 *
 * @param {number} weight - The weight to be converted.
 * @param {WeightUnit} fromUnit - The unit to convert from.
 * @param {WeightUnit} toUnit - The unit to convert to.
 * @return {number} The converted weight.
 */
export const convertWeight = (
  weight: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit,
): number => {
  if (typeof weight !== 'number' || !fromUnit || !toUnit) {
    return 0; // return 0 if weight is not a number or any of the units are missing
  }

  const units: Record<WeightUnit, number> = {
    g: 1,
    kg: 1000,
    oz: 28.3495,
    lb: 453.592,
    lbs: 453.592,
  };

  const weightInGrams = weight * units[fromUnit];
  const convertedWeight = weightInGrams / units[toUnit];

  return convertedWeight;
};

/**
 * Computes the total weight of a pack in grams.
 * @return {object} The total weight of a pack in grams.
 *
 */
export function computeTotalWeightInGrams() {
  return {
    $addFields: {
      item_weight: {
        $multiply: [
          {
            $cond: [
              { $eq: ['$items.unit', 'kg'] },
              { $multiply: ['$items.weight', 1000] },
              {
                $cond: [
                  { $eq: ['$items.unit', 'oz'] },
                  { $multiply: ['$items.weight', 28.3495] },
                  {
                    $cond: [
                      { $in: ['$items.unit', ['lb', 'lbs']] },
                      { $multiply: ['$items.weight', 453.592] },
                      // Default to 'g' if none of the conditions match
                      '$items.weight',
                    ],
                  },
                ],
              },
            ],
          },
          '$items.quantity',
        ],
      },
    },
  };
}
