package expo.modules.guardianaudio

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.launch

class GuardianAudioModule : Module(), AudioCoordinatorListener {

    companion object {
        private const val TAG = "GuardianAudioModule"
    }

    override fun definition() = ModuleDefinition {
        Name("GuardianAudio")

        Events("onMeteringUpdate", "onError", "onStateChange")

        OnCreate {
            AudioHardwareCoordinator.listener = this@GuardianAudioModule
        }

        OnDestroy {
            AudioHardwareCoordinator.listener = null
            stopServiceInternal()
        }

        AsyncFunction("startContinuousSpotter") { promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                val err = "CONTEXT_ERROR: React context is null"
                Log.w(TAG, err)
                sendEvent("onError", mapOf("error" to err))
                promise.resolve(false)
                return@AsyncFunction
            }

            // Android 14+ Runtime Security Guard: Verify RECORD_AUDIO permission before FGS launch
            val hasMicPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            ) == PackageManager.PERMISSION_GRANTED

            if (!hasMicPermission) {
                val err = "PERMISSION_DENIED: RECORD_AUDIO not granted"
                Log.w(TAG, err)
                sendEvent("onError", mapOf("error" to err))
                promise.resolve(false)
                return@AsyncFunction
            }

            try {
                startServiceInternal()
                promise.resolve(true)
            } catch (e: SecurityException) {
                val err = "SECURITY_EXCEPTION: ${e.message}"
                Log.e(TAG, err, e)
                sendEvent("onError", mapOf("error" to err))
                promise.resolve(false)
            } catch (e: Exception) {
                val err = "START_ERROR: ${e.message}"
                Log.e(TAG, err, e)
                sendEvent("onError", mapOf("error" to err))
                promise.resolve(false)
            }
        }

        AsyncFunction("stopContinuousSpotter") { promise: Promise ->
            try {
                stopServiceInternal()
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("STOP_ERROR", e.message, e)
            }
        }

        AsyncFunction("pauseForHardwarePreemption") { cooldownMs: Int, promise: Promise ->
            appContext.backgroundCoroutineScope.launch {
                try {
                    val result = AudioHardwareCoordinator.pauseForPreemption(cooldownMs.toLong())
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.reject("PAUSE_ERROR", e.message, e)
                }
            }
        }

        AsyncFunction("resumeAfterHardwarePreemption") { cooldownMs: Int, promise: Promise ->
            appContext.backgroundCoroutineScope.launch {
                try {
                    val result = AudioHardwareCoordinator.resumeAfterPreemption(cooldownMs.toLong())
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.reject("RESUME_ERROR", e.message, e)
                }
            }
        }

        Function("isSpotterActive") {
            AudioHardwareCoordinator.getState() == SpotterState.LISTENING
        }

        Function("getSpotterState") {
            AudioHardwareCoordinator.getState().name
        }
    }

    private fun startServiceInternal() {
        val context = appContext.reactContext ?: return
        val intent = Intent(context, GuardianAudioRecordService::class.java).apply {
            action = GuardianAudioRecordService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    private fun stopServiceInternal() {
        val context = appContext.reactContext ?: return
        val intent = Intent(context, GuardianAudioRecordService::class.java).apply {
            action = GuardianAudioRecordService.ACTION_STOP
        }
        context.startService(intent)
    }

    override fun onMeteringUpdate(dbfs: Double, rms: Double) {
        sendEvent("onMeteringUpdate", mapOf("dbfs" to dbfs, "rms" to rms))
    }

    override fun onStateChange(state: SpotterState) {
        sendEvent("onStateChange", mapOf("state" to state.name))
    }

    override fun onError(message: String) {
        sendEvent("onError", mapOf("error" to message))
    }
}
