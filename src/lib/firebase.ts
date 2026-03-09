import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const env = import.meta.env;

export const firebaseEnv = {
  apiKey: env.VITE_FIREBASE_API_KEY || env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain:
    env.VITE_FIREBASE_AUTH_DOMAIN || env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId:
    env.VITE_FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ||
    env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "",
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    "",
  appId: env.VITE_FIREBASE_APP_ID || env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId:
    env.VITE_FIREBASE_MEASUREMENT_ID ||
    env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    "G-NSYH31EWCC",
};

export const firebaseConfigReady = Object.values(firebaseEnv)
  .slice(0, 6)
  .every(Boolean);

const app = firebaseConfigReady ? initializeApp(firebaseEnv) : null;

let analytics;
if (app && typeof window !== "undefined" && firebaseEnv.measurementId) {
  analytics = getAnalytics(app);
}

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export { analytics };
