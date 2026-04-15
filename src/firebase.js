import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAr4ol3T4TcbwYIf27jK63PAJLgVHODf1o",
  authDomain: "acl-rehab-tracker-514c9.firebaseapp.com",
  projectId: "acl-rehab-tracker-514c9",
  storageBucket: "acl-rehab-tracker-514c9.firebasestorage.app",
  messagingSenderId: "1014445074557",
  appId: "1:1014445074557:web:d6dd51c0437b6b3574e914",
  measurementId: "G-1TN6603LKJ"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);