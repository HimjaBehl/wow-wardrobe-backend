import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  updateDoc, 
  doc 
} from "firebase/firestore";

// 🔑 Your Firebase config
const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🛠 Helper to title-case & clean
function formatLabel(str = "") {
  return str
    .toString()
    .split("/")                // handle taxonomy paths
    .pop()
    .replace(/_/g, " ")        // snake_case → spaces
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

async function migrateWardrobeAll() {
  const wardrobeRef = collection(db, "wardrobe");
  const snapshot = await getDocs(wardrobeRef);

  let updated = 0;

  for (const docSnap of snapshot.docs) {
    const item = docSnap.data();

    const newName = item.primaryTag || item.name || "Unnamed";
    const newCategory = formatLabel(item.category || "Misc");
    const newColor = formatLabel(item.color || "Unknown");
    const newTags = (item.tags || [])
      .map((t) => formatLabel(t))
      .filter((t, i, arr) => arr.indexOf(t) === i); // dedupe

    const updates = {
      old_name: item.name || null,  // backup
      name: newName,
      category: newCategory,
      color: newColor,
      tags: newTags,
    };

    await updateDoc(doc(db, "wardrobe", docSnap.id), updates);
    console.log(`✅ Updated ${docSnap.id}:`, updates);
    updated++;
  }

  console.log(`🎯 Migration complete. ${updated} items updated.`);
}

// Run migration
migrateWardrobeAll()
  .then(() => console.log("🚀 All users normalized!"))
  .catch((err) => console.error("❌ Migration failed:", err));
