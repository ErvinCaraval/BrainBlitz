const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;
if (process.env.SERVICE_ACCOUNT_KEY_PATH) {
  // Kubernetes: lee desde archivo montado
  serviceAccount = require(path.resolve(process.env.SERVICE_ACCOUNT_KEY_PATH));
} else if (process.env.SERVICE_ACCOUNT_KEY) {
  // Cloud: lee desde variable de entorno
  serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
} else {
  // Local: lee desde archivo
  serviceAccount = require(path.resolve(__dirname, 'serviceAccountKey.json'));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };