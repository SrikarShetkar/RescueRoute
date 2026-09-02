import { useEffect } from "react";
import socketService, { EVENTS } from "../services/socket";
import soundManager from "../services/soundManager";
import { getUiState } from "../services/uiRole";

/**
 * SoundCenter — mounted once, listens to the server's sound-plan and siren
 * streams, and plays audio only when the event is actually meant for the
 * screen currently open in this window. There is no other audio path in the app.
 */
export default function SoundCenter() {
  useEffect(() => {
    socketService.connectSocket();

    const handleSound = (payload) => {
      const { sounds = [] } = payload || {};
      const { role, trackedEmergencyId } = getUiState();

      sounds.forEach((item) => {
        if (!item || !item.sound || item.sound === "quiet") return;
        const forRoles = item.forRoles || [];
        const isGlobal = forRoles.includes("all");
        const forMe = forRoles.includes(role);

        if (!isGlobal && !forMe) return;

        // The reporter only confirms events about the case they are tracking.
        if (role === "reporter" && forRoles.includes("reporter") && !isGlobal) {
          if (trackedEmergencyId && item.emergencyId && item.emergencyId !== trackedEmergencyId) return;
        }

        // The siren is never played by the ambulance screen itself — only by
        // nearby-driver screens (see siren:event handler below).
        soundManager.playSound(item);
      });
    };

    const handleSiren = (payload) => {
      const { role } = getUiState();
      if (role !== "driver") return;
      if (payload.on && !payload.outOfRange) {
        soundManager.playSiren(`ambulance ${payload.ambulanceId}`);
      } else {
        soundManager.stopSiren();
      }
    };

    const keySound = socketService.on(EVENTS.SOUND_EVENT, handleSound);
    const keySiren = socketService.on(EVENTS.SIREN_EVENT, handleSiren);

    return () => {
      socketService.off(EVENTS.SOUND_EVENT, keySound);
      socketService.off(EVENTS.SIREN_EVENT, keySiren);
      soundManager.stopSiren();
    };
  }, []);

  return null;
}