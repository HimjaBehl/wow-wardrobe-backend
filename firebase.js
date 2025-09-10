
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
    storageBucket: "wowapp1406.appspot.com",   
  });
  console.log("✅ Firebase app initialized with storage bucket: wowapp1406.appspot.com");
} else {
  app = getApp();
  console.log("✅ Using existing Firebase app instance");
}

const db = getFirestore(app);
const storage = getStorage(app);

// Verify bucket access
try {
  const bucket = storage.bucket();
  console.log("✅ Storage bucket initialized:", bucket.name);
} catch (error) {
  console.error("❌ Storage bucket initialization failed:", error.message);
}

export {
  db,
  storage,
};
