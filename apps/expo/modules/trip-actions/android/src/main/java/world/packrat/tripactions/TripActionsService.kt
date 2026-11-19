package world.packrat.tripactions

import androidx.annotation.RequiresApi
import androidx.appfunctions.AppFunctionDeclaration
import androidx.appfunctions.AppFunctionInvalidArgumentException
import androidx.appfunctions.AppFunctionSerializable
import androidx.appfunctions.AppFunctionService
import androidx.appfunctions.AppFunctionServiceEntryPoint

/**
 * Trip commands for Gemini and other assistants: "Hey Google, ask PackRat where am I". Each one
 * runs through the same controller as "Hey PackRat", so the answers match. Off until the voice
 * commands flag turns it on.
 */
@RequiresApi(36)
@AppFunctionServiceEntryPoint(
  serviceName = "TripActionsAppFunctionService",
  appFunctionXmlFileName = "trip_actions_app_functions",
)
abstract class TripActionsService : AppFunctionService() {
  /**
   * Runs one command on the hiking trip the user is on right now, and returns what to say back.
   * Commands include where am I, how far to go, am I on route, how far have I gone, when am I due
   * back, weather, mark waypoint (optionally with a name), note followed by text, start, pause,
   * resume or stop tracking, navigate to a waypoint or the end of the route, stop navigating, check
   * in, add an hour, and I'm safe.
   *
   * @param request The command in the user's own words, such as "how far have I gone" or "mark
   *   waypoint lake camp".
   * @param confirmed True only when an earlier call with the same request returned
   *   needsConfirmation and the user then clearly said yes. Otherwise false.
   * @return The sentence to say to the user, and whether it is a question waiting on their yes.
   */
  @AppFunctionDeclaration(isEnabled = false, isDescribedByKDoc = true)
  suspend fun runTripCommand(request: String, confirmed: Boolean = false): TripCommandResult {
    if (request.isBlank()) {
      throw AppFunctionInvalidArgumentException("The request needs a trip command, such as where am I.")
    }
    return TripCommandBridge.run(applicationContext, request.trim(), confirmed)
  }
}

/** What PackRat says back to a trip command. */
@AppFunctionSerializable(isDescribedByKDoc = true)
data class TripCommandResult(
  /** The sentence to say to the user, as written. */
  val answer: String,
  /**
   * True when the answer is a yes-or-no question about telling the user's emergency contacts
   * something. Ask the user, then run the same request again with confirmed set to true only if
   * they say yes.
   */
  val needsConfirmation: Boolean,
)
