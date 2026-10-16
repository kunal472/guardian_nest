package expo.modules.guardianaudio

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets

class GuardianAudioRecordService : Service() {

    companion object {
        private const val TAG = "GuardianAudioService"
        private const val CHANNEL_ID = "guardian_distress_spotter"
        private const val EMERGENCY_CHANNEL_ID = "guardian_emergency_channel"
        private const val NOTIFICATION_ID = 8801
        const val ACTION_START = "expo.modules.guardianaudio.ACTION_START"
        const val ACTION_STOP = "expo.modules.guardianaudio.ACTION_STOP"

        var instance: GuardianAudioRecordService? = null
        var targetBackendUrl: String = "http://10.122.65.208:3000"
        var targetAuthToken: String? = null
    }

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "GuardianAudio::AcousticSentinelWakeLock"
            ).apply {
                setReferenceCounted(false)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize WakeLock: ${e.message}")
        }
    }

    fun triggerNativeDistressAlarm(dbfs: Double) {
        Log.w(TAG, "🚨 [NATIVE SENTINEL] Executing native background distress alarm for scream (dBFS: $dbfs)")

        // 1. Device Vibration (Haptic Emergency Feedback)
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 500, 200, 500, 200, 800), -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(longArrayOf(0, 500, 200, 500, 200, 800), -1)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Vibrator trigger note: ${e.message}")
        }

        // 2. Update Foreground Notification to Critical Distress Alert
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val emgChannel = NotificationChannel(
                    EMERGENCY_CHANNEL_ID,
                    "Guardian Emergency Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Critical Emergency SOS Dispatch Alerts"
                    enableVibration(true)
                }
                notificationManager.createNotificationChannel(emgChannel)
            }

            val alertNotification = NotificationCompat.Builder(this, if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) EMERGENCY_CHANNEL_ID else CHANNEL_ID)
                .setContentTitle("🚨 GUARDIAN EMERGENCY SOS TRIGGERED")
                .setContentText("Acoustic Scream Detected! Dispatching Emergency Mesh...")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setColor(0xFFFF0000.toInt())
                .build()

            notificationManager.notify(NOTIFICATION_ID, alertNotification)
        } catch (e: Exception) {
            Log.w(TAG, "Notification alert update note: ${e.message}")
        }

        // 3. Dispatch Background HTTP POST Beacon directly to backend
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("$targetBackendUrl/api/incidents")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.setRequestProperty("Accept", "application/json")
                targetAuthToken?.let {
                    conn.setRequestProperty("Authorization", "Bearer $it")
                }
                conn.connectTimeout = 6000
                conn.readTimeout = 6000
                conn.doOutput = true

                val payload = """{"triggerType":"AUDIO_SCREAM","status":"ACTIVE","notes":"Native Background Scream Sentinel Trigger (Screen-Off)"}"""
                conn.outputStream.use { os ->
                    val input = payload.toByteArray(StandardCharsets.UTF_8)
                    os.write(input, 0, input.size)
                }

                val responseCode = conn.responseCode
                Log.i(TAG, "📡 [NATIVE SENTINEL] HTTP POST Beacon dispatched to $url -> Response: $responseCode")
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "Native HTTP distress beacon note: ${e.message}")
            }
        }

        // 4. Bring MainActivity to Foreground / Turn on screen
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                putExtra("NATIVE_EMERGENCY_TRIGGER", "AUDIO_SCREAM")
            }
            if (launchIntent != null) {
                startActivity(launchIntent)
            }
        } catch (e: Exception) {
            Log.w(TAG, "MainActivity launch note: ${e.message}")
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                val hasMic = ContextCompat.checkSelfPermission(
                    this,
                    android.Manifest.permission.RECORD_AUDIO
                ) == android.content.pm.PackageManager.PERMISSION_GRANTED

                if (!hasMic) {
                    Log.w(TAG, "Cannot start foreground service: RECORD_AUDIO permission not granted.")
                    stopSelf()
                    return START_NOT_STICKY
                }

                val started = startForegroundServiceSafely()
                if (started) {
                    try {
                        if (wakeLock?.isHeld == false) {
                            wakeLock?.acquire()
                            Log.d(TAG, "Acquired partial WakeLock for screen-off acoustic protection.")
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "WakeLock acquire note: ${e.message}")
                    }
                    AudioHardwareCoordinator.startListening()
                } else {
                    stopSelf()
                }
            }
            ACTION_STOP -> {
                AudioHardwareCoordinator.stopListening()
                try {
                    if (wakeLock?.isHeld == true) {
                        wakeLock?.release()
                        Log.d(TAG, "Released partial WakeLock.")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "WakeLock release note: ${e.message}")
                }
                try {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } catch (e: Exception) {
                    Log.w(TAG, "stopForeground note: ${e.message}")
                }
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Guardian Edge Sentinel",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Always-on Acoustic Scream & Wake Phrase Protection"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundServiceSafely(): Boolean {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Guardian Edge Protection")
            .setContentText("Acoustic Sentinel Active (Always-on Vocal Protection)")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceCompat.startForeground(
                    this,
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            Log.d(TAG, "Foreground service started with FOREGROUND_SERVICE_TYPE_MICROPHONE.")
            true
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException starting foreground service: ${e.message}", e)
            false
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start foreground service: ${e.message}", e)
            false
        }
    }

    override fun onDestroy() {
        AudioHardwareCoordinator.stopListening()
        instance = null
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
                Log.d(TAG, "WakeLock released on service destruction.")
            }
        } catch (e: Exception) {
            Log.w(TAG, "WakeLock release note: ${e.message}")
        }
        super.onDestroy()
    }
}
