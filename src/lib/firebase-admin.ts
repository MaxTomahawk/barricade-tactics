import * as admin from 'firebase-admin';

// This is the server-side only Firebase admin initialization
if (!admin.apps.length) {
  try {
    // Use application default credentials. This is the recommended way to initialize
    // in Google Cloud environments like Firebase Studio.
    console.log("Initializing Firebase Admin with application default credentials...");
    admin.initializeApp();
    console.log("Firebase Admin initialized successfully.");
  } catch (error) {
    // If initialization fails, log the error and re-throw it to stop the server from starting.
    // A server that cannot connect to its database should not be running.
    console.error('CRITICAL: Firebase admin initialization failed', error);
    throw new Error('CRITICAL: Firebase admin initialization failed. The application cannot start.');
  }
}

const dbAdmin = admin.firestore();

export { dbAdmin };
