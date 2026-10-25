import { useState, useEffect } from "react";
import { getBlob } from "../lib/localMedia";

// An object URL for a file on this computer's shelf (null while loading, or if
// it's missing). Revoked when the id changes or the component goes away.
export function useLocalBlobUrl(id) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!id) return setUrl(null);
    let made = null;
    let gone = false;
    getBlob(id).then((blob) => {
      if (gone || !blob) return;
      made = URL.createObjectURL(blob);
      setUrl(made);
    });
    return () => {
      gone = true;
      if (made) URL.revokeObjectURL(made);
      setUrl(null);
    };
  }, [id]);
  return url;
}
