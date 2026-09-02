export default function MapView() {
  return (
    <div style={styles.map}>
      🗺️ Map Simulation Area
      <p>Ambulance & vehicle movement will appear here</p>
    </div>
  );
}

const styles = {
  map: {
    height: "300px",
    border: "2px dashed #adb5bd",
    borderRadius: "10px",
    marginTop: "20px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    color: "#6c757d",
  },
};
