const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const CSV_PATH = path.join(process.cwd(), "data", "staples_male_v2_urls.csv"); // <-- your generated csv
const COLLECTION = "staples_male_v2";

function initAdmin() {
  if (!admin.apps.length) {
    const serviceAccount = require("../serviceAccountKey.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

// simple CSV parser (works because our fields have no commas except urls which are quoted properly)
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(",").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // handle quoted fields
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (ch === '"' && line[j + 1] === '"') {
        current += '"';
        j++;
      } else if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current);

    const obj = {};
    header.forEach((h, idx) => (obj[h] = (values[idx] ?? "").trim()));
    rows.push(obj);
  }

  return rows;
}

async function run() {
  const db = initAdmin();

  const csvText = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(csvText);

  console.log(`Found ${rows.length} rows in CSV`);

  const batchSize = 400; // firestore batch limit is 500
  let batch = db.batch();
  let ops = 0;
  let total = 0;

  for (const r of rows) {
    const name = r.name;
    const docId = name
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[()]/g, "")
      .replace(/[^a-z0-9_]/g, "");

    const tags = (r.tags || "")
      .split("|")
      .map((t) => t.trim())
      .filter(Boolean);

    const docRef = db.collection(COLLECTION).doc(docId);

    batch.set(docRef, {
      id: docId,
      name: r.name,
      category: r.category,
      color: r.color,
      tags,
      gender: r.gender || "male",
      version: r.version || "v2",
      image_url: r.image_url,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    ops++;
    total++;

    if (ops >= batchSize) {
      await batch.commit();
      console.log(`✅ committed batch (${total} so far)`);
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
    console.log(`✅ committed final batch. Total: ${total}`);
  }

  console.log("DONE ✅ Firestore populated:", COLLECTION);
}

run().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
