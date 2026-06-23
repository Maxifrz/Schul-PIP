import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDyrGAeQXBnSvRJ03yimmq1dpkWeWekikU",
  authDomain: "virtual-return-txfb9.firebaseapp.com",
  projectId: "virtual-return-txfb9",
  storageBucket: "virtual-return-txfb9.firebasestorage.app",
  messagingSenderId: "399018942123",
  appId: "1:399018942123:web:688c1749f39bbc41ab61ee",
  databaseId: "ai-studio-7315e381-7bb7-42b9-b0a0-b5c132c9be45"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
