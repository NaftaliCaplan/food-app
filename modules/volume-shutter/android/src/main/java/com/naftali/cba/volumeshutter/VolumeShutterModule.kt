package com.naftali.cba.volumeshutter

import android.view.KeyEvent
import android.view.Window
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Listens for physical volume-button presses to fire a shutter event, by
// wrapping the current Activity's Window.Callback — standard, long-standing
// Android API, not a hack. Only intercepts volume keys while explicitly
// armed (startListening), and only consumes the key event (preventing the
// system volume change) while armed; everything else still reaches the
// original callback untouched.
class VolumeShutterModule : Module() {
  private var armed = false
  private var originalCallback: Window.Callback? = null

  override fun definition() = ModuleDefinition {
    Name("VolumeShutter")

    Events("onShutterPress")

    Function("isAvailable") {
      true
    }

    Function("startListening") {
      armed = true
      attach()
    }

    Function("stopListening") {
      armed = false
      detach()
    }
  }

  private fun attach() {
    val activity = appContext.currentActivity ?: return
    if (originalCallback != null) return // already wrapped
    val original = activity.window.callback
    originalCallback = original
    activity.window.callback = ShutterWindowCallback(original) {
      sendEvent("onShutterPress", mapOf())
    }
  }

  private fun detach() {
    val activity = appContext.currentActivity ?: return
    originalCallback?.let { activity.window.callback = it }
    originalCallback = null
  }

  // Delegates everything to the original callback except dispatchKeyEvent,
  // where it intercepts volume-key-down presses to fire the shutter event
  // instead of letting the system change the device volume.
  private inner class ShutterWindowCallback(
    private val original: Window.Callback,
    private val onShutterKey: () -> Unit,
  ) : Window.Callback by original {
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
      val isVolumeKey = event.keyCode == KeyEvent.KEYCODE_VOLUME_UP || event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
      if (armed && isVolumeKey && event.action == KeyEvent.ACTION_DOWN) {
        onShutterKey()
        return true
      }
      return original.dispatchKeyEvent(event)
    }
  }
}
