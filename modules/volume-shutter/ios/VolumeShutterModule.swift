// Listens for physical volume-button presses (and the Camera Control button
// on iPhone 16+) to fire a shutter event, via Apple's AVCaptureEventInteraction
// (iOS 17.2+) — the sanctioned API for this, not the older community
// volume-HUD-hijacking hack some camera apps historically used.
//
// IMPORTANT: this file was written from documented Apple API behavior and
// third-party developer write-ups (no Xcode/Mac/physical device was
// available to compile or test it against) — see project memory
// (project_food-app_full_launch_checklist, docket item 14) before trusting
// this in production. Verify on a real iOS 17.2+ device before shipping.
//
// Per Apple's own guidance, the system only routes volume-button presses to
// this interaction (instead of treating them as normal system volume
// control) while the app is actively using the camera — expo-camera's
// CameraView already runs a live AVCaptureSession whenever it's mounted and
// active, so no separate capture session is created here.
import ExpoModulesCore
import AVFoundation
import UIKit

public class VolumeShutterModule: Module {
  private var interaction: AnyObject?
  private weak var attachedWindow: UIWindow?

  public func definition() -> ModuleDefinition {
    Name("VolumeShutter")

    Events("onShutterPress")

    Function("isAvailable") {
      if #available(iOS 17.2, *) {
        return true
      }
      return false
    }

    Function("startListening") {
      self.attach()
    }

    Function("stopListening") {
      self.detach()
    }
  }

  @available(iOS 17.2, *)
  private func makeInteraction() -> AVCaptureEventInteraction {
    return AVCaptureEventInteraction { [weak self] event in
      if event.phase == .began {
        self?.sendEvent("onShutterPress", [:])
      }
    }
  }

  private func attach() {
    guard #available(iOS 17.2, *) else { return }
    guard interaction == nil else { return }
    guard let window = UIApplication.shared.connectedScenes
      .compactMap({ ($0 as? UIWindowScene)?.keyWindow })
      .first else { return }

    let captureInteraction = makeInteraction()
    window.addInteraction(captureInteraction)
    interaction = captureInteraction
    attachedWindow = window
  }

  private func detach() {
    guard #available(iOS 17.2, *) else { return }
    if let captureInteraction = interaction as? AVCaptureEventInteraction, let window = attachedWindow {
      window.removeInteraction(captureInteraction)
    }
    interaction = nil
    attachedWindow = nil
  }
}
