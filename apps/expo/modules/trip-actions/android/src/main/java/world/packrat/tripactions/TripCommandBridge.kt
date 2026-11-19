package world.packrat.tripactions

import android.content.Context
import android.content.Intent
import androidx.appfunctions.AppFunctionAppUnknownException
import com.facebook.react.HeadlessJsTaskService
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Hands a command to JavaScript and waits for the answer. JavaScript may not be running, so the
 * command goes through a headless task, which starts it without a screen when it isn't.
 */
internal object TripCommandBridge {
  /** Long enough for a GPS fix on the trail, short enough that the assistant doesn't give up first. */
  private const val TIMEOUT_MS = 25_000L

  private val pending = ConcurrentHashMap<String, CompletableDeferred<TripCommandResult>>()

  suspend fun run(context: Context, request: String, confirmed: Boolean): TripCommandResult {
    val id = UUID.randomUUID().toString()
    val result = CompletableDeferred<TripCommandResult>()
    pending[id] = result
    try {
      val intent = Intent(context, TripCommandTaskService::class.java)
        .putExtra(TripCommandTaskService.EXTRA_ID, id)
        .putExtra(TripCommandTaskService.EXTRA_REQUEST, request)
        .putExtra(TripCommandTaskService.EXTRA_CONFIRMED, confirmed)
      withContext(Dispatchers.Main) {
        // The assistant is bound to PackRat and on screen, which lets PackRat start the task.
        context.startService(intent)
        HeadlessJsTaskService.acquireWakeLockNow(context)
      }
      return withTimeoutOrNull(TIMEOUT_MS) { result.await() }
        ?: throw AppFunctionAppUnknownException("PackRat didn't finish the command in time.")
    } catch (error: IllegalStateException) {
      throw AppFunctionAppUnknownException("PackRat couldn't start the command: ${error.message}")
    } finally {
      pending.remove(id)
    }
  }

  /** JavaScript's answer to request [id]; false when nothing is waiting on it any more. */
  fun complete(id: String, answer: String, needsConfirmation: Boolean): Boolean =
    pending[id]?.complete(TripCommandResult(answer = answer, needsConfirmation = needsConfirmation)) ?: false
}
