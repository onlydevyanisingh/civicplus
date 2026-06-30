import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBW8bGLkShOaJXYX9Jmzx4r0vJn6i81DtU",
  authDomain: "gen-lang-client-0533034443.firebaseapp.com",
  projectId: "gen-lang-client-0533034443",
  storageBucket: "gen-lang-client-0533034443.firebasestorage.app",
  messagingSenderId: "706222183571",
  appId: "1:706222183571:web:8ceb9cf6876648c7f12966"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-civic-0d8f27e2-a0bb-46ab-9962-4b1db158b1dd");
export const googleProvider = new GoogleAuthProvider();

// Custom parameters to force account selection
googleProvider.setCustomParameters({
  prompt: "select_account"
});

// Helper to test connection (mandatory per Skill guidelines)
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. Client is offline.");
    }
  }
}

testConnection();

export { signInWithPopup, signOut, onAuthStateChanged };
export type { FirebaseUser };
