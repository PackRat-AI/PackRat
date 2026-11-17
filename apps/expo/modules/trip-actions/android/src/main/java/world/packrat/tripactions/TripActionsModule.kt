package world.packrat.tripactions

import android.os.Build
import androidx.appfunctions.AppFunctionManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TripActionsModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("TripActions")

    /** The answer to a command the assistant is waiting on. */
    Function("respond") { id: String, answer: String, needsConfirmation: Boolean ->
      TripCommandBridge.complete(id, answer, needsConfirmation)
    }

    /**
     * Shows or hides the trip commands to Gemini and other assistants. False where the phone has no
     * AppFunctions (before Android 16) or hasn't indexed PackRat's yet.
     */
    AsyncFunction("setEnabled") Coroutine { enabled: Boolean ->
      if (Build.VERSION.SDK_INT < 36) return@Coroutine false
      val manager = AppFunctionManager.getInstance(context) ?: return@Coroutine false
      try {
        manager.setAppFunctionEnabled(
          TripActionsServiceIds.RUN_TRIP_COMMAND_ID,
          if (enabled) AppFunctionManager.APP_FUNCTION_STATE_ENABLED else AppFunctionManager.APP_FUNCTION_STATE_DISABLED,
        )
        true
      } catch (error: Exception) {
        false
      }
    }
  }
}
