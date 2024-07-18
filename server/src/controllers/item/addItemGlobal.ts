import { addItemGlobalService } from '../../services/item/item.service';
import { protectedProcedure } from '../../trpc';
import * as validator from '@packrat/validations';

export const addItemGlobal = async (c) => {
  try {
    const { name, weight, quantity, unit, type, ownerId } =
      await c.req.parseBody();

    const item = await addItemGlobalService(
      name,
      weight,
      quantity,
      unit,
      type,
      ownerId,
    );
    return c.json({ item }, 200);
  } catch (error) {
    return c.json({ error: `Failed to add item: ${error.message}` }, 500);
  }
};

export function addItemGlobalRoute() {
  return protectedProcedure
    .input(validator.addItemGlobal)
    .mutation(async (opts) => {
      const { name, weight, quantity, unit, type, ownerId } = opts.input;

      if (type !== 'Food' && type !== 'Water' && type !== 'Essentials') {
        throw new Error('Invalid item type');
      }

      const item = await addItemGlobalService(
        name,
        weight,
        quantity,
        unit,
        type,
        ownerId,
      );
      return item;
    });
}
