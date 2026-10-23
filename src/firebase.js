import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDDA0xyMPz47P4S1Rktl11shz5U8cBBoPw",
  authDomain: "my-boards-app-2026.firebaseapp.com",
  projectId: "my-boards-app-2026",
  storageBucket: "my-boards-app-2026.firebasestorage.app",
  messagingSenderId: "612498394086",
  appId: "1:612498394086:web:9858379321db413b08e427",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Local cache: instant loads, and logging works offline then syncs later
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
export const googleProvider = new GoogleAuthProvider();
