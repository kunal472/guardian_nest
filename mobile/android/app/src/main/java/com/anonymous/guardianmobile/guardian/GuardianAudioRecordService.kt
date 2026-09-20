package com.anonymous.guardianmobile.guardian

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import android.util.Base64
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.log10
import kotlin.math.sqrt

class GuardianAudioRecordService : Service() {

    companion object {
        private const val TAG = "GuardianAudioService"
        private const val CHANNEL_ID = "guardian_audio_edge_channel"
        private const val NOTIFICATION_ID = 9001
        const val ACTION_START = "com.anonymous.guardianmobile.ACTION_START_AUDIO"
        const val ACTION_STOP = "com.anonymous.guardianmobile.ACTION_STOP_AUDIO"

        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val CHUNK_SIZE = 1600 // 100ms at 16kHz (1600 16-bit samples = 3200 bytes)

        var listener: AudioTelemetryListener? = null
    }

    interface AudioTelemetryListener {
        fun onMeteringUpdate(dbfs: Float, rms: Float)
        fun onPcmChunk(base64Chunk: String)
    }

    private val isRecording = AtomicBoolean(false)
    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null
    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                startForegroundServiceSafely()
                startNativeAudioRecord()
            }
            ACTION_STOP -> {
                stopNativeAudioRecord()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Guardian Edge Protection",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Always-on Acoustic Scream & Wake Phrase Spotter"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun startForegroundServiceSafely() {
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Guardian Edge Protection")
            .setContentText("Acoustic Distress & Wake Phrase Spotter Active")
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        try {
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
            Log.d(TAG, "Foreground service started with microphone type.")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting foreground service: ${e.message}", e)
        }
    }

    private fun startNativeAudioRecord() {
        if (isRecording.getAndSet(true)) {
            Log.d(TAG, "AudioRecord already active.")
            return
        }

        recordingJob = serviceScope.launch {
            try {
                val minBufferSize = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT
                )
                val bufferSize = maxOf(minBufferSize, CHUNK_SIZE * 2)

                audioRecord = AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    SAMPLE_RATE,
                    CHANNEL_CONFIG,
                    AUDIO_FORMAT,
                    bufferSize
                )

                if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                    Log.e(TAG, "AudioRecord failed to initialize (state != STATE_INITIALIZED)")
                    isRecording.set(false)
                    return@launch
                }

                audioRecord?.startRecording()
                Log.d(TAG, "🎙️ Native AudioRecord recording started at 16kHz PCM.")

                val audioBuffer = ShortArray(CHUNK_SIZE)
                val byteBuffer = ByteArray(CHUNK_SIZE * 2)

                while (isRecording.get() && isActive) {
                    val readCount = audioRecord?.read(audioBuffer, 0, CHUNK_SIZE) ?: -1
                    if (readCount > 0) {
                        var sum = 0.0
                        for (i in 0 until readCount) {
                            val sample = audioBuffer[i].toDouble()
                            sum += sample * sample

                            // Convert to little-endian bytes
                            byteBuffer[i * 2] = (audioBuffer[i].toInt() and 0xFF).toByte()
                            byteBuffer[i * 2 + 1] = ((audioBuffer[i].toInt() shr 8) and 0xFF).toByte()
                        }

                        val rms = sqrt(sum / readCount)
                        val dbfs = if (rms > 0.0) {
                            (20.0 * log10(rms / 32768.0)).toFloat()
                        } else {
                            -120.0f
                        }

                        // Emit native metering to listener
                        listener?.onMeteringUpdate(dbfs, rms.toFloat())
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in audio recording loop: ${e.message}", e)
            } finally {
                cleanupAudioRecord()
            }
        }
    }

    private fun stopNativeAudioRecord() {
        isRecording.set(false)
        recordingJob?.cancel()
        recordingJob = null
        cleanupAudioRecord()
    }

    private fun cleanupAudioRecord() {
        try {
            audioRecord?.apply {
                if (recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    stop()
                }
                release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Exception during AudioRecord release: ${e.message}")
        } finally {
            audioRecord = null
            Log.d(TAG, "AudioRecord successfully released and freed.")
        }
    }

    override fun onDestroy() {
        stopNativeAudioRecord()
        serviceScope.cancel()
        super.onDestroy()
    }
}
