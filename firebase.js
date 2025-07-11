const { initializeApp, cert, getApps, getApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const serviceAccount = require("./serviceAccountKey.json");

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

module.exports = {
  db,
  storage,
};
