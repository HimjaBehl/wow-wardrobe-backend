
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";
const serviceAccount = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));

let app;
if (!getApps().length) {
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: "wowapp1406",
    storageBucket: "wowapp1406.firebasestorage.app",   
  });
} else {
  app = getApp();
}

const db = getFirestore(app);
const storage = getStorage(app);

export {
  db,
  storage,
};
