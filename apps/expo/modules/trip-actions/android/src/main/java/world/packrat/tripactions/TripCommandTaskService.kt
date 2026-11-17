package world.packrat.tripactions

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the `PackRatTripCommand` task registered in the app's entry file. */
class TripCommandTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val extras = intent?.extras ?: return null
    // Allowed in the foreground too: the assistant can be asked with PackRat open behind it.
    return HeadlessJsTaskConfig(TASK_NAME, Arguments.fromBundle(extras), TASK_TIMEOUT_MS, true)
  }

  companion object {
    const val TASK_NAME = "PackRatTripCommand"
    const val EXTRA_ID = "id"
    const val EXTRA_REQUEST = "request"
    const val EXTRA_CONFIRMED = "confirmed"
    private const val TASK_TIMEOUT_MS = 30_000L
  }
}
