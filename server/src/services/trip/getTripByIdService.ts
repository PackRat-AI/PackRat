import { PrismaClient } from '@prisma/client/edge';
import { Trip } from '../../prisma/methods';

/**
 * Retrieves a trip by its ID and returns the trip details.
 * @param {PrismaClient} prisma - Prisma client.
 * @param {string} tripId - The ID of the trip.
 * @return {Promise<object>} A promise that resolves to the trip details.
 */
export const getTripByIdService = async (
  prisma: PrismaClient,
  tripId: string,
): Promise<object> => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { ownerDocument: true }, // Assuming 'owner_id' is a foreign key to the 'User' model
    });

    if (!trip) {
      throw new Error('Trip cannot be found');
    }

    return await Trip(trip).toJSON(prisma);
  } catch (error) {
    console.error(error);
    throw new Error('Trip cannot be found');
  }
};
