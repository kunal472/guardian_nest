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
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

class GuardianAudioRecordService : Service() {

    companion object {
        private const val TAG = "GuardianAudioService"
        private const val CHANNEL_ID = "guardian_distress_spotter"
        private const val NOTIFICATION_ID = 8801
        const val ACTION_START = "expo.modules.guardianaudio.ACTION_START"
        const val ACTION_STOP = "expo.modules.guardianaudio.ACTION_STOP"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
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
                    AudioHardwareCoordinator.startListening()
                } else {
                    stopSelf()
                }
            }
            ACTION_STOP -> {
                AudioHardwareCoordinator.stopListening()
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
        super.onDestroy()
    }
}
