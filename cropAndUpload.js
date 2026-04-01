
import sharp from "sharp";
import { tmpdir } from "os";
import { file } from "tmp-promise";
import { v4 as uuidv4 } from "uuid";
import { getStorage } from "firebase-admin/storage";

/* bbox = {x_min, y_min, x_max, y_max} – all FRACTIONS 0-1   */
export default async function cropAndUpload(originalBuffer, bbox) {
  /* --- Get Firebase bucket (Firebase is already initialised in index.js) --- */
  const bucket = getStorage().bucket();
  const meta = await sharp(originalBuffer).metadata();
  const W = meta.width, H = meta.height;

  const left   = Math.round(bbox.x_min * W);
  const top    = Math.round(bbox.y_min * H);
  const width  = Math.round((bbox.x_max - bbox.x_min) * W);
  const height = Math.round((bbox.y_max - bbox.y_min) * H);

  /* 1️⃣ crop */
  const pngBuffer = await sharp(originalBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  /* 2️⃣ upload to Firebase Storage */
  const filename  = `crops/${uuidv4()}.png`;
  await bucket.file(filename).save(pngBuffer, { contentType: "image/png" });

  /* 3️⃣ signed URL valid for 1 year */
  const [url] = await bucket.file(filename).getSignedUrl({
    action:  "read",
    expires: Date.now() + 365 * 24 * 60 * 60 * 1000,
  });

  return url;
}
