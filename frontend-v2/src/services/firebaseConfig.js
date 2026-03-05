// Firebase configuration with fallback to mock
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDnCIzqQLr7VA3K07EyHr7HSikqKEv-aXA",
  authDomain: "preguntas-ac738.firebaseapp.com",
  projectId: "preguntas-ac738",
  storageBucket: "preguntas-ac738.firebasestorage.app",
  messagingSenderId: "676890183785",
  appId: "1:676890183785:web:13f915fafb3d9d776e3af8",
  measurementId: "G-97D4SHDWX0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Usar siempre Firebase real
const auth = getAuth(app);
const db = getFirestore(app);
export { auth, db };

