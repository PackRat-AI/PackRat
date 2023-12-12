import { PrismaClient } from '@prisma/client/edge';
import { calculatePackScore } from '../../utils/scorePack';

/**
 * Scores a pack service based on the given packId.
 * @param {PrismaClient} prisma - Prisma client.
 * @param {string} packId - The ID of the pack to be scored.
 * @return {Promise<Pack>} The updated pack object with scores and grades.
 * @throws {Error} If unable to score the pack.
 */
export async function scorePackService(prisma: PrismaClient, packId: string) {
  try {
    const packData = await prisma.pack.findUnique({
      where: { id: packId },
      include: { itemDocuments: true }, // Assuming you have a relationship defined in your Prisma schema
    });

    if (!packData) {
      throw new Error('Pack not found');
    }

    const packScore = calculatePackScore(packData);

    const updatedPack = await prisma.pack.update({
      where: { id: packId },
      data: {
        scores: packScore.scores,
        grades: packScore.grades,
      },
    });

    return updatedPack;
  } catch (error) {
    throw new Error('Unable to score pack: ' + error.message);
  }
}
