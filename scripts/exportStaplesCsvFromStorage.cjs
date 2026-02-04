const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const FOLDER = "staples_male_v2/";
const OUTPUT = path.join(process.cwd(), "data", "staples_male_v2_urls.csv");
const VERSION = "v2";
const GENDER = "male";

// init firebase admin
if (!admin.apps.length) {
  const serviceAccount = require("../serviceAccountKey.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "wowapp1406.firebasestorage.app",

  });

}

const bucket = admin.storage().bucket();

function stripExt(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

function inferCategory(name) {
  const n = name.toLowerCase();

  if (n.includes("shoes") || n.includes("sneakers") || n.includes("loafers") || n.includes("slip")) return "shoes";
  if (n.includes("belt") || n.includes("watch") || n.includes("sunglasses") || n.includes("backpack") || n.includes("socks")) return "accessory";
  if (n.includes("jeans") || n.includes("chinos") || n.includes("joggers") || n.includes("trousers") || n.includes("shorts")) return "bottom";
  if (n.includes("blazer") || n.includes("jacket") || n.includes("bomber") || n.includes("overshirt")) return "outerwear";
  if (n.includes("t-shirt") || n.includes("shirt") || n.includes("hoodie") || n.includes("sweater") || n.includes("polo")) return "top";

  return "other";
}

function inferColor(name) {
  const first = name.split(" ")[0].toLowerCase();
  const map = {
    black: "black",
    white: "white",
    grey: "grey",
    gray: "grey",
    navy: "navy",
    blue: "blue",
    beige: "beige",
    brown: "brown",
    olive: "olive",
    neutral: "neutral",
  };
  if (first === "light") return "light-blue";
  return map[first] || "neutral";
}

function inferTags(name, category) {
  const n = name.toLowerCase();
  const tags = new Set();

  if (n.includes("formal")) tags.add("formal");
  if (n.includes("casual")) tags.add("casual");
  if (n.includes("linen") || n.includes("shorts")) tags.add("summer");
  if (n.includes("hoodie") || n.includes("joggers")) tags.add("comfort");
  if (n.includes("crewneck")) tags.add("basic");
  if (n.includes("checked")) tags.add("smart-casual");
  if (n.includes("jacket") || n.includes("overshirt")) tags.add("layering");

  if (category === "shoes") tags.add("everyday");
  if (category === "accessory") tags.add("classic");

  return Array.from(tags).join("|");
}

function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function run() {
  const [files] = await bucket.getFiles({ prefix: FOLDER });

  const images = files
    .map((f) => f.name)
    .filter((n) => !n.endsWith("/"))
    .filter((n) => /\.(png|jpg|jpeg|webp)$/i.test(n));

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

  fs.writeFileSync(
    OUTPUT,
    "name,category,color,tags,gender,image_url,version\n"
  );

  console.log(`Found ${images.length} images`);

  for (let i = 0; i < images.length; i++) {
    const fullPath = images[i];
    const fileName = fullPath.replace(FOLDER, "");
    const name = stripExt(fileName);

    const category = inferCategory(name);
    const color = inferColor(name);
    const tags = inferTags(name, category);

    const file = bucket.file(fullPath);
    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "2036-01-01",
    });

    const row = [
      name,
      category,
      color,
      tags,
      GENDER,
      url,
      VERSION,
    ].map(csvEscape).join(",") + "\n";

    fs.appendFileSync(OUTPUT, row);
    console.log(`✅ ${i + 1}: ${name}`);
  }

  console.log("\nCSV GENERATED →", OUTPUT);
}

run().catch(console.error);
