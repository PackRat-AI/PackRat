import { publicProcedure } from '../../trpc';
import { TripNotFoundError } from '../../helpers/errors';
import { responseHandler } from '../../helpers/responseHandler';
import { getPublicTripsService } from '../../services/trip/getPublicTripService';
import * as validator from '../../middleware/validators';
import { z } from 'zod';
import { Trip } from '../../prisma/methods';
/**
 * Retrieves public trips based on the given query parameter.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @return {object} The public trips as a JSON response.
 */
// export const getPublicTrips = async (req, res, next) => {
//   try {
//     const { queryBy } = req.query;

//     const publicTrips = await getPublicTripsService(queryBy);

//     res.locals.data = publicTrips;
//     responseHandler(res);
//   } catch (error) {
//     next(TripNotFoundError);
//   }
// };

export function getPublicTripsRoute() {
  return publicProcedure
    .input(z.object({ queryBy: z.string() }))
    .query(async (opts) => {
      const { queryBy } = opts.input;
      const { prisma }: any = opts.ctx;
      const trips = await getPublicTripsService(prisma, queryBy);
      return await Promise.all(
        trips.map((trip) => Trip(trip as any)?.toJSON(prisma)),
      );
    });
}
