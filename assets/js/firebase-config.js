// ╔══════════════════════════════════════════════════════════════╗
// ║  FIREBASE CONFIGURATION — fill this in after creating your  ║
// ║  Firebase project at https://console.firebase.google.com    ║
// ╚══════════════════════════════════════════════════════════════╝
//
// SETUP STEPS:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (name it "smo-website" or similar)
// 3. In Project Settings > General > Your apps, add a Web app
// 4. Copy the firebaseConfig values below
// 5. In Authentication > Sign-in method, enable "Google"
// 6. In Firestore Database, create a database (start in production mode)
// 7. In Firestore > Rules, set read = public, write = only authenticated:
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /shows/{showId} {
//          allow read: if true;
//          allow write: if request.auth != null && request.auth.token.email == "SAM_GOOGLE_EMAIL@gmail.com";
//        }
//      }
//    }

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ⚠️  Replace this with Sam's actual Google account email
const ADMIN_EMAIL = "sam@gmail.com";

export { firebaseConfig, ADMIN_EMAIL };
