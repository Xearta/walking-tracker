import React, { useState } from "react";

const SpeedOptionsModal = ({ isOpen, onClose, onSpeedChange }) => {
  const [speed, setSpeed] = useState(1.5); // Default speed

  const speedOptions = [
    { value: 1.5, label: "1.5 mph" },
    { value: 2.0, label: "2.0 mph" },
    { value: 2.5, label: "2.5 mph" },
    { value: 3.0, label: "3.0 mph" },
    { value: 5.0, label: "5.0 mph" },
  ];

  // Handle speed change
  const handleSpeedChange = () => {
    const stepsPerSecond = getStepsPerSecond(speed);
    onSpeedChange(speed, stepsPerSecond);
    onClose();
  };

  // Convert speed in mph to steps per second
  const getStepsPerSecond = (speed) => {
    switch (speed) {
      case 1.5:
        return 1.18;
      case 2.0:
        return 1.5;
      case 2.5:
        return 1.66;
      case 3.0:
        return 1.83;
      case 5.0:
        return 5.0;
      default:
        return 1.18; // Default to 1.5 mph if unknown speed
    }
  };

  if (!isOpen) return null;

  return (
    <div style={styles.modalBackground}>
      <div style={styles.modalContent}>
        <h2>Select Speed</h2>
        <div style={styles.speedOptions}>
          {speedOptions.map((option) => (
            <div
              key={option.value}
              style={{
                ...styles.option,
                backgroundColor: speed === option.value ? "#4CAF50" : "#333",
                color: speed === option.value ? "#fff" : "#ddd",
              }}
              onClick={() => setSpeed(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>
        <button style={styles.saveButton} onClick={handleSpeedChange}>
          Save
        </button>
        <button style={styles.cancelButton} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const styles = {
  modalBackground: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    backgroundColor: "#333",
    padding: "20px",
    borderRadius: "8px",
    textAlign: "center",
    width: "300px",
    color: "#fff",
  },
  speedOptions: {
    margin: "20px 0",
  },
  option: {
    padding: "10px",
    borderRadius: "5px",
    margin: "5px 0",
    cursor: "pointer",
    transition: "background-color 0.3s, color 0.3s",
  },
  saveButton: {
    backgroundColor: "#4CAF50", // Green color
    color: "#fff",
    border: "none",
    padding: "10px 20px",
    margin: "10px",
    cursor: "pointer",
    borderRadius: "5px",
  },
  cancelButton: {
    backgroundColor: "#ccc",
    border: "none",
    padding: "10px 20px",
    margin: "10px",
    cursor: "pointer",
    borderRadius: "5px",
  },
};

export default SpeedOptionsModal;
