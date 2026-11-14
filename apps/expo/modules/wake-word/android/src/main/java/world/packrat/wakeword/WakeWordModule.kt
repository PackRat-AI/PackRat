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

    Events("onWake", "onHeadset")

    OnCreate {
      WakeWordService.onWake = { sendEvent("onWake", emptyMap<String, Any>()) }
      WakeWordService.onHeadset = { sendEvent("onHeadset", emptyMap<String, Any>()) }
    }

    OnDestroy {
      WakeWordService.onWake = null
      WakeWordService.onHeadset = null
      WakeWordService.headsetActive = false
    }

    /**
     * Starts the service, listening for "Hey PackRat" when [listen] is set. Call while the app is
     * on screen: Android refuses a microphone service started from the background.
     */
    Function("arm") { title: String, text: String, channelName: String, listen: Boolean ->
      val intent = serviceIntent(WakeWordService.ACTION_START)
        .putExtra(WakeWordService.EXTRA_TITLE, title)
        .putExtra(WakeWordService.EXTRA_TEXT, text)
        .putExtra(WakeWordService.EXTRA_CHANNEL, channelName)
        .putExtra(WakeWordService.EXTRA_LISTEN, listen)
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
      WakeWordService.releaseAwake()
      if (WakeWordService.isArmed) context.startService(serviceIntent(WakeWordService.ACTION_RESUME))
    }

    Function("isArmed") { WakeWordService.isArmed }

    /** Whether a long press on the headset's button starts a PackRat command. */
    Function("setHeadsetActive") { active: Boolean ->
      WakeWordService.headsetActive = active
    }
  }

  private fun serviceIntent(action: String) = Intent(context, WakeWordService::class.java).setAction(action)
}
