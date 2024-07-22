import { getPhotonDetailsRoute } from './../controllers/getOsm/getPhotonDetails';

import { googleSigninRoute } from '../controllers/passport/signInGoogle';

import {
  userSignInRoute,
  getUsersRoute,
  getUserByIdRoute,
  signUpRoute,
  resetPasswordRoute,
  getGoogleAuthURLRoute,
  editUserRoute,
  deleteUserRoute,
  getMeRoute,
  sentEmailRoute,
} from '../controllers/user';
import {
  checkCodeRoute,
  emailExistsRoute,
  updatePasswordRoute,
} from '../controllers/auth';
import { getWeatherRoute } from '../controllers/weather';
import {
  addTripRoute,
  deleteTripRoute,
  editTripRoute,
  getPublicTripsRoute,
  getTripByIdRoute,
  getTripsRoute,
} from '../controllers/trip';
import {
  addTemplateRoute,
  deleteTemplateRoute,
  editTemplateRoute,
  getTemplateByIdRoute,
  getTemplatesRoute,
} from '../controllers/template';
import {
  handlePasswordResetRoute,
  requestPasswordResetEmailAndTokenRoute,
} from '../controllers/passwordReset';
import {
  addPackRoute,
  deletePackRoute,
  duplicatePublicPackRoute,
  editPackRoute,
  getPackByIdRoute,
  getPacksRoute,
  getPublicPacksRoute,
  getSimilarPacksRoute,
  scorePackRoute,
} from '../controllers/pack';

import {
  getAIResponseRoute,
  getUserChatsRoute,
  getAISuggestionsRoute,
} from '../controllers/openAi';
import {
  addGlobalItemToPackRoute,
  addItemGlobalRoute,
  addItemRoute,
  deleteGlobalItemRoute,
  deleteItemRoute,
  editGlobalItemAsDuplicateRoute,
  editItemRoute,
  getItemByIdRoute,
  getItemsGloballyRoute,
  getItemsRoute,
  searchItemsByNameRoute,
  getSimilarItemsRoute,
} from '../controllers/item';
import { getTrailsRoute } from '../controllers/getTrail';
import { getParksRoute } from '../controllers/getParks';
import { getGeoCodeRoute } from '../controllers/geoCode';
import {
  addToFavoriteRoute,
  getFavoritePacksByUserRoute,
  getUserFavoritesRoute,
} from '../controllers/favorite';
import {
  getDestinationRoute,
  getOsmRoute,
  getParksOSMRoute,
  getPhotonResultsRoute,
  getTrailsOSMRoute,
  postSingleGeoJSONRoute,
} from '../controllers/getOsm';

import { router as trpcRouter } from '../trpc';

export const appRouter = trpcRouter({
  getUserById: getUserByIdRoute(),
  signIn: userSignInRoute(),
  signUp: signUpRoute(),
  resetPassword: resetPasswordRoute(),
  getGoogleAuthURL: getGoogleAuthURLRoute(),
  googleSignin: googleSigninRoute(),
  editUser: editUserRoute(),
  deleteUser: deleteUserRoute(),
  getMe: getMeRoute(),
  emailExists: emailExistsRoute(),
  checkCode: checkCodeRoute(),
  getUsers: getUsersRoute(),
  resetPasswordEmail: sentEmailRoute(),
  updatePassword: updatePasswordRoute(),
  // weather routes
  getWeather: getWeatherRoute(),
  // trips routes
  getPublicTripsRoute: getPublicTripsRoute(),
  getTrips: getTripsRoute(),
  getTripById: getTripByIdRoute(),
  addTrip: addTripRoute(),
  editTrip: editTripRoute(),
  deleteTrip: deleteTripRoute(),
  // templates routes
  getTemplates: getTemplatesRoute(),
  getTemplateById: getTemplateByIdRoute(),
  addTemplate: addTemplateRoute(),
  editTemplate: editTemplateRoute(),
  deleteTemplate: deleteTemplateRoute(),
  // password reset routes
  requestPasswordResetEmailAndToken: requestPasswordResetEmailAndTokenRoute(),
  handlePasswordReset: handlePasswordResetRoute(),
  // packs routes
  getPublicPacks: getPublicPacksRoute(), // Done (Sorting by Items is left)
  getPacks: getPacksRoute(), // Done (Sorting by Items is left)
  getPackById: getPackByIdRoute(), // Done
  addPack: addPackRoute(), // Done
  editPack: editPackRoute(), // Done
  deletePack: deletePackRoute(), // Done
  scorePack: scorePackRoute(), // Done
  duplicatePublicPack: duplicatePublicPackRoute(), // Not Implemented
  getSimilarPacks: getSimilarPacksRoute(),
  // osm routes - currently breaking tests, see patch file
  getPhotonResults: getPhotonResultsRoute(),
  getTrailsOSM: getTrailsOSMRoute(),
  getParksOSM: getParksOSMRoute(),
  getOsm: getOsmRoute(),
  postSingleGeoJSON: postSingleGeoJSONRoute(),
  getDestination: getDestinationRoute(),
  getPhotonDetails: getPhotonDetailsRoute(),
  // open ai routes
  getAIResponse: getAIResponseRoute(),
  getAISuggestions: getAISuggestionsRoute(),
  getUserChats: getUserChatsRoute(),
  // item routes
  getItems: getItemsRoute(),
  getItemById: getItemByIdRoute(),
  searchItemsByName: searchItemsByNameRoute(),
  addItem: addItemRoute(), // Done
  editItem: editItemRoute(), // Done
  deleteItem: deleteItemRoute(), // Done
  addItemGlobal: addItemGlobalRoute(), // Done
  getItemsGlobally: getItemsGloballyRoute(), // Done
  addGlobalItemToPack: addGlobalItemToPackRoute(), // Done
  editGlobalItemAsDuplicate: editGlobalItemAsDuplicateRoute(), // Not Implemented
  deleteGlobalItem: deleteGlobalItemRoute(), // Done,
  getSimilarItems: getSimilarItemsRoute(),
  // trails routes
  getTrails: getTrailsRoute(),
  // // parks route
  getParks: getParksRoute(),
  // geo code routes
  getGeoCode: getGeoCodeRoute(),
  // // favorite routes
  addToFavorite: addToFavoriteRoute(),
  getUserFavorites: getUserFavoritesRoute(),
  getFavoritePacksByUser: getFavoritePacksByUserRoute(),
});

export type AppRouter = typeof appRouter;
