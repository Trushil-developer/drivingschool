import admin from "firebase-admin";
import fs from "fs";
import dotenv from "dotenv";
import { dbPool } from "../../server.js";

dotenv.config();

let app = null;

function getFirebaseApp() {
  if (app) return app;
  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH is not set or the file doesn't exist — push notifications are not configured yet."
    );
  }
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return app;
}

// Sends a push to every device registered for this person (an instructor or a
// student), and prunes any token Firebase reports as no longer registered
// (uninstalled app, expired token, etc.) so the table doesn't grow stale.
export async function sendPushToPerson(personType, personId, { title, body, data = {} }) {
  const [tokens] = await dbPool.query(
    `SELECT id, token FROM device_push_tokens WHERE person_type = ? AND person_id = ?`,
    [personType, personId]
  );
  if (!tokens.length) return { sent: 0, pruned: 0 };

  const fcm = admin.messaging(getFirebaseApp());

  const response = await fcm.sendEachForMulticast({
    tokens: tokens.map(t => t.token),
    notification: { title, body },
    data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
  });

  const staleIds = [];
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === "messaging/registration-token-not-registered") {
      staleIds.push(tokens[i].id);
    }
  });
  if (staleIds.length) {
    await dbPool.query(`DELETE FROM device_push_tokens WHERE id IN (?)`, [staleIds]);
  }

  return { sent: response.successCount, pruned: staleIds.length };
}
