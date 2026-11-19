package world.packrat.wakeword

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log

/**
 * A long press on a headset's button. Android sends it to the hands-free voice handler the user
 * picked, never to a media app, so PackRat offers itself as one. While a trip is underway it starts
 * a PackRat command; otherwise the press goes on to the phone's own assistant, as if PackRat
 * weren't there.
 */
class HeadsetVoiceActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val handler = WakeWordService.onHeadset
    if (WakeWordService.headsetActive && handler != null) {
      WakeWordService.holdAwake(applicationContext)
      handler()
    } else {
      forwardToAssistant()
    }
    finish()
  }

  private fun forwardToAssistant() {
    val press = Intent(intent).setComponent(null).setPackage(null)
    val assistant = packageManager
      .queryIntentActivities(press, PackageManager.MATCH_DEFAULT_ONLY)
      .firstOrNull { it.activityInfo.packageName != packageName }
      ?: return
    try {
      startActivity(
        press
          .setClassName(assistant.activityInfo.packageName, assistant.activityInfo.name)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
    } catch (error: Exception) {
      Log.w("HeadsetVoiceActivity", "Couldn't pass the press on to the assistant", error)
    }
  }
}
