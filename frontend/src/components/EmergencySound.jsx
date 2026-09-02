import React, { useEffect, useRef, useCallback } from 'react';

// SOUND + ICON
import alertSound from "../assets/sounds/rescue-alert.mp3";
import sirenIcon from "../assets/icons/siren.svg";

const VIBRATION_PATTERN = [1000, 200, 500, 200, 1000];

// Main EmergencySound Component with props
const EmergencySound = ({ isActive, onComplete }) => {
  const audioRef = useRef(null);

  const triggerAlert = useCallback(() => {
    // Vibration
    if ('vibrate' in navigator) {
      navigator.vibrate(VIBRATION_PATTERN);
    }

    // Sound
    if (audioRef.current) {
      audioRef.current.volume = 0.7;
      audioRef.current.play().catch(err => console.log('Audio play failed:', err));
    }

    // Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('🚨 Emergency Vehicle Approaching', {
        body: 'Please clear the lane',
        vibrate: VIBRATION_PATTERN
      });
    }

    if (onComplete) {
      setTimeout(onComplete, 3000);
    }
  }, [onComplete]);

  useEffect(() => {
    if (isActive) {
      triggerAlert();
    }
  }, [isActive, triggerAlert]);

  return (
    <audio ref={audioRef} preload="auto" style={{ display: 'none' }}>
      <source src={alertSound} type="audio/mpeg" />
    </audio>
  );
};

// Export request notification permission
export const requestNotificationPermission = () => {
  if ('Notification' in window && Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Promise.resolve(Notification.permission);
};

// Export test alert function
export const testEmergencyAlert = () => {
  const audio = new Audio(alertSound);
  audio.volume = 0.7;
  audio.play().catch(err => console.log('Audio play failed:', err));
  
  if ('vibrate' in navigator) {
    navigator.vibrate([1000, 200, 500, 200, 1000]);
  }
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🚨 Emergency Vehicle Approaching', {
      body: 'Please clear the lane',
      vibrate: [1000, 200, 500, 200, 1000]
    });
  }
};

// Export button component version
export function EmergencySoundButton() {
  const triggerAlert = () => {
    const audio = new Audio(alertSound);
    audio.play();
    if (navigator.vibrate) {
      navigator.vibrate([400, 200, 400]);
    }
  };

  return (
    <button style={styles.btn} onClick={triggerAlert}>
      <img src={sirenIcon} width="24" alt="" /> Trigger Emergency
    </button>
  );
}

const styles = {
  btn: {
    background: "red",
    color: "#fff",
    padding: "15px 20px",
    fontSize: 18,
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
};

export default EmergencySound;