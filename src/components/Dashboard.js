import React, { useEffect, useState, useRef } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import SpeedOptionsModal from "./SpeedOptionsModal"; // Adjust import path

const Dashboard = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stepsPerSecond, setStepsPerSecond] = useState(1.18); // Default steps per second
  const [currentSpeed, setCurrentSpeed] = useState(1.5);
  const [totalSteps, setTotalSteps] = useState(0);
  const [stepsToday, setStepsToday] = useState(0);
  const [milesToday, setMilesToday] = useState(0);
  const [totalWalkingTime, setTotalWalkingTime] = useState(0);
  const [isWalking, setIsWalking] = useState(false);
  const [isSegmentActive, setIsSegmentActive] = useState(false);
  const [segmentSteps, setSegmentSteps] = useState(0);
  const [segments, setSegments] = useState([]);
  const [timeSinceLastSave, setTimeSinceLastSave] = useState(0);
  const [walkStartTime, setWalkStartTime] = useState(null);

  const stepIntervalRef = useRef(null);
  const saveIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  const handleSpeedChange = (newSpeed, newStepsPerSecond) => {
    saveStepsToFirestore();
    setCurrentSpeed(newSpeed);
    setStepsPerSecond(newStepsPerSecond);
  };

  // Function to get the local date in YYYY-MM-DD format
  const getLocalDate = () => {
    const options = {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    const [month, day, year] = new Date()
      .toLocaleDateString("en-US", options)
      .split("/");

    // Rearrange to YYYY-MM-DD format
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    // Fetch initial data
    const fetchData = async () => {
      const stepsSnapshot = await getDocs(collection(db, "steps"));
      let stepsCount = 0;
      let todayStepsCount = 0;
      const today = getLocalDate();

      stepsSnapshot.forEach((doc) => {
        const data = doc.data();
        stepsCount += data.stepsCount;

        if (data.date === today) {
          todayStepsCount += data.stepsCount;
        }
      });

      setTotalSteps(stepsCount);
      setStepsToday(todayStepsCount);
      setMilesToday(convertStepsToMiles(todayStepsCount)); // Set miles today initially
    };

    const fetchSegments = async () => {
      const segmentSnapshot = await getDocs(collection(db, "segments"));
      const fetchedSegments = [];

      segmentSnapshot.forEach((doc) => {
        fetchedSegments.push({ id: doc.id, ...doc.data() });
      });

      setSegments(fetchedSegments);
    };

    const fetchWalkingTime = async () => {
      const today = getLocalDate();
      const docRef = doc(db, "walkingTime", today);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setTotalWalkingTime(docSnap.data().totalWalkingTime || 0);
      }
    };

    fetchData();
    fetchSegments();
    fetchWalkingTime();

    const unsubscribe = onSnapshot(collection(db, "steps"), (snapshot) => {
      let stepsCount = 0;
      let todayStepsCount = 0;
      const today = getLocalDate();

      snapshot.forEach((doc) => {
        const data = doc.data();
        stepsCount += data.stepsCount;

        if (data.date === today) {
          todayStepsCount += data.stepsCount;
        }
      });

      setTotalSteps(stepsCount);
      setStepsToday(todayStepsCount);
      setMilesToday(convertStepsToMiles(todayStepsCount)); // Update miles today on snapshot
    });

    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  useEffect(() => {
    if (isWalking) {
      setWalkStartTime(Date.now());

      // Clear previous intervals
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

      stepIntervalRef.current = setInterval(() => {
        setTotalSteps((prevTotal) => prevTotal + 1);
        setStepsToday((prevTodaySteps) => {
          const newStepsToday = prevTodaySteps + 1;
          setMilesToday(convertStepsToMiles(newStepsToday)); // Update miles today
          return newStepsToday;
        });

        // If segment is active, also update segment steps
        if (isSegmentActive) {
          setSegmentSteps((prevSegmentSteps) => prevSegmentSteps + 1);
        }
      }, 1000 / stepsPerSecond); // 1.18 steps/second (4,248 steps/hr)

      // Timer to track time since last save
      timerIntervalRef.current = setInterval(() => {
        setTimeSinceLastSave((prevTime) => {
          const newTime = prevTime + 1;
          // Update total walking time based on time since last save
          setTotalWalkingTime((prevTime) => prevTime + 1000); // Add 1 second (1000 ms)
          return newTime;
        });
      }, 1000); // Update every second

      // Save to Firestore every 10 minutes
      saveIntervalRef.current = setInterval(() => {
        saveStepsToFirestore();
        saveWalkingTimeToFirestore();
        setTimeSinceLastSave(0); // Reset time since last save
      }, 10 * 60 * 1000); // 10 minutes
    } else {
      // Stop walking
      if (walkStartTime) {
        setWalkStartTime(null);
      }

      // Clear all intervals
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (stepIntervalRef.current) clearInterval(stepIntervalRef.current);
      if (saveIntervalRef.current) clearInterval(saveIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isWalking, isSegmentActive, stepsPerSecond]);

  useEffect(() => {
    const handleBeforeUnload = async (event) => {
      event.preventDefault();
      event.returnValue = ""; // Standard practice for Chrome/Firefox

      // Save steps and walking time before unloading
      await saveStepsToFirestore();
      await saveWalkingTimeToFirestore();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [stepsToday, totalWalkingTime]);

  const convertStepsToMiles = (steps) => {
    const stepsPerMile = 2400; // Adjust this number based on your stride length
    return (steps / stepsPerMile).toFixed(2); // Returns miles with two decimal points
  };

  const formatTime = (timeInMillis) => {
    const totalSeconds = Math.floor(timeInMillis / 1000);
    const days = Math.floor(totalSeconds / (24 * 3600));
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    // Create an array of time units
    const timeParts = [];
    if (days > 0) timeParts.push(`${days} day${days > 1 ? "s" : ""}`);
    if (hours > 0) timeParts.push(`${hours} hour${hours > 1 ? "s" : ""}`);
    if (minutes > 0)
      timeParts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
    if (seconds > 0)
      timeParts.push(`${seconds} second${seconds > 1 ? "s" : ""}`);

    // Join all the parts with commas and the last part with 'and'
    return timeParts.join(", ").replace(/,([^,]*)$/, " and$1");
  };

  const handleStartStop = () => {
    saveStepsToFirestore();
    saveWalkingTimeToFirestore();
    setIsWalking(!isWalking);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);

    // Format date as MM/DD/YYYY
    const formattedDate = date.toLocaleDateString("en-US");

    // Format time as 12-hour format with AM/PM
    const formattedTime = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    return `${formattedDate} ${formattedTime}`;
  };

  const saveStepsToFirestore = async () => {
    const today = getLocalDate();
    const docRef = doc(db, "steps", today);

    try {
      await setDoc(
        docRef,
        {
          date: today,
          stepsCount: stepsToday,
        },
        { merge: true }
      );
      setTimeSinceLastSave(0); // Reset time since last save
    } catch (error) {
      console.error("Error updating document: ", error);
    }
  };

  const saveWalkingTimeToFirestore = async () => {
    const today = getLocalDate();
    const docRef = doc(db, "walkingTime", today);

    try {
      await setDoc(
        docRef,
        {
          totalWalkingTime:
            totalWalkingTime + (walkStartTime ? Date.now() - walkStartTime : 0),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving walking time: ", error);
    }
  };

  const handleSegmentStartStop = () => {
    if (isSegmentActive) {
      // If stopping, prompt user to name the segment
      const name = prompt("Name this segment:");
      if (name) {
        saveSegmentToFirestore(name);
      }
      setIsSegmentActive(false);
      setSegmentSteps(0); // Reset segment steps after stopping
    } else {
      setSegmentSteps(0); // Reset to 0 when starting a new segment
      setIsSegmentActive(true);
    }
  };

  const saveSegmentToFirestore = async (name) => {
    const today = getLocalDate();
    const segmentDocRef = doc(collection(db, "segments")); // Auto-generate ID

    try {
      await setDoc(segmentDocRef, {
        name: name,
        date: today,
        stepsCount: segmentSteps,
        miles: convertStepsToMiles(segmentSteps),
        duration: `${Math.floor(timeSinceLastSave / 60)} min ${
          timeSinceLastSave % 60
        } sec`,
      });

      // Refresh segments list
      const segmentSnapshot = await getDocs(collection(db, "segments"));
      const fetchedSegments = [];

      segmentSnapshot.forEach((doc) => {
        fetchedSegments.push({ id: doc.id, ...doc.data() });
      });

      setSegments(fetchedSegments);
    } catch (error) {
      console.error("Error saving segment: ", error);
    }
  };

  // Function to format numbers with commas and 2 decimal places
  const formatNumberWithCommasAndDecimals = (number, decimalPlaces = 2) => {
    return number.toLocaleString(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
  };

  const handleDeleteSegment = async (segmentId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this segment?"
    );
    if (!confirmDelete) return; // Exit if user cancels

    try {
      const segmentRef = doc(db, "segments", segmentId);
      await deleteDoc(segmentRef);
      setSegments((prevSegments) =>
        prevSegments.filter((segment) => segment.id !== segmentId)
      );
      alert("Segment deleted successfully.");
    } catch (error) {
      console.error("Error deleting segment:", error);
      alert("Failed to delete segment.");
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={
            isWalking
              ? { ...styles.button, ...styles.stopButton }
              : { ...styles.button, ...styles.startButton }
          }
          onClick={handleStartStop}
        >
          {isWalking ? "Stop Walking" : "Start Walking"}
        </button>
        <button onClick={() => setIsModalOpen(true)}>Change Speed</button>
        <SpeedOptionsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSpeedChange={handleSpeedChange}
        />
        <div style={styles.saveContainer}>
          <button
            style={{ ...styles.button, ...styles.saveButton }}
            onClick={saveStepsToFirestore}
          >
            Save
          </button>
          <p style={styles.timer}>Time since last save: </p>
          <p>{formatTime(timeSinceLastSave * 1000)}</p>
        </div>
      </div>

      <div style={styles.currentSpeedBox}>
        <p style={styles.speedLabel}>Current Speed: {currentSpeed} mph</p>
        <p style={styles.speedValue}>Steps Per Second: {stepsPerSecond}</p>
      </div>
      {/* Start Segment Button and Stats */}
      <div style={styles.statsContainer}>
        <button
          style={{
            ...styles.button,
            ...(isSegmentActive
              ? styles.endSegmentButton
              : styles.segmentButton),
          }}
          onClick={handleSegmentStartStop}
        >
          {isSegmentActive ? "End Segment" : "Start Segment"}
        </button>
        <div
          style={{
            ...styles.segmentStatsContainer,
            ...(isSegmentActive && styles.activeSegmentStatsContainer),
          }}
        >
          <div style={styles.statRow}>
            <div style={styles.statBox}>
              <p style={styles.statLabel}>Segment Steps</p>
              <p style={styles.statValue}>
                {formatNumberWithCommasAndDecimals(segmentSteps, 0)}
              </p>
            </div>
            <div style={styles.statBox}>
              <p style={styles.statLabel}>Segment Miles</p>
              <p style={styles.statValue}>
                {formatNumberWithCommasAndDecimals(
                  convertStepsToMiles(segmentSteps),
                  2
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Stats */}
      <div style={styles.statsContainer}>
        <h2 style={styles.sectionTitle}>TODAY</h2>
        <div style={styles.dailyStats}>
          <div style={styles.statRow}>
            <div style={styles.statBox}>
              <p style={styles.statLabel}>Steps Today</p>
              <p style={styles.statValue}>
                {formatNumberWithCommasAndDecimals(stepsToday, 0)}
              </p>
            </div>
            <div style={styles.statBox}>
              <p style={styles.statLabel}>Miles Today</p>
              <p style={styles.statValue}>
                {formatNumberWithCommasAndDecimals(milesToday, 2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Total Stats */}
      <div style={styles.statsContainer}>
        <h2 style={styles.sectionTitle}>TOTAL</h2>
        <div style={styles.totalStats}>
          <div style={styles.statBoxFullWidth}>
            <p style={styles.statLabel}>Total Walking Time</p>
            <p style={styles.statValue}>{formatTime(totalWalkingTime)}</p>
          </div>
          <div style={styles.statRow}>
            <div style={styles.statBox}>
              <p style={styles.statLabel}>Total Steps</p>
              <p style={styles.statValue}>
                {formatNumberWithCommasAndDecimals(totalSteps, 0)}
              </p>
            </div>
            <div style={styles.statBox}>
              <p style={styles.statLabel}>Total Miles</p>
              <p style={styles.statValue}>
                {formatNumberWithCommasAndDecimals(
                  convertStepsToMiles(totalSteps),
                  2
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Segments */}
      <div style={styles.segmentsContainer}>
        <h2 style={styles.sectionTitle}>Segments</h2>
        {segments.length > 0 ? (
          <table style={styles.segmentTable}>
            <thead>
              <tr style={styles.tableHeaderRow}>
                <th style={styles.tableHeaderCell}>Title</th>
                <th style={styles.tableHeaderCell}>Steps</th>
                <th style={styles.tableHeaderCell}>Miles</th>
                <th style={styles.tableHeaderCell}>Duration</th>
                <th style={styles.tableHeaderCell}>Date/Time</th>
                <th style={styles.tableHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment, index) => (
                <tr
                  key={segment.id}
                  style={{
                    ...styles.tableRow,
                    backgroundColor: index % 2 === 0 ? "#333333" : "#444444",
                  }}
                >
                  <td style={styles.tableCell}>{segment.name}</td>
                  <td style={styles.tableCell}>
                    {formatNumberWithCommasAndDecimals(segment.stepsCount, 0)}
                  </td>
                  <td style={styles.tableCell}>
                    {formatNumberWithCommasAndDecimals(segment.miles, 2)}
                  </td>
                  <td style={styles.tableCell}>{segment.duration}</td>
                  <td style={styles.tableCell}>{formatDate(segment.date)}</td>
                  <td style={styles.tableCell}>
                    <button
                      style={styles.deleteButton}
                      onClick={() => handleDeleteSegment(segment.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No segments recorded.</p>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    color: "#E0E0E0",
    minHeight: "100vh",
    padding: "20px",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: "600px",
    marginBottom: "10px",
    position: "relative",
  },
  saveContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginLeft: "auto",
  },
  currentSpeedBox: {
    backgroundColor: "#3C3C3C",
    borderRadius: "8px",
    padding: "15px",
    margin: "5px",
    textAlign: "center",
    width: "calc(100% - 40px)",
    marginBottom: "20px",
    display: "flex",
  },
  statsContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    maxWidth: "600px",
  },
  sectionTitle: {
    marginBottom: "5px",
  },
  totalStats: {
    width: "80%",
    marginBottom: "10px",
    backgroundColor: "#8E8E8E", // Gray background for Total Stats
    borderRadius: "8px",
    padding: "15px",
  },
  dailyStats: {
    width: "80%",
    marginBottom: "10px",
    backgroundColor: "#66BB6A", // Greenish background for Today's Stats
    borderRadius: "8px",
    padding: "15px",
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: "10px",
  },
  statBox: {
    backgroundColor: "#3C3C3C",
    borderRadius: "8px",
    padding: "15px",
    margin: "5px",
    textAlign: "center",
    width: "calc(50% - 10px)",
  },
  statBoxFullWidth: {
    backgroundColor: "#3C3C3C",
    borderRadius: "8px",
    padding: "15px",
    margin: "5px",
    textAlign: "center",
    width: "calc(100% - 40px)",
  },
  statLabel: {
    fontSize: "14px",
    color: "#B0B0B0",
  },
  statValue: {
    fontSize: "18px",
    fontWeight: "bold",
  },
  button: {
    border: "none",
    color: "#fff",
    padding: "10px 20px",
    textAlign: "center",
    textDecoration: "none",
    display: "inline-block",
    fontSize: "16px",
    margin: "10px",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
  },
  startButton: {
    backgroundColor: "#4CAF50",
  },
  stopButton: {
    backgroundColor: "#F44336",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
  },
  segmentButton: {
    backgroundColor: "#2196F3",
  },
  endSegmentButton: {
    backgroundColor: "#F44336", // Red for "End Segment"
  },
  segmentStatsContainer: {
    display: "flex",
    justifyContent: "space-between",
    width: "80%",
    maxWidth: "600px",
    marginTop: "5px",
    backgroundColor: "#FFD54F", // Yellow background for Segment Stats
    borderRadius: "8px",
    padding: "15px",
  },
  activeSegmentStatsContainer: {
    backgroundColor: "#42A5F5", // Blue background if the segment is active
  },
  timer: {
    color: "#B0B0B0",
    marginTop: "10px",
  },
  segmentsContainer: {
    marginTop: "20px",
    width: "100%",
    maxWidth: "600px",
    overflowX: "auto", // Allows horizontal scrolling on small screens
  },
  segmentTable: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeaderRow: {
    backgroundColor: "#4CAF50", // Darker green for the header
    color: "#fff", // White text for better contrast
    textAlign: "left",
  },
  tableHeaderCell: {
    padding: "12px",
    borderBottom: "2px solid #ddd",
    color: "#fff", // White text in header cells
  },
  tableRow: {
    transition: "background-color 0.3s ease",
  },
  tableCell: {
    padding: "10px",
    borderBottom: "1px solid #ddd",
    color: "#fff", // Dark text for regular cells
  },
  deleteButton: {
    backgroundColor: "#F44336",
    border: "none",
    color: "#fff",
    padding: "5px 10px",
    fontSize: "14px",
    borderRadius: "5px",
    cursor: "pointer",
    transition: "background-color 0.3s ease",
  },
};

export default Dashboard;
