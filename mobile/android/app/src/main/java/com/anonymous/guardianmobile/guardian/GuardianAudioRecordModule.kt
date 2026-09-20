package com.anonymous.guardianmobile.guardian

import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicBoolean

class GuardianAudioRecordModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    GuardianAudioRecordService.AudioTelemetryListener {

    companion object {
        const val NAME = "GuardianAudioRecordModule"
        private const val TAG = "GuardianAudioModule"
    }

    private val isModuleActive = AtomicBoolean(false)
    private val isPreempted = AtomicBoolean(false)
    private val moduleScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    override fun getName(): String = NAME

    override fun initialize() {
        super.initialize()
        GuardianAudioRecordService.listener = this
    }

    override fun invalidate() {
        GuardianAudioRecordService.listener = null
        stopServiceInternal()
        moduleScope.cancel()
        super.invalidate()
    }

    override fun onMeteringUpdate(dbfs: Float, rms: Float) {
        if (!reactContext.hasActiveReactInstance()) return
        try {
            val params = Arguments.createMap().apply {
                putDouble("dbfs", dbfs.toDouble())
                putDouble("rms", rms.toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onAudioMetering", params)
        } catch (e: Exception) {
            Log.w(TAG, "Error emitting onAudioMetering: ${e.message}")
        }
    }

    override fun onPcmChunk(base64Chunk: String) {
        if (!reactContext.hasActiveReactInstance()) return
        try {
            val params = Arguments.createMap().apply {
                putString("pcmBase64", base64Chunk)
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onAudioBuffer", params)
        } catch (e: Exception) {
            Log.w(TAG, "Error emitting onAudioBuffer: ${e.message}")
        }
    }

    private fun startServiceInternal() {
        val intent = Intent(reactContext, GuardianAudioRecordService::class.java).apply {
            action = GuardianAudioRecordService.ACTION_START
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    private fun stopServiceInternal() {
        val intent = Intent(reactContext, GuardianAudioRecordService::class.java).apply {
            action = GuardianAudioRecordService.ACTION_STOP
        }
        reactContext.startService(intent)
    }

    @ReactMethod
    fun startListening(promise: Promise) {
        try {
            isModuleActive.set(true)
            isPreempted.set(false)
            startServiceInternal()
            Log.d(TAG, "startListening invoked.")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start listening: ${e.message}", e)
            promise.reject("START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopListening(promise: Promise) {
        try {
            isModuleActive.set(false)
            isPreempted.set(false)
            stopServiceInternal()
            Log.d(TAG, "stopListening invoked.")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop listening: ${e.message}", e)
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun pauseForHardwarePreemption(cooldownMs: Int, promise: Promise) {
        moduleScope.launch {
            try {
                isPreempted.set(true)
                stopServiceInternal()
                val safeCooldown = if (cooldownMs in 50..2000) cooldownMs else 200
                delay(safeCooldown.toLong())
                Log.d(TAG, "pauseForHardwarePreemption completed ($safeCooldown ms cooldown).")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "Error in pauseForHardwarePreemption: ${e.message}", e)
                promise.reject("PAUSE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun resumeAfterHardwarePreemption(cooldownMs: Int, promise: Promise) {
        moduleScope.launch {
            try {
                val safeCooldown = if (cooldownMs in 50..2000) cooldownMs else 150
                delay(safeCooldown.toLong())
                if (isModuleActive.get()) {
                    isPreempted.set(false)
                    startServiceInternal()
                    Log.d(TAG, "resumeAfterHardwarePreemption completed ($safeCooldown ms cooldown).")
                }
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "Error in resumeAfterHardwarePreemption: ${e.message}", e)
                promise.reject("RESUME_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun isListening(promise: Promise) {
        promise.resolve(isModuleActive.get() && !isPreempted.get())
    }
}
