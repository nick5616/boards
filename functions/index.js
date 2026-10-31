// Cloud Functions for boards. Deploy with `firebase deploy --only functions` (needs Blaze).
//   media        one callable for files in Cloud Storage: { op: "read" | "upload" | "remove", space, ... }
//   mediaPurge   when a space is deleted, its files go too
// Both run as boards-media@, which can only sign for and manage objects in the media bucket
// and read Firestore. See media.js for the layout and who may do what.

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { read, upload, remove, purge, Refused } from "./media.js";

initializeApp();
const db = getFirestore();
const project = process.env.GCLOUD_PROJECT;
const bucket = () => getStorage().bucket(process.env.MEDIA_BUCKET || `${project}-media`);

const common = {
  region: "us-central1", // next to Firestore (nam5) and the bucket
  serviceAccount: `boards-media@${project}.iam.gserviceaccount.com`,
};

const OPS = { read, upload, remove };

export const media = onCall(
  {
    ...common,
    // Where the app is served from, plus local dev
    cors: [/^https:\/\/boards\.saucedog\.art$/, /^https:\/\/([\w-]+--)?birdboards\.netlify\.app$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/],
    memory: "256MiB",
    maxInstances: 20,
  },
  async (req) => {
    const op = OPS[req.data?.op];
    if (!op) throw new HttpsError("invalid-argument", "unknown op");
    try {
      return await op(db, bucket(), req.auth, req.data);
    } catch (e) {
      if (e instanceof Refused) throw new HttpsError(e.code, e.message);
      logger.error("media", req.data?.op, e);
      throw new HttpsError("internal", "couldn't reach the files");
    }
  }
);

export const mediaPurge = onDocumentDeleted({ ...common, document: "spaces/{sid}" }, async (event) => {
  const n = await purge(bucket(), event.params.sid, event.data?.data());
  if (n) logger.info("purged", event.params.sid, n);
});
