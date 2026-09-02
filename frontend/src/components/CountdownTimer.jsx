import { useEffect, useState } from "react";

export default function CountdownTimer({ seconds = 90 }) {
  const [timeLeft, setTimeLeft] = useState(seconds);

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  return (
    <div style={styles.timer}>
      ⏱ Ambulance arriving in: <strong>{timeLeft}s</strong>
    </div>
  );
}

const styles = {
  timer: {
    padding: "10px",
    backgroundColor: "#ffba08",
    borderRadius: "8px",
    fontWeight: "bold",
    width: "fit-content",
  },
};
