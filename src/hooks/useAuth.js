import { useState, useEffect } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

export function useAuth() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const signIn = () => signInWithPopup(auth, googleProvider);
  const signOut_ = () => signOut(auth);

  return { user, signIn, signOut: signOut_ };
}
