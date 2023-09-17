import axios from 'axios';
import {
  InvalidRequestParamsError,
  RetrievingPhotonDetailsError,
} from '../../helpers/errors';
import { responseHandler } from '../../helpers/responseHandler';
import { publicProcedure } from '../../trpc';
import * as validators from "@packrat/packages"

/**
 * Retrieves Photon results based on a search string.
 * @param {object} req - The request object.
 * @param {object} res - The response object.
 * @return {undefined} There is no explicit return value.
 */
export const getPhotonResults = async (req, res, next) => {
  const { searchString } = req.query;

  if (!searchString) {
    next(InvalidRequestParamsError);
  }

  const params = {
    q: searchString,
    osm_tag: ['highway:footway', 'highway:cycleway', 'place'],
    // osm_tag: "highway:footway",
    // osm_tag: "highway:cycleway",
    // osm_tag: "place",
  };

  const queryString = Object.entries(params)
    .flatMap(([key, values]) =>
      Array.isArray(values)
        ? values.map((val) => `${key}=${val}`)
        : `${key}=${values}`,
    )
    .join('&');

  console.log('queryString----', queryString);

  try {
    const response = await axios.get(
      `https://photon.komoot.io/api/?${queryString}`,
    );

    // console.log("response", response);

    const resultsArray = response.data.features;

    res.locals.data = resultsArray;
    responseHandler(res);
  } catch (error) {
    next(RetrievingPhotonDetailsError);
  }
};

export function getPhotonResultsRoute() {
  return publicProcedure.input(validators.getPhotonResults).query(async (opts) => {
    const { searchString } = opts.input;
    const params = {
      q: searchString,
      osm_tag: ['highway:footway', 'highway:cycleway', 'place'],
      // osm_tag: "highway:footway",
      // osm_tag: "highway:cycleway",
      // osm_tag: "place",
    }

    const queryString = Object.entries(params)
      .flatMap(([key, values]) =>
        Array.isArray(values)
          ? values.map((val) => `${key}=${val}`)
          : `${key}=${values}`,
      ).join('&');

    console.log('queryString----', queryString);

    const response = await axios.get(
      `https://photon.komoot.io/api/?${queryString}`,
    )

    return response.data.features
  })
}