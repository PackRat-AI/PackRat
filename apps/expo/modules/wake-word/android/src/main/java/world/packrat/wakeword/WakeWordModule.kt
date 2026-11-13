package world.packrat.wakeword

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WakeWordModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WakeWord")

    Events("onWake")

    OnCreate {
      WakeWordService.onWake = { sendEvent("onWake", emptyMap<String, Any>()) }
    }

    OnDestroy {
      WakeWordService.onWake = null
    }

    /** Starts listening. Call while the app is on screen: Android refuses it from the background. */
    Function("arm") { title: String, text: String, channelName: String ->
      val intent = serviceIntent(WakeWordService.ACTION_START)
        .putExtra(WakeWordService.EXTRA_TITLE, title)
        .putExtra(WakeWordService.EXTRA_TEXT, text)
        .putExtra(WakeWordService.EXTRA_CHANNEL, channelName)
      ContextCompat.startForegroundService(context, intent)
    }

    Function("disarm") {
      if (WakeWordService.isArmed) context.startService(serviceIntent(WakeWordService.ACTION_STOP))
    }

    /** PackRat is about to listen or speak itself: let go of the microphone. */
    Function("pause") {
      if (WakeWordService.isArmed) context.startService(serviceIntent(WakeWordService.ACTION_PAUSE))
    }

    Function("resume") {
      if (WakeWordService.isArmed) context.startService(serviceIntent(WakeWordService.ACTION_RESUME))
    }

    Function("isArmed") { WakeWordService.isArmed }
  }

  private fun serviceIntent(action: String) = Intent(context, WakeWordService::class.java).setAction(action)
}
