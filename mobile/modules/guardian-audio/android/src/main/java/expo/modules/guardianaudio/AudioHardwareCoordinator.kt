package expo.modules.guardianaudio

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.log10
import kotlin.math.sqrt

enum class SpotterState {
    IDLE,
    LISTENING,
    PREEMPTED
}

interface AudioCoordinatorListener {
    fun onMeteringUpdate(dbfs: Double, rms: Double)
    fun onStateChange(state: SpotterState)
    fun onError(message: String)
}

object AudioHardwareCoordinator {
    private const val TAG = "AudioHardwareCoord"

    const val SAMPLE_RATE = 16000
    const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
    const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    const val CHUNK_SIZE = 1600 // 100ms window at 16kHz (1600 samples)

    private val currentState = AtomicReference(SpotterState.IDLE)
    private val isRecordingLoopRunning = AtomicBoolean(false)
    private var audioRecord: AudioRecord? = null
    private var workerJob: Job? = null
    private val coordinatorScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    var listener: AudioCoordinatorListener? = null

    fun getState(): SpotterState = currentState.get()

    @Synchronized
    fun startListening(): Boolean {
        val state = currentState.get()
        if (state == SpotterState.LISTENING) {
            Log.d(TAG, "AudioRecord spotter is already LISTENING.")
            return true
        }

        currentState.set(SpotterState.LISTENING)
        listener?.onStateChange(SpotterState.LISTENING)

        startWorkerLoop()
        return true
    }

    @Synchronized
    fun stopListening(): Boolean {
        currentState.set(SpotterState.IDLE)
        listener?.onStateChange(SpotterState.IDLE)

        stopWorkerLoop()
        return true
    }

    suspend fun pauseForPreemption(cooldownMs: Long = 200L): Boolean = withContext(Dispatchers.Default) {
        val previousState = currentState.get()
        if (previousState == SpotterState.IDLE) {
            return@withContext true
        }

        currentState.set(SpotterState.PREEMPTED)
        listener?.onStateChange(SpotterState.PREEMPTED)

        stopWorkerLoop()

        // Give Android Audio HAL explicit delay to release microphone hardware descriptor
        val safeCooldown = cooldownMs.coerceIn(50L, 2000L)
        delay(safeCooldown)
        Log.d(TAG, "Hardware mic successfully released for preemption ($safeCooldown ms HAL cooldown).")
        true
    }

    suspend fun resumeAfterPreemption(cooldownMs: Long = 150L): Boolean = withContext(Dispatchers.Default) {
        val safeCooldown = cooldownMs.coerceIn(50L, 2000L)
        delay(safeCooldown)

        if (currentState.get() == SpotterState.PREEMPTED) {
            currentState.set(SpotterState.LISTENING)
            listener?.onStateChange(SpotterState.LISTENING)
            startWorkerLoop()
            Log.d(TAG, "Hardware mic successfully resumed after preemption ($safeCooldown ms HAL cooldown).")
        }
        true
    }

    private fun startWorkerLoop() {
        if (isRecordingLoopRunning.getAndSet(true)) return

        workerJob = coordinatorScope.launch(Dispatchers.IO) {
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
                    val errorMsg = "AudioRecord failed to initialize (STATE_UNINITIALIZED)"
                    Log.e(TAG, errorMsg)
                    listener?.onError(errorMsg)
                    isRecordingLoopRunning.set(false)
                    return@launch
                }

                audioRecord?.startRecording()
                Log.d(TAG, "🎙️ Native AudioRecord recording active at 16kHz PCM (VOICE_RECOGNITION source).")

                val audioBuffer = ShortArray(CHUNK_SIZE)

                while (isRecordingLoopRunning.get() && isActive && currentState.get() == SpotterState.LISTENING) {
                    val readCount = audioRecord?.read(audioBuffer, 0, CHUNK_SIZE) ?: -1
                    if (readCount > 0) {
                        var sum = 0.0
                        for (i in 0 until readCount) {
                            val sample = audioBuffer[i].toDouble()
                            sum += sample * sample
                        }

                        val rms = sqrt(sum / readCount)
                        val dbfs = if (rms > 0.0) {
                            (20.0 * log10(rms / 32768.0)).coerceIn(-100.0, 0.0)
                        } else {
                            -100.0
                        }

                        listener?.onMeteringUpdate(dbfs, rms)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception in AudioRecord loop: ${e.message}", e)
                listener?.onError(e.message ?: "AudioRecord worker loop error")
            } finally {
                cleanupHardware()
            }
        }
    }

    private fun stopWorkerLoop() {
        isRecordingLoopRunning.set(false)
        workerJob?.cancel()
        workerJob = null
        cleanupHardware()
    }

    private fun cleanupHardware() {
        try {
            audioRecord?.apply {
                if (recordingState == AudioRecord.RECORDSTATE_RECORDING) {
                    stop()
                }
                release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Exception releasing AudioRecord: ${e.message}")
        } finally {
            audioRecord = null
            isRecordingLoopRunning.set(false)
            Log.d(TAG, "AudioRecord handle cleaned up.")
        }
    }
}
