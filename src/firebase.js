// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore"; // Import Firestore
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAbGU-TaqzV_lww-OLhcFfTm94eWX-3CKY",
  authDomain: "runescapestepstracker.firebaseapp.com",
  projectId: "runescapestepstracker",
  storageBucket: "runescapestepstracker.appspot.com",
  messagingSenderId: "7947164454",
  appId: "1:7947164454:web:41063ad0d33acb6813ffe7",
  measurementId: "G-FDTCNKPDZM",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app); // Initialize Firestore

export { db }; // Export Firestore instance
