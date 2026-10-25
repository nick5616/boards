import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { DEMO } from "../lib/demo";
import { DEMO_USER } from "../lib/demoSeed";

function useFirebaseAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const signIn = () => signInWithPopup(auth, googleProvider);
  const signOut_ = () => signOut(auth);

  return { user, signIn, signOut: signOut_ };
}

// The demo is always "signed in" as its made-up person; signing out leaves it
const demoAuth = { user: DEMO_USER, signIn: () => {}, signOut: () => window.location.assign("/") };
const useDemoAuth = () => demoAuth;

export const useAuth = DEMO ? useDemoAuth : useFirebaseAuth;
