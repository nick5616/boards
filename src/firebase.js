import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from "firebase/firestore";

// VITE_FIREBASE_EMULATORS=1 points Auth and Firestore at the local emulators (firebase.json ports),
// under the made-up project "demo-boards", so nothing can touch the real one. Off by default.
export const EMULATORS = import.meta.env.VITE_FIREBASE_EMULATORS === "1";

const firebaseConfig = {
  apiKey: "AIzaSyDDA0xyMPz47P4S1Rktl11shz5U8cBBoPw",
  authDomain: "my-boards-app-2026.firebaseapp.com",
  projectId: EMULATORS ? "demo-boards" : "my-boards-app-2026",
  storageBucket: "my-boards-app-2026.firebasestorage.app",
  messagingSenderId: "612498394086",
  appId: "1:612498394086:web:9858379321db413b08e427",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Local cache: instant loads, and logging works offline then syncs later
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
if (EMULATORS) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export const googleProvider = new GoogleAuthProvider();
