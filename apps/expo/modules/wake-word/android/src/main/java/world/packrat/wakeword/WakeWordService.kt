package world.packrat.wakeword

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import java.util.Random
import org.json.JSONObject

/**
 * Listens for "Hey PackRat" while a trip is in progress, with the phone locked.
 *
 * A foreground service of the microphone type, so Android lets it keep the microphone after the
 * app leaves the screen. Detection runs on the phone with the bundled microWakeWord model and no
 * audio is kept. On a detection the microphone is let go, so the speech recogniser can hear the
 * command, and listening stays paused until the app resumes it.
 */
class WakeWordService : Service() {
  private var worker: Thread? = null
  @Volatile private var running = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val title = intent.getStringExtra(EXTRA_TITLE) ?: ""
        val text = intent.getStringExtra(EXTRA_TEXT) ?: ""
        val channelName = intent.getStringExtra(EXTRA_CHANNEL) ?: title
        if (!enterForeground(title, text, channelName)) return START_NOT_STICKY
        startListening()
      }
      ACTION_RESUME -> startListening()
      ACTION_PAUSE -> stopListening()
      ACTION_STOP -> {
        stopListening()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
    // A restart by the system would come back without the app having armed it.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    stopListening()
    isArmed = false
    super.onDestroy()
  }

  private fun enterForeground(title: String, text: String, channelName: String): Boolean {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_LOW)
      channel.setShowBadge(false)
      manager.createNotificationChannel(channel)
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(smallIcon())
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(true)
      .setSilent(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setContentIntent(launch)
      .build()
    return try {
      ServiceCompat.startForeground(
        this,
        NOTIFICATION_ID,
        notification,
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0,
      )
      isArmed = true
      true
    } catch (error: Exception) {
      // Android refuses a microphone service started while the app isn't on screen.
      Log.w(TAG, "Couldn't start listening in the foreground", error)
      stopSelf()
      false
    }
  }

  private fun smallIcon(): Int {
    val icon = resources.getIdentifier("notification_icon", "drawable", packageName)
    return if (icon != 0) icon else applicationInfo.icon
  }

  private fun startListening() {
    if (running || !isArmed) return
    running = true
    worker = Thread({ listenLoop() }, "WakeWordListener").also { it.start() }
  }

  private fun stopListening() {
    running = false
    worker?.let { if (it !== Thread.currentThread()) it.join(1_000) }
    worker = null
  }

  @SuppressLint("MissingPermission")
  private fun listenLoop() {
    val detector = try {
      createDetector()
    } catch (error: Exception) {
      Log.e(TAG, "Couldn't load the wake word model", error)
      running = false
      return
    }
    val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    val record = try {
      AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        maxOf(minBuffer, CHUNK_SAMPLES * 2 * 10),
      )
    } catch (error: Exception) {
      Log.e(TAG, "Couldn't open the microphone", error)
      detector.close()
      running = false
      return
    }
    var heard = false
    try {
      if (record.state != AudioRecord.STATE_INITIALIZED) {
        Log.e(TAG, "Microphone isn't available")
        return
      }
      warmUp(detector)
      record.startRecording()
      val chunk = ShortArray(CHUNK_SAMPLES)
      while (running) {
        val read = record.read(chunk, 0, chunk.size)
        if (read <= 0) {
          if (read < 0) Log.w(TAG, "Microphone read failed: $read")
          continue
        }
        val samples = if (read == chunk.size) chunk else chunk.copyOf(read)
        if (detector.processAudio(samples)) {
          heard = true
          break
        }
      }
    } finally {
      running = false
      try {
        record.stop()
      } catch (_: IllegalStateException) {
      }
      record.release()
      detector.close()
    }
    // Only now is the microphone free for the recogniser that hears the command.
    if (heard) onWake?.invoke()
  }

  private fun createDetector(): MicroWakeWord {
    val config = JSONObject(assets.open(CONFIG_ASSET).bufferedReader().use { it.readText() })
    val micro = config.getJSONObject("micro")
    val model = assets.openFd(config.getString("model")).use { fd ->
      fd.createInputStream().use { stream ->
        stream.channel.map(FileChannel.MapMode.READ_ONLY, fd.startOffset, fd.declaredLength)
      }
    }
    model.order(ByteOrder.nativeOrder())
    return MicroWakeWord(
      modelBuffer = model,
      featureStepSizeMs = micro.optInt("feature_step_size", 10),
      probabilityCutoff = micro.getDouble("probability_cutoff").toFloat(),
      slidingWindowSize = micro.getInt("sliding_window_size"),
    )
  }

  /**
   * The feature front end needs a second or two of background sound to settle its noise estimate,
   * or a wake phrase said straight after starting is missed. Feed it quiet noise first.
   */
  private fun warmUp(detector: MicroWakeWord) {
    val noise = Random(42L)
    val chunk = ShortArray(CHUNK_SAMPLES)
    repeat(WARM_UP_CHUNKS) {
      for (i in chunk.indices) chunk[i] = (noise.nextGaussian() * 25.0).toInt().toShort()
      detector.processAudio(chunk)
    }
  }

  companion object {
    private const val TAG = "WakeWordService"
    const val ACTION_START = "world.packrat.wakeword.START"
    const val ACTION_PAUSE = "world.packrat.wakeword.PAUSE"
    const val ACTION_RESUME = "world.packrat.wakeword.RESUME"
    const val ACTION_STOP = "world.packrat.wakeword.STOP"
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    const val EXTRA_CHANNEL = "channel"

    private const val CHANNEL_ID = "packrat-wake-word"
    private const val NOTIFICATION_ID = 4_721
    private const val CONFIG_ASSET = "hey_packrat_mww.json"
    private const val SAMPLE_RATE = 16_000
    /** 10 ms of audio, one feature frame. */
    private const val CHUNK_SAMPLES = 160
    /** 4 s of warm-up noise. */
    private const val WARM_UP_CHUNKS = 400

    /** Whether the service is in the foreground and listening or ready to. */
    @Volatile var isArmed = false
      private set

    /** Called on the listening thread once the phrase is heard and the microphone is free. */
    @Volatile var onWake: (() -> Unit)? = null
  }
}
