import { useState, useEffect } from "react";
import { mediaUrl } from "../lib/cloudMedia";

// A signed URL for a file in the board host's Cloud Storage (null while loading, or if it's
// missing or not mine to see). Good for at least ten minutes; ask again on a media error.
export function useMediaUrl(boardId, id) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!boardId || !id) return setUrl(null);
    let gone = false;
    mediaUrl(boardId, id).then((u) => !gone && setUrl(u));
    return () => {
      gone = true;
      setUrl(null);
    };
  }, [boardId, id]);
  return url;
}
