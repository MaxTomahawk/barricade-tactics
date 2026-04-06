
import * as admin from 'firebase-admin';

// This is the server-side only Firebase admin initialization

if (!admin.apps.length) {
  try {
    // When running in a Google Cloud environment like Firebase Studio,
    // the SDK automatically discovers the service account credentials.
    // If that fails, we fall back to constructing the credential manually
    // from environment variables.
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.GCLOUD_PROJECT,
            clientEmail: process.env.GCLOUD_CLIENT_EMAIL,
            privateKey: process.env.GCLOUD_PRIVATE_KEY?.replace(/\n/g, '\n'),
        })
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const dbAdmin = admin.firestore();

export { dbAdmin };
