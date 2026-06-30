import React, { useEffect, useState, ChangeEvent, useRef } from "react";
import HomeTab from "./components/HomeTab";
import ReportTab from "./components/ReportTab";
import MapTab from "./components/MapTab";
import TrackTab from "./components/TrackTab";
import ImpactTab from "./components/ImpactTab";
import CommunityTab from "./components/CommunityTab";
import { SEED_ISSUES } from "./seeds";
import { CivicIssue, UserState, CivicNotification } from "./types";
import { 
  PlusCircle, Map as MapIcon, List, Trophy, BarChart3, Home, Users, Sparkles, LogOut, Award, Flame, UserCircle, Search, Edit2, MoreVertical, PhoneCall, Info, X, Upload, Camera, Globe, Lock, Check, ShieldCheck, Zap, Bell
} from "lucide-react";
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const BADGES_MAP: Record<string, { name: string; icon: any; color: string; desc: string }> = {
  "Community Helper": {
    name: "Community Helper",
    icon: Users,
    color: "from-blue-400 to-indigo-500",
    desc: "Unlocked by verifying at least 5 local complaints."
  },
  "Civic Hero": {
    name: "Civic Hero",
    icon: ShieldCheck,
    color: "from-amber-400 to-orange-500",
    desc: "Granted for filing 5+ high-priority issues."
  },
  "Change Maker": {
    name: "Change Maker",
    icon: Zap,
    color: "from-emerald-400 to-teal-500",
    desc: "Awarded when 5+ reported issues by you get inspection started."
  },
  "Eco Guardian": {
    name: "Eco Guardian",
    icon: Flame,
    color: "from-rose-400 to-pink-500",
    desc: "Awarded when 5+ reported issues by you get completely resolved."
  }
};

function computeUnlockedBadges(user: UserState, issuesList: CivicIssue[]) {
  const userIssues = issuesList.filter(i => i.id.startsWith("issue-custom-"));
  const resolvedUserIssues = userIssues.filter(i => i.status === "resolved").length;
  const underInspectionCount = userIssues.filter(i => i.status === "in-progress" || i.status === "resolved").length;
  const highPriorityCount = userIssues.filter(i => (i.severity === "High" || i.severity === "Critical" || i.urgency === "High" || i.urgency === "Critical")).length;

  const list = ["Community Helper"]; // default
  if (highPriorityCount >= 5) {
    list.push("Civic Hero");
  }
  if (underInspectionCount >= 5) {
    list.push("Change Maker");
  }
  if (resolvedUserIssues >= 5) {
    list.push("Eco Guardian");
  }
  return list;
}

function extractNameFromEmail(email: string): string {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length === 0) return "";
  const localPart = parts[0];
  // Replace numbers, dots, dashes, underscores with space
  const nameParts = localPart.replace(/[0-9._-]/g, " ").trim();
  // Capitalize each part
  return nameParts
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .trim();
}

function isResolvedOver72Hours(issue: CivicIssue): boolean {
  if (issue.status !== "resolved") return false;
  const resolvedEvent = issue.timeline?.find(e => e.status === "resolved");
  let resolvedTime: number | null = null;
  if (resolvedEvent) {
    resolvedTime = Date.parse(resolvedEvent.date);
  }
  if (!resolvedTime || isNaN(resolvedTime)) {
    resolvedTime = Date.parse(issue.createdAt);
  }
  if (!resolvedTime || isNaN(resolvedTime)) {
    return false;
  }
  const now = new Date().getTime();
  const diffHours = (now - resolvedTime) / (1000 * 60 * 60);
  return diffHours >= 72;
}

export default function App() {
  // Navigation active tab State
  const [activeTab, setActiveTab] = useState<string>("Home");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // Issues State (synced with localStorage)
  const [issues, setIssues] = useState<CivicIssue[]>([]);

  // Verification PIN Authentication State
  const [verifyingIssueId, setVerifyingIssueId] = useState<string | null>(null);
  const [verificationPin, setVerificationPin] = useState<string>("");
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifyingAuth, setIsVerifyingAuth] = useState<boolean>(false);

  // Gamified User profile State (synced with localStorage)
  const [userProfile, setUserProfile] = useState<UserState>({
    email: "sunflowerr.flowerr25@gmail.com",
    name: "Sunflower Civic",
    points: 150,
    streak: 1,
    badges: ["Community Helper"],
    reportedCount: 0,
    verifiedCount: 1,
    age: 24,
    aadharId: "583920194821",
    city: "Varanasi",
    country: "India",
    profilePic: "",
  });

  // Mandated Authentication and DigiLocker/Google Sync states
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("civic_pulse_logged_in") === "true";
  });
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const [registeredUsers, setRegisteredUsers] = useState<any[]>(() => {
    const saved = localStorage.getItem("civic_pulse_registered_users");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use default seed
      }
    }
    const defaultList = [
      {
        email: "sunflowerr.flowerr25@gmail.com",
        name: "Sunflower Civic",
        age: 24,
        aadharId: "583920194821",
        city: "Varanasi",
        country: "India"
      },
      {
        email: "citizen.one@gmail.com",
        name: "Aarav Sharma",
        age: 32,
        aadharId: "123456789012",
        city: "Delhi",
        country: "India"
      }
    ];
    localStorage.setItem("civic_pulse_registered_users", JSON.stringify(defaultList));
    return defaultList;
  });

  const [loginEmail, setLoginEmail] = useState("");
  const [loginName, setLoginName] = useState("");
  const [loginAge, setLoginAge] = useState("");
  const [loginAadhar, setLoginAadhar] = useState("");
  const [loginCity, setLoginCity] = useState("Varanasi");
  const [loginCountry, setLoginCountry] = useState("India");
  
  const [digiLockerAccepted, setDigiLockerAccepted] = useState(false);
  const [digiLockerSyncing, setDigiLockerSyncing] = useState(false);
  const [digiLockerModalOpen, setDigiLockerModalOpen] = useState(false);
  const [digiLockerPin, setDigiLockerPin] = useState("");
  const [digiLockerError, setDigiLockerError] = useState("");

  const [googleEmailPickerOpen, setGoogleEmailPickerOpen] = useState(false);
  const [registrationErrors, setRegistrationErrors] = useState<{ [key: string]: string }>({});

  // Search and name editing states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");

  // Dropdown & Modal states
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGoogleAuthModal, setShowGoogleAuthModal] = useState(false);

  // Profile modal edit states
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState<string | number>("");
  const [editAadhar, setEditAadhar] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editProfilePic, setEditProfilePic] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [profileErrors, setProfileErrors] = useState<{ [key: string]: string }>({});

  // Simulated Google Auth modal states
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [googleAuthSuccess, setGoogleAuthSuccess] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [googleEmailError, setGoogleEmailError] = useState("");

  // Real-time Badge Unlock notification states
  const [hasMounted, setHasMounted] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<any>(null);

  // Civic notifications state
  const [notifications, setNotifications] = useState<CivicNotification[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const prevIssuesRef = useRef<CivicIssue[]>([]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        // Logged in with Firebase
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserState;
            setUserProfile(data);
            localStorage.setItem("civic_pulse_user_profile", JSON.stringify(data));
            localStorage.setItem("civic_pulse_logged_in", "true");
            setIsLoggedIn(true);
          } else {
            // Sign-in successful but profile registration details not complete yet
            setLoginEmail(user.email || "");
            const extracted = extractNameFromEmail(user.email || "");
            setLoginName(extracted || user.displayName || "");
            setUserProfile(prev => ({
              ...prev,
              email: user.email || prev.email,
              name: extracted || user.displayName || prev.name,
              profilePic: user.photoURL || ""
            }));
            setIsLoggedIn(false);
          }
        } catch (err) {
          console.error("Error fetching user document:", err);
          // Fallback to local storage profile if offline or error
          const savedProfile = localStorage.getItem("civic_pulse_user_profile");
          if (savedProfile) {
            try {
              setUserProfile(JSON.parse(savedProfile));
            } catch (e) {}
          }
        }
      } else {
        // Signed out
        localStorage.removeItem("civic_pulse_logged_in");
        setIsLoggedIn(false);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isIssueInCity = (issue: CivicIssue, city: string): boolean => {
    const c = city.toLowerCase();
    const loc = (issue.locality || "").toLowerCase();
    const title = (issue.title || "").toLowerCase();
    const desc = (issue.description || "").toLowerCase();

    if (loc.includes(c) || title.includes(c) || desc.includes(c)) return true;

    if (c.includes("varanasi") || c === "vns") {
      const varanasiLocalities = ["lanka", "assi", "bhu", "nagwa", "godowlia", "sigra", "kashi", "sankat mochan"];
      return varanasiLocalities.some(vl => loc.includes(vl));
    }
    if (c.includes("delhi")) {
      const delhiLocalities = ["chanakyapuri", "connaught", "vasant kunj", "karol bagh", "dwarka", "delhi"];
      return delhiLocalities.some(dl => loc.includes(dl));
    }
    if (c.includes("bengaluru") || c.includes("bangalore")) {
      const blrLocalities = ["indiranagar", "koramangala", "jayanagar", "malleshwaram", "whitefield", "bengaluru"];
      return blrLocalities.some(bl => loc.includes(bl));
    }
    if (c.includes("francisco") || c.includes("sf")) {
      const sfLocalities = ["mission", "soma", "presidio", "haight-ashbury", "castro", "francisco"];
      return sfLocalities.some(sl => loc.includes(sl));
    }

    return false;
  };

  const saveNotifications = (newNotifications: CivicNotification[]) => {
    setNotifications(newNotifications);
    localStorage.setItem("civic_pulse_notifications", JSON.stringify(newNotifications));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, isRead: true }));
    saveNotifications(updated);
  };

  const handleMarkAsRead = (id: string) => {
    const updated = notifications.map((n) => {
      if (n.id === id) {
        return { ...n, isRead: true };
      }
      return n;
    });
    saveNotifications(updated);
  };

  const handleClearNotifications = () => {
    saveNotifications([]);
  };

  // Dynamic live location, city, and ward states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>({
    lat: 25.2820,
    lng: 83.0080,
  });
  const [cityName, setCityName] = useState<string>("Varanasi");
  const [currentWard, setCurrentWard] = useState<string>("Lanka Ward");

  const getCityAndWardFromCoords = async (lat: number, lng: number) => {
    // 1. Check if we are close to Varanasi coordinates
    const isVaranasi = Math.abs(lat - 25.2820) < 0.15 && Math.abs(lng - 83.0080) < 0.15;
    if (isVaranasi) {
      setCityName("Varanasi");
      if (lat > 25.285) {
        setCurrentWard("Assi Ward");
      } else if (lat < 25.276) {
        setCurrentWard("Nagwa Ward");
      } else {
        setCurrentWard("Lanka Ward");
      }
      return;
    }

    // 2. If outside, use OpenStreetMap reverse geocoding (Nominatim API)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: {
          "Accept-Language": "en",
          "User-Agent": "CivicPlusApplet"
        }
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.municipality || addr.village || addr.suburb || "Local City";
        const wardName = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || addr.city_district || "Local Ward";
        
        setCityName(city);
        let formattedWard = wardName;
        if (!formattedWard.toLowerCase().includes("ward") && !formattedWard.toLowerCase().includes("district")) {
          formattedWard = `${formattedWard} Ward`;
        }
        setCurrentWard(formattedWard);
      }
    } catch (e) {
      console.warn("Global reverse geocoding failed, using local coords fallback:", e);
      setCityName("Varanasi");
      setCurrentWard("Lanka Ward");
    }
  };

  const handleLocationUpdate = (lat: number, lng: number, city?: string, ward?: string) => {
    setUserLocation({ lat, lng });
    if (city && ward) {
      setCityName(city);
      setCurrentWard(ward);
    } else {
      getCityAndWardFromCoords(lat, lng);
    }
  };

  // Get live GPS location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          handleLocationUpdate(lat, lng);
        },
        (error) => {
          console.warn("GPS lookup denied or failed, using Varanasi default:", error);
          handleLocationUpdate(25.2820, 83.0080);
        }
      );
    } else {
      handleLocationUpdate(25.2820, 83.0080);
    }
  }, []);

  // Relocate seed issues to be within 30km of the user's current live location and update landmark names
  useEffect(() => {
    if (issues.length === 0) return;
    const { lat, lng } = userLocation;
    if (!lat || !lng) return;

    const offsets: { [key: string]: { lat: number; lng: number } } = {
      "issue-1": { lat: -0.0022, lng: -0.0068 },
      "issue-2": { lat: 0.0065, lng: 0.0038 },
      "issue-3": { lat: -0.0072, lng: -0.0025 },
      "issue-4": { lat: 0.0100, lng: 0.0000 },
      "issue-5": { lat: 0.0300, lng: -0.0140 },
      "issue-6": { lat: -0.0002, lng: -0.0078 },
      "issue-7": { lat: -0.0045, lng: 0.0055 },
      "issue-8": { lat: 0.0025, lng: -0.0110 },
    };

    let changed = false;
    const updated = issues.map(issue => {
      const offset = offsets[issue.id];
      if (offset) {
        const targetLat = lat + offset.lat;
        const targetLng = lng + offset.lng;
        
        // Adapt the issue titles/localities dynamically to the current ward and city
        const cleanWard = (currentWard || "Central").replace(/\s+ward/i, "").trim();
        const isVaranasi = (cityName || "Varanasi").toLowerCase().includes("varanasi") || 
                           (cityName || "Varanasi").toLowerCase().includes("banaras") ||
                           (cityName || "Varanasi").toLowerCase().includes("vns");

        let adaptedIssue = { ...issue };

        // Ensure coordinates are synced
        if (Math.abs(issue.lat - targetLat) > 0.0001 || Math.abs(issue.lng - targetLng) > 0.0001) {
          adaptedIssue.lat = targetLat;
          adaptedIssue.lng = targetLng;
          changed = true;
        }

        if (!isVaranasi) {
          const localityMap: { [key: string]: string } = {
            "issue-1": `${cleanWard} Market`,
            "issue-2": `${cleanWard} Crossing`,
            "issue-3": `${cleanWard} Outer Road`,
            "issue-4": `${cleanWard} Main Street`,
            "issue-5": `${cleanWard} Avenue`,
            "issue-6": `${cleanWard} Bypass`,
            "issue-7": `${cleanWard} Walkway`,
            "issue-8": `${cleanWard} Junction`,
          };

          const newLocality = localityMap[issue.id] || `${cleanWard} Area`;
          
          if (issue.locality !== newLocality) {
            adaptedIssue.locality = newLocality;
            changed = true;
          }

          let newTitle = issue.title;
          let newDesc = issue.description;

          if (issue.id === "issue-1") {
            newTitle = `Garbage Pile near ${cleanWard} Market`;
            newDesc = issue.description.replace(/Lanka Market/g, `${cleanWard} Market`);
          } else if (issue.id === "issue-2") {
            newTitle = `Deep Potholes at ${cleanWard} Crossing`;
            newDesc = issue.description.replace(/Assi Crossing/g, `${cleanWard} Crossing`);
          } else if (issue.id === "issue-3") {
            newTitle = `Dark Footpath near ${cleanWard} Outer Road`;
            newDesc = issue.description.replace(/BHU/g, `${cleanWard} Campus`).replace(/streetlights are broken on the outer wall road/g, `streetlights are broken on the outer road`);
          } else if (issue.id === "issue-4") {
            newTitle = `Major Water Pipeline Burst at ${cleanWard} Main Street`;
            newDesc = issue.description.replace(/Godowlia/g, `${cleanWard} Main Street`);
          } else if (issue.id === "issue-5") {
            newTitle = `Unfinished Footpath & Concrete Blocks near ${cleanWard} Avenue`;
            newDesc = issue.description.replace(/Sigra/g, `${cleanWard} Avenue`);
          } else if (issue.id === "issue-6") {
            newTitle = `Abandonment of Stray Cattle on ${cleanWard} Bypass`;
            newDesc = issue.description.replace(/Sankat Mochan Road/g, `${cleanWard} Bypass`);
          } else if (issue.id === "issue-7") {
            newTitle = `Clogged Drainage System near ${cleanWard} Walkway`;
            newDesc = issue.description.replace(/Assi Ghat/g, `${cleanWard} Walkway`).replace(/Assi Ward/g, `${cleanWard} Ward`);
          } else if (issue.id === "issue-8") {
            newTitle = `Pedestrian Crossing Lights Broken at ${cleanWard} Junction`;
            newDesc = issue.description.replace(/Sigra Chauraha/g, `${cleanWard} Junction`).replace(/Sigra Crossroad/g, `${cleanWard} Junction`);
          }

          if (issue.title !== newTitle) {
            adaptedIssue.title = newTitle;
            changed = true;
          }
          if (issue.description !== newDesc) {
            adaptedIssue.description = newDesc;
            changed = true;
          }
        }

        return adaptedIssue;
      }
      return issue;
    });

    if (changed) {
      setIssues(updated);
      localStorage.setItem("civic_pulse_issues", JSON.stringify(updated));
    }
  }, [userLocation.lat, userLocation.lng, currentWard, cityName, issues.length]);

  // Sync live location city to login form city automatically and also update the logged-in citizen profile city
  const userProfileCity = userProfile?.city;
  useEffect(() => {
    if (cityName && cityName !== "Local City") {
      setLoginCity(cityName);
      
      if (isLoggedIn && userProfileCity !== cityName) {
        setUserProfile(prev => {
          const updated = {
            ...prev,
            city: cityName
          };
          localStorage.setItem("civic_pulse_user_profile", JSON.stringify(updated));
          if (auth.currentUser) {
            setDoc(doc(db, "users", auth.currentUser.uid), updated, { merge: true })
              .catch(err => console.error("Failed to sync profile to Firestore:", err));
          }
          return updated;
        });
      }
    }
  }, [cityName, isLoggedIn, userProfileCity]);

  const handleSaveName = () => {
    setIsEditingName(false);
    const trimmed = tempName.trim();
    if (trimmed) {
      const updated = {
        ...userProfile,
        name: trimmed,
      };
      saveProfile(updated);
    }
  };

  const filteredIssues = issues.filter(issue => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().replace("#", "").trim();
    if (!q) return true;
    return (
      issue.title.toLowerCase().includes(q) ||
      issue.description.toLowerCase().includes(q) ||
      issue.category.toLowerCase().includes(q) ||
      (issue.locality && issue.locality.toLowerCase().includes(q)) ||
      issue.status.toLowerCase().includes(q)
    );
  });

  // Load from LocalStorage on mount
  useEffect(() => {
    // Clear and disable any dark mode leftovers
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("civic_pulse_dark_mode");

    const savedIssues = localStorage.getItem("civic_pulse_issues");
    if (savedIssues) {
      try {
        const parsed = JSON.parse(savedIssues) as CivicIssue[];
        // Merge missing default seed issues
        const seedMap = new Map(SEED_ISSUES.map(i => [i.id, i]));
        const parsedMap = new Map(parsed.map(i => [i.id, i]));
        
        for (const [id, seedIssue] of seedMap.entries()) {
          if (!parsedMap.has(id)) {
            parsedMap.set(id, seedIssue);
          }
        }
        
        const merged = Array.from(parsedMap.values());
        const migrated = merged.map(issue => {
          if (issue.id === "issue-6") {
            return {
              ...issue,
              title: "Abandonment of Stray Cattle on Sankat Mochan Road",
              description: "Abandonment of cattle on the narrow approach road of Sankat Mochan causes traffic choke points and safety risks during busy hours.",
              locality: "Sankat Mochan Road, Assi Ward",
              lat: 25.2818,
              lng: 83.0002,
            };
          }
          return issue;
        });
        setIssues(migrated);
        localStorage.setItem("civic_pulse_issues", JSON.stringify(migrated));
      } catch (e) {
        setIssues(SEED_ISSUES);
      }
    } else {
      setIssues(SEED_ISSUES);
      localStorage.setItem("civic_pulse_issues", JSON.stringify(SEED_ISSUES));
    }

    const savedProfile = localStorage.getItem("civic_pulse_user_profile");
    let currentProfile = {
      email: "sunflowerr.flowerr25@gmail.com",
      name: "Sunflower Civic",
      points: 150,
      streak: 1,
      badges: ["Community Helper"],
      reportedCount: 0,
      verifiedCount: 1,
      age: 24,
      aadharId: "583920194821",
      city: "Varanasi",
      country: "India",
      profilePic: "",
    };

    if (savedProfile) {
      try {
        currentProfile = JSON.parse(savedProfile);
      } catch (e) {
        // use default
      }
    }

    // Real-time Daily Active Streak Tracking Logic using real local time and date
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();
    const todayLocal = new Date(todayYear, todayMonth, todayDate);
    const todayStr = `${todayYear}-${String(todayMonth + 1).padStart(2, '0')}-${String(todayDate).padStart(2, '0')}`;

    const lastOpenStr = localStorage.getItem("civic_pulse_last_open_date");
    let updatedStreak = currentProfile.streak;
    let initialStreakReset = false;

    if (!lastOpenStr) {
      // First time opening the app, start streak at 1
      localStorage.setItem("civic_pulse_last_open_date", todayStr);
      updatedStreak = 1;
    } else {
      try {
        const [lastYear, lastMonth, lastDay] = lastOpenStr.split("-").map(Number);
        const lastLocal = new Date(lastYear, lastMonth - 1, lastDay);
        const msDiff = todayLocal.getTime() - lastLocal.getTime();
        const daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));

        if (daysDiff === 1) {
          // Consecutive calendar day open: renew and increment streak
          updatedStreak = currentProfile.streak + 1;
          localStorage.setItem("civic_pulse_last_open_date", todayStr);
        } else if (daysDiff > 1) {
          // Missed one or more days: reset streak to 0
          updatedStreak = 0;
          localStorage.setItem("civic_pulse_last_open_date", todayStr);
          initialStreakReset = true;
        } else if (daysDiff === 0) {
          // Same calendar day, streak remains unchanged
        } else {
          // Time traveler or anomaly, reset to 1
          updatedStreak = 1;
          localStorage.setItem("civic_pulse_last_open_date", todayStr);
        }
      } catch (e) {
        localStorage.setItem("civic_pulse_last_open_date", todayStr);
        updatedStreak = 1;
      }
    }

    const finalProfile = {
      ...currentProfile,
      streak: updatedStreak
    };
    setUserProfile(finalProfile);
    localStorage.setItem("civic_pulse_user_profile", JSON.stringify(finalProfile));

    const savedNotifications = localStorage.getItem("civic_pulse_notifications");
    let initialNotifications: CivicNotification[] = [];
    if (savedNotifications) {
      try {
        initialNotifications = JSON.parse(savedNotifications);
      } catch (e) {
        // use default
      }
    }

    if (initialStreakReset) {
      const isAlreadyNotified = initialNotifications.some((n: any) => n.title === "🔥 Streak Reset" && n.message.includes("reset to 0 days"));
      if (!isAlreadyNotified) {
        const streakNotif: CivicNotification = {
          id: `streak-reset-${Date.now()}`,
          title: "🔥 Streak Reset",
          message: `Your active streak has reset to 0 days because the app was not opened yesterday. Check in today to rebuild your streak!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - Today",
          isRead: false,
          type: "resolved"
        };
        initialNotifications = [streakNotif, ...initialNotifications];
        localStorage.setItem("civic_pulse_notifications", JSON.stringify(initialNotifications));
      }
    }
    setNotifications(initialNotifications);
  }, []);

  // Save to LocalStorage helper
  const saveIssues = (updatedIssues: CivicIssue[]) => {
    setIssues(updatedIssues);
    localStorage.setItem("civic_pulse_issues", JSON.stringify(updatedIssues));
  };

  const saveProfile = async (updatedProfile: UserState) => {
    setUserProfile(updatedProfile);
    localStorage.setItem("civic_pulse_user_profile", JSON.stringify(updatedProfile));
    if (auth.currentUser) {
      try {
        await setDoc(doc(db, "users", auth.currentUser.uid), updatedProfile, { merge: true });
      } catch (err) {
        console.error("Failed to sync profile to Firestore:", err);
      }
    }
  };

  const handleClaimDailyCheckIn = () => {
    const updated = {
      ...userProfile,
      streak: 1,
      points: userProfile.points + 10
    };
    saveProfile(updated);

    const checkInNotif: CivicNotification = {
      id: `checkin-${Date.now()}`,
      title: "🔥 Daily Check-In",
      message: "Welcome back! Your daily active streak has successfully renewed. Streak is now 1 Day! (Earned +10 XP)",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - Today",
      isRead: false,
      type: "resolved"
    };
    saveNotifications([checkInNotif, ...notifications]);
  };

  // Set hasMounted after first render
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Monitor newly unlocked badges
  useEffect(() => {
    if (issues.length === 0) return;

    const currentUnlocked = computeUnlockedBadges(userProfile, issues);
    const previouslyUnlocked = userProfile.badges || [];

    // Find any badge that is in currentUnlocked but NOT in previouslyUnlocked
    const newlyUnlocked = currentUnlocked.filter(b => !previouslyUnlocked.includes(b));

    if (newlyUnlocked.length > 0) {
      const badgeToUnlock = newlyUnlocked[0];
      const badgeDetails = BADGES_MAP[badgeToUnlock];

      // Trigger pop-up only if it's a real-time unlock (hasMounted is true)
      if (hasMounted && badgeDetails) {
        setUnlockedBadge(badgeDetails);
      }

      // Update and save user profile
      const updatedProfile = {
        ...userProfile,
        badges: [...previouslyUnlocked, ...newlyUnlocked]
      };
      saveProfile(updatedProfile);
    }
  }, [issues, userProfile.badges, hasMounted]);

  // Update status of user custom reported issues (simulation for badges)
  const handleUpdateIssueStatus = (id: string, newStatus: "reported" | "in-progress" | "resolved") => {
    const updated = issues.map(issue => {
      if (issue.id === id) {
        const dateStr = new Date().toISOString();
        const newEvent = {
          status: newStatus,
          date: dateStr,
          description: newStatus === "resolved" 
            ? "Varanasi Sanitation & Infrastructure Department successfully resolved the issue."
            : newStatus === "in-progress"
              ? "Municipal inspector verified the site and scheduled a cleanup crew."
              : "Issue reported by citizen and queued for inspection."
        };
        
        // Filter out existing events with the same status to prevent duplication
        const filteredTimeline = (issue.timeline || []).filter(t => t.status !== newStatus);

        return {
          ...issue,
          status: newStatus,
          timeline: [...filteredTimeline, newEvent]
        };
      }
      return issue;
    });
    saveIssues(updated);
  };

  // Monitor issue status changes and notify
  useEffect(() => {
    if (issues.length === 0) {
      prevIssuesRef.current = [];
      return;
    }

    // On initial mount, just sync the current list to ref to avoid triggering alerts for historical data
    if (prevIssuesRef.current.length === 0) {
      prevIssuesRef.current = issues;
      return;
    }

    const newNotifications: CivicNotification[] = [];

    issues.forEach(currIssue => {
      const prevIssue = prevIssuesRef.current.find(i => i.id === currIssue.id);
      if (prevIssue) {
        if (prevIssue.status !== currIssue.status && (currIssue.status === "in-progress" || currIssue.status === "resolved")) {
          const isUserOwn = currIssue.id.startsWith("issue-custom-");
          const isInUserCity = isIssueInCity(currIssue, cityName);

          if (isUserOwn || isInUserCity) {
            const isResolved = currIssue.status === "resolved";
            const notificationTitle = isResolved 
              ? "🎉 Issue Resolved!" 
              : "🛠️ Inspection Started!";
            
            const scopeText = isUserOwn 
              ? "Your reported issue" 
              : `Local issue in ${cityName}`;

            const notificationMessage = isResolved
              ? `${scopeText} "${currIssue.title}" has been successfully resolved by the municipality.`
              : `${scopeText} "${currIssue.title}" is now confirmed. A municipal inspector has started the inspection.`;

            newNotifications.push({
              id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              title: notificationTitle,
              message: notificationMessage,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " - Today",
              isRead: false,
              issueId: currIssue.id,
              type: currIssue.status as "in-progress" | "resolved",
            });
          }
        }
      }
    });

    if (newNotifications.length > 0) {
      saveNotifications([...newNotifications, ...notifications]);
    }

    prevIssuesRef.current = issues;
  }, [issues, cityName, notifications]);

  // Automated background municipality action simulation
  useEffect(() => {
    const interval = setInterval(() => {
      const cityIssues = issues.filter(i => isIssueInCity(i, cityName));
      if (cityIssues.length === 0) return;

      const reportedInCity = cityIssues.filter(i => i.status === "reported");
      const inProgressInCity = cityIssues.filter(i => i.status === "in-progress");

      let issueToUpdate: CivicIssue | null = null;
      let targetStatus: "in-progress" | "resolved" = "in-progress";

      if (reportedInCity.length > 0 && (Math.random() < 0.7 || inProgressInCity.length === 0)) {
        issueToUpdate = reportedInCity[Math.floor(Math.random() * reportedInCity.length)];
        targetStatus = "in-progress";
      } else if (inProgressInCity.length > 0) {
        issueToUpdate = inProgressInCity[Math.floor(Math.random() * inProgressInCity.length)];
        targetStatus = "resolved";
      }

      if (issueToUpdate) {
        handleUpdateIssueStatus(issueToUpdate.id, targetStatus);
      }
    }, 45000); // Check every 45 seconds to simulate municipality activity

    return () => clearInterval(interval);
  }, [issues, cityName]);

  // Sync profile form states when modal opens
  useEffect(() => {
    if (showProfileModal) {
      setEditName(userProfile.name || "");
      setEditAge(userProfile.age || "");
      setEditAadhar(userProfile.aadharId || "");
      setEditCity(userProfile.city || cityName || "Varanasi");
      setEditCountry(userProfile.country || "India");
      setEditProfilePic(userProfile.profilePic || "");
      setEditEmail(userProfile.email || "");
      setProfileErrors({});
    }
  }, [showProfileModal, userProfile, cityName]);

  // Profile helper methods
  const getAiAppreciationMessage = () => {
    const rep = userProfile.reportedCount || 0;
    const ver = userProfile.verifiedCount || 0;
    const pts = userProfile.points || 0;
    
    if (rep === 0 && ver === 1 && pts === 150) {
      return "🌟 A fantastic start! Varanasi's civic health has improved thanks to your very first verified issue. Keep up the momentum!";
    }
    if (rep > 0 && ver > 0) {
      return `🏆 Exemplary Citizen! Your active dedication of reporting ${rep} issues and verifying ${ver} reports has dramatically accelerated Varanasi's civic betterment.`;
    }
    if (rep > 0) {
      return `🛡️ Civic Guardian! By actively filing ${rep} critical hazard reports, you've provided municipal authorities with vital actionable insights.`;
    }
    if (ver > 0) {
      return `🤝 Community Catalyst! Your ${ver} validated verifications have helped establish strong civic consensus and trust across Varanasi wards.`;
    }
    return `✨ Star Contributor! Your active participation and dedication with ${pts} XP is inspiring neighbors and elevating our community health.`;
  };

  const handleGetLiveCityForProfile = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
              headers: {
                "Accept-Language": "en",
                "User-Agent": "CivicPlusApplet"
              }
            });
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              const city = addr.city || addr.town || addr.municipality || addr.village || addr.suburb || "Local City";
              setEditCity(city);
            } else {
              setEditCity("Varanasi");
            }
          } catch (e) {
            console.error(e);
            setEditCity("Varanasi");
          }
        },
        (error) => {
          console.warn("Geolocation failed, defaulting to Varanasi:", error);
          setEditCity("Varanasi");
        }
      );
    } else {
      setEditCity("Varanasi");
    }
  };

  const handleProfilePicChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfileModal = () => {
    const errors: { [key: string]: string } = {};

    if (!editName.trim()) {
      errors.name = "Full Name is required";
    }

    if (!editAge) {
      errors.age = "Age is required";
    } else {
      const parsedAge = parseInt(editAge.toString(), 10);
      if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 125) {
        errors.age = "Please enter a valid age (1-125)";
      }
    }

    if (!editAadhar.trim()) {
      errors.aadhar = "Aadhar ID is required";
    } else {
      const sanitized = editAadhar.trim().replace(/\s/g, "");
      if (!/^\d{12}$/.test(sanitized)) {
        errors.aadhar = "Aadhar ID must be exactly 12 numeric digits";
      }
    }

    if (!editCity.trim()) {
      errors.city = "City is required";
    }

    if (!editCountry.trim()) {
      errors.country = "Country is required";
    }

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      return;
    }

    // Save updated profile
    const updated: UserState = {
      ...userProfile,
      name: editName.trim(),
      email: editEmail.trim() || userProfile.email,
      age: parseInt(editAge.toString(), 10),
      aadharId: editAadhar.trim(),
      city: editCity.trim(),
      country: editCountry.trim(),
      profilePic: editProfilePic
    };

    saveProfile(updated);
    setShowProfileModal(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Signout error from Firebase:", e);
    }
    localStorage.removeItem("civic_pulse_logged_in");
    setIsLoggedIn(false);
    // Reset forms
    setLoginEmail("");
    setLoginName("");
    setLoginAge("");
    setLoginAadhar("");
    setLoginCity("Varanasi");
    setLoginCountry("India");
    setDigiLockerAccepted(false);
    setRegistrationErrors({});
  };

  const handleDigiLockerVerify = (pin: string) => {
    if (!pin || pin.length !== 6 || isNaN(Number(pin))) {
      setDigiLockerError("Please enter a valid 6-digit DigiLocker security PIN.");
      return;
    }
    
    setDigiLockerSyncing(true);
    setDigiLockerError("");
    
    setTimeout(() => {
      // Simulate DigiLocker retrieving official identity credentials
      setLoginName("Sunflower Civic");
      setLoginAadhar("583920194821");
      setLoginAge("24");
      setLoginCity("Varanasi");
      setLoginCountry("India");
      setDigiLockerAccepted(true);
      setDigiLockerSyncing(false);
      setDigiLockerModalOpen(false);
      setDigiLockerPin("");
      
      // Clear errors for those fields
      setRegistrationErrors(prev => {
        const copy = { ...prev };
        delete copy.name;
        delete copy.aadhar;
        delete copy.age;
        delete copy.city;
        delete copy.country;
        return copy;
      });
    }, 1200);
  };

  const handleSelectGoogleEmail = (email: string) => {
    setLoginEmail(email);
    setGoogleEmailPickerOpen(false);
    // Clear email error
    setRegistrationErrors(prev => {
      const copy = { ...prev };
      delete copy.email;
      return copy;
    });

    // Check if user is already fully registered with this email
    const existing = registeredUsers.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      setLoginName(existing.name || "");
      setLoginAge(existing.age?.toString() || "");
      setLoginAadhar(existing.aadharId || "");
      setLoginCity(existing.city || "Varanasi");
      setLoginCountry(existing.country || "India");
      setDigiLockerAccepted(existing.aadharId ? true : false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (user) {
        const email = user.email || "";
        const displayName = user.displayName || "";
        const photoURL = user.photoURL || "";

        // Auto-fill email
        setLoginEmail(email);

        // Auto-fill name from email ID prefix
        const autofilledName = extractNameFromEmail(email);
        setLoginName(autofilledName || displayName);

        // Set userProfile temp details
        setUserProfile(prev => ({
          ...prev,
          email: email,
          name: autofilledName || displayName,
          profilePic: photoURL,
        }));

        // Fetch document from Firestore
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          // Fully registered!
          const data = userDocSnap.data() as UserState;
          setUserProfile(data);
          localStorage.setItem("civic_pulse_user_profile", JSON.stringify(data));
          localStorage.setItem("civic_pulse_logged_in", "true");
          setIsLoggedIn(true);
        } else {
          // New registration onboarding required!
          // We keep isLoggedIn as false, and let them complete Aadhar Card ID number, live city, age, etc.
          setRegistrationErrors({});
        }
      }
    } catch (err) {
      console.error("Google Sign-In failed:", err);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    const emailTrimmed = loginEmail.trim();
    const nameTrimmed = loginName.trim();
    const ageVal = loginAge.trim();
    const aadharClean = loginAadhar.replace(/\s+/g, "");
    const cityTrimmed = loginCity.trim();
    const countryTrimmed = loginCountry.trim();

    if (!emailTrimmed) {
      errors.email = "Email ID is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      errors.email = "Please enter a valid email address (e.g. user@gmail.com)";
    }

    if (!nameTrimmed) {
      errors.name = "Full Name is required";
    }

    if (!ageVal) {
      errors.age = "Age is required";
    } else {
      const parsed = Number(ageVal);
      if (isNaN(parsed) || parsed < 18 || parsed > 120) {
        errors.age = "You must be 18 to 120 years old to register.";
      }
    }

    if (!aadharClean) {
      errors.aadhar = "Aadhar Card Number is required";
    } else if (!/^\d{12}$/.test(aadharClean)) {
      errors.aadhar = "Aadhar Card Number must be exactly 12 numeric digits";
    }

    if (!cityTrimmed) {
      errors.city = "City is required";
    }

    if (!countryTrimmed) {
      errors.country = "Country is required";
    }

    // Crucial rule constraint check: "only one email id can be used having same aadhar number"
    if (!errors.aadhar && !errors.email) {
      const duplicateUser = registeredUsers.find(
        (u: any) => u.aadharId === aadharClean && u.email.toLowerCase() !== emailTrimmed.toLowerCase()
      );
      if (duplicateUser) {
        errors.aadhar = `Security Block: Aadhar number ${aadharClean.slice(0, 4)} **** **** is already registered under email: ${duplicateUser.email}. Only one email ID can be associated with an Aadhar card number.`;
      }
    }

    if (Object.keys(errors).length > 0) {
      setRegistrationErrors(errors);
      return;
    }

    // Construct profile
    const registeredProfile = {
      email: emailTrimmed.toLowerCase(),
      name: nameTrimmed,
      points: userProfile.points > 150 ? userProfile.points : 150,
      streak: userProfile.streak || 1,
      badges: userProfile.badges && userProfile.badges.length > 0 ? userProfile.badges : ["Community Helper"],
      reportedCount: userProfile.reportedCount || 0,
      verifiedCount: userProfile.verifiedCount || 1,
      age: Number(ageVal),
      aadharId: aadharClean,
      city: cityTrimmed,
      country: countryTrimmed,
      profilePic: userProfile.profilePic || "",
    };

    // Save user to registered user pool
    const userIndex = registeredUsers.findIndex((u: any) => u.email.toLowerCase() === registeredProfile.email);
    let updatedUsers = [...registeredUsers];
    if (userIndex >= 0) {
      updatedUsers[userIndex] = registeredProfile;
    } else {
      updatedUsers.push(registeredProfile);
    }
    setRegisteredUsers(updatedUsers);
    localStorage.setItem("civic_pulse_registered_users", JSON.stringify(updatedUsers));

    // Save profile and log in
    saveProfile(registeredProfile);
    localStorage.setItem("civic_pulse_logged_in", "true");
    setIsLoggedIn(true);
  };

  // Add new reported issue from Step 5
  const handleAddIssue = (newIssue: CivicIssue) => {
    const updated = [newIssue, ...issues];
    saveIssues(updated);
    
    // Increment reported count in profile
    const updatedProfile: UserState = {
      ...userProfile,
      reportedCount: userProfile.reportedCount + 1,
      points: userProfile.points + 50, // 50 XP award
    };
    saveProfile(updatedProfile);
  };

  // Upvote / Verify report trigger
  const handleVerifyIssue = (id: string) => {
    // Open verification authentication modal
    setVerifyingIssueId(id);
    setVerificationPin("");
    setVerificationError(null);
    setIsVerifyingAuth(false);
  };

  const executeVerifyIssue = (id: string) => {
    const email = syncedUserProfile.email || "sunflowerr.flowerr25@gmail.com";
    const updated = issues.map((issue) => {
      if (issue.id === id) {
        // Prevent double verify
        if (issue.verifications.includes(email)) return issue;

        return {
          ...issue,
          verificationCount: issue.verificationCount + 1,
          verifications: [...issue.verifications, email],
          // Increase urgency rating slightly based on new citizen votes
          urgencyScore: Math.min(100, issue.urgencyScore + 2),
        };
      }
      return issue;
    });

    saveIssues(updated);

    // Grant 15 XP to user for verifying reports
    const updatedProfile: UserState = {
      ...userProfile,
      verifiedCount: userProfile.verifiedCount + 1,
      points: userProfile.points + 15, // 15 XP award
    };
    saveProfile(updatedProfile);
  };

  const handleConfirmVerificationAuth = () => {
    if (verificationPin !== "123456") {
      setVerificationError("Incorrect 6-digit DigiLocker PIN. Please enter '123456' for verification.");
      return;
    }

    setIsVerifyingAuth(true);
    setTimeout(() => {
      if (verifyingIssueId) {
        executeVerifyIssue(verifyingIssueId);
      }
      setIsVerifyingAuth(false);
      setVerifyingIssueId(null);
    }, 800);
  };

  // Award extra points helper
  const handleAddPoints = (points: number) => {
    const updated = {
      ...userProfile,
      points: userProfile.points + points,
    };
    saveProfile(updated);
  };

  // Deep cross-navigation tracking coordinator
  const handleNavigateToTab = (tabName: string, issueId?: string) => {
    if (issueId) {
      setSelectedIssueId(issueId);
    } else {
      setSelectedIssueId(null);
    }
    setActiveTab(tabName);
  };

  // Navigation Items
  const navItems = [
    { name: "Home", label: "Home", icon: Home },
    { name: "Report", label: "Report", icon: PlusCircle },
    { name: "Map", label: "Map", icon: MapIcon },
    { name: "Track", label: "Track", icon: List },
    { name: "Impact", label: "Impact", icon: BarChart3 },
    { name: "Community", label: "Community", icon: Users },
  ];

  // Synchronized user profile with actual user reported issues
  const syncedUserProfile = {
    ...userProfile,
    reportedCount: issues.filter(i => i.id.startsWith("issue-custom-")).length
  };

  const getMunicipalContacts = (city: string) => {
    const isVns = city.toLowerCase().includes("varanasi");
    return [
      {
        dept: "Waste & Sanitation",
        email: isVns ? "swachhvaranasi@gmail.com" : `cleanup.${city.toLowerCase().replace(/\s+/g, "")}@municipal.gov.in`,
        phone: isVns ? "1800-180-5567" : "1800-111-4567"
      },
      {
        dept: "Roads & Infrastructure",
        email: isVns ? "roads.varanasi@nnvns.org.in" : `roads.${city.toLowerCase().replace(/\s+/g, "")}@municipal.gov.in`,
        phone: isVns ? "0542-2221702" : "0542-111-2222"
      },
      {
        dept: "Water Supply & Sewage",
        email: isVns ? "jalkalvns@gmail.com" : `water.sewage@${city.toLowerCase().replace(/\s+/g, "")}-municipal.gov.in`,
        phone: isVns ? "0542-2354124" : "0542-2355940"
      },
      {
        dept: "Street Lighting & Power",
        email: isVns ? "lighting.vns@nnvns.org.in" : `lighting@${city.toLowerCase().replace(/\s+/g, "")}-municipal.gov.in`,
        phone: isVns ? "0542-2221704" : "0542-555-6666"
      },
      {
        dept: "Public Parks & Gardens",
        email: isVns ? "udyan.vns@nnvns.org.in" : `parks.green@${city.toLowerCase().replace(/\s+/g, "")}-municipal.gov.in`,
        phone: isVns ? "0542-2221702" : "0542-777-8888"
      },
      {
        dept: "Disaster & Safety Hazards",
        email: isVns ? "vnncontrolroom@gmail.com" : `safety.ward@${city.toLowerCase().replace(/\s+/g, "")}-municipal.gov.in`,
        phone: isVns ? "0542-2221711" : "0542-999-0000"
      }
    ];
  };

  const handleTriggerMockUpdate = () => {
    // Find issues in the user's city
    const cityIssues = issues.filter(i => isIssueInCity(i, cityName));
    if (cityIssues.length === 0) return;

    // Pick issues that are "reported" or "in-progress"
    const reported = cityIssues.filter(i => i.status === "reported");
    const inProgress = cityIssues.filter(i => i.status === "in-progress");

    if (reported.length > 0 && (Math.random() < 0.65 || inProgress.length === 0)) {
      // Transition a reported issue to in-progress
      const randomIssue = reported[Math.floor(Math.random() * reported.length)];
      handleUpdateIssueStatus(randomIssue.id, "in-progress");
    } else if (inProgress.length > 0) {
      // Transition an in-progress issue to resolved
      const randomIssue = inProgress[Math.floor(Math.random() * inProgress.length)];
      handleUpdateIssueStatus(randomIssue.id, "resolved");
    } else {
      // If none, reset all to reported so we can simulate again
      const resetAll = issues.map(issue => {
        if (isIssueInCity(issue, cityName)) {
          return { ...issue, status: "reported" as const };
        }
        return issue;
      });
      saveIssues(resetAll);
      // Immediately notify
      setTimeout(() => {
        const first = resetAll.find(i => isIssueInCity(i, cityName));
        if (first) {
          handleUpdateIssueStatus(first.id, "in-progress");
        }
      }, 300);
    }
  };

  return (
    <>
      {!isLoggedIn ? (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
          <div className="max-w-xl w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl border border-slate-100 shadow-xl relative overflow-hidden">
            {/* Decorative background gradients */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/40 rounded-full blur-2xl -mr-12 -mt-12 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-blue-100/30 rounded-full blur-3xl -ml-12 -mb-12 pointer-events-none" />

            {/* Logo & Header */}
            <div className="text-center relative">
              <div className="mx-auto w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-sans font-black text-xl shadow-md mb-3 animate-bounce">
                C+
              </div>
              <h2 className="text-2xl font-sans font-black text-slate-800 tracking-tight">
                Welcome to Civic+
              </h2>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {!auth.currentUser 
                  ? "Sign in securely via Google Account to report and track municipal complaints in your city."
                  : "Verify your identity details below to complete your profile registration and unlock the dashboard."}
              </p>
            </div>

            {!auth.currentUser ? (
              <div className="space-y-6 py-6 text-center relative z-10">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100/60 max-w-md mx-auto">
                  <p className="text-[11px] text-emerald-800 leading-relaxed font-sans font-medium">
                    Welcome to Civic+! Please authenticate with your Google (Gmail) account first. We will use this to securely connect your municipal profile and verified complaints.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={authLoading}
                  className="w-full max-w-sm mx-auto flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-sans font-black text-xs uppercase tracking-wider py-3.5 px-4 border border-slate-200 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  <span>{authLoading ? "Signing in..." : "Sign in with Google"}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4 relative">
                {/* Active Google User Session Info */}
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl mb-4">
                  {auth.currentUser.photoURL ? (
                    <img src={auth.currentUser.photoURL} className="w-10 h-10 rounded-full border border-emerald-400 shrink-0" alt="Google Profile" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {auth.currentUser.email?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">Connected: {auth.currentUser.displayName}</p>
                    <p className="text-[10px] text-slate-500 font-mono truncate">{auth.currentUser.email}</p>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleLogout} 
                    className="ml-auto text-[9px] text-rose-500 hover:underline font-bold shrink-0 bg-white border border-rose-100 px-2.5 py-1 rounded-lg"
                  >
                    Disconnect
                  </button>
                </div>

                {/* Email Field - Auto-filled and Read-Only */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex justify-between">
                    <span>Verified Gmail Account</span>
                    <span className="text-[9px] text-emerald-600 font-mono lowercase">verified via google</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-slate-400 font-sans text-xs">@</span>
                    </div>
                    <input
                      type="email"
                      readOnly
                      required
                      value={loginEmail}
                      className="w-full pl-8 pr-3 py-2.5 text-xs font-mono font-semibold bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed text-slate-500 outline-none"
                    />
                  </div>
                </div>

              {/* DigiLocker Smart Fill Callout Section */}
              <div className="bg-gradient-to-r from-blue-50/75 to-indigo-50/50 p-4 rounded-2xl border border-blue-100/60 shadow-3xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-blue-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      Speed up with DigiLocker Identity Sync
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Securely retrieve and pre-fill your verified Full Name, Age, Aadhar, and City instantly in one click.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDigiLockerError("");
                      setDigiLockerModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-sans font-extrabold text-[10.5px] px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1 shrink-0"
                  >
                    <Lock className="w-3 h-3 text-blue-100" />
                    Sync ID
                  </button>
                </div>

                {digiLockerAccepted && (
                  <div className="mt-3 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl flex items-center gap-2 text-emerald-800 text-[10.5px] font-sans font-bold">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>DigiLocker Identity Verified successfully! Fields pre-populated.</span>
                  </div>
                )}
              </div>

              {/* Manual Form Inputs Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Full Name */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={loginName}
                      onChange={(e) => {
                        setLoginName(e.target.value);
                        if (registrationErrors.name) {
                          setRegistrationErrors(prev => {
                            const copy = { ...prev };
                            delete copy.name;
                            return copy;
                          });
                        }
                      }}
                      placeholder="Enter your full legal name"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-xs font-semibold"
                    />
                    {digiLockerAccepted && (
                      <span className="absolute right-3 top-2.5 text-emerald-600 text-[10px] font-mono font-bold" title="Verified by DigiLocker">✓ Verified</span>
                    )}
                  </div>
                  {registrationErrors.name && (
                    <p className="mt-0.5 text-[10px] text-rose-500 font-medium">⚠️ {registrationErrors.name}</p>
                  )}
                </div>

                {/* Age */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Age <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="18"
                      max="120"
                      value={loginAge}
                      onChange={(e) => {
                        setLoginAge(e.target.value);
                        if (registrationErrors.age) {
                          setRegistrationErrors(prev => {
                            const copy = { ...prev };
                            delete copy.age;
                            return copy;
                          });
                        }
                      }}
                      placeholder="E.g. 24"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-xs font-semibold"
                    />
                    {digiLockerAccepted && (
                      <span className="absolute right-3 top-2.5 text-emerald-600 text-[10px] font-mono font-bold">✓ Verified</span>
                    )}
                  </div>
                  {registrationErrors.age && (
                    <p className="mt-0.5 text-[10px] text-rose-500 font-medium">⚠️ {registrationErrors.age}</p>
                  )}
                </div>

                {/* Aadhar Card Number - validated strictly to 12 digits */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex justify-between">
                    <span>12-Digit Aadhar Card Number <span className="text-rose-500">*</span></span>
                    <span className="text-[9px] text-slate-400 font-mono lowercase">unique per email ID</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      maxLength={12}
                      value={loginAadhar}
                      onChange={(e) => {
                        // Allow only numbers
                        const val = e.target.value.replace(/\D/g, "");
                        setLoginAadhar(val);
                        if (registrationErrors.aadhar) {
                          setRegistrationErrors(prev => {
                            const copy = { ...prev };
                            delete copy.aadhar;
                            return copy;
                          });
                        }
                      }}
                      placeholder="Enter 12-digit UIDAI number"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-xs font-mono font-bold tracking-widest"
                    />
                    {digiLockerAccepted && (
                      <span className="absolute right-3 top-3 text-emerald-600 text-[10px] font-mono font-bold">✓ Verified UID</span>
                    )}
                  </div>
                  {registrationErrors.aadhar && (
                    <p className="mt-1 text-[10.5px] text-rose-500 font-medium leading-normal bg-rose-50/50 p-2.5 border border-rose-100 rounded-xl">
                      ⚠️ {registrationErrors.aadhar}
                    </p>
                  )}
                </div>

                {/* City */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    City / Location <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={loginCity}
                    onChange={(e) => setLoginCity(e.target.value)}
                    placeholder="E.g. Varanasi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-xs font-semibold"
                  />
                  {registrationErrors.city && (
                    <p className="mt-0.5 text-[10px] text-rose-500 font-medium">⚠️ {registrationErrors.city}</p>
                  )}
                </div>

                {/* Country */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Country <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={loginCountry}
                    onChange={(e) => setLoginCountry(e.target.value)}
                    placeholder="India"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none text-xs font-semibold"
                  />
                  {registrationErrors.country && (
                    <p className="mt-0.5 text-[10px] text-rose-500 font-medium">⚠️ {registrationErrors.country}</p>
                  )}
                </div>

              </div>

              {/* Consent Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input 
                    type="checkbox"
                    required
                    className="mt-0.5 w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 leading-normal select-none">
                    I hereby authorize Civic+ to verify my Aadhar details and consent to local data guidelines per municipal security protocols.
                  </span>
                </label>
              </div>

              {/* Submit Register Button */}
              <button
                type="submit"
                className="w-full mt-4 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-extrabold text-xs uppercase tracking-wider py-3 rounded-2xl transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Unlock Dashboard & Log In</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </button>
            </form>
            )}
          </div>

          {/* DIGILOCKER SIMULATION DIALOG */}
          {digiLockerModalOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-200">
                {/* DigiLocker Brand Banner */}
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 text-white text-center relative">
                  <div className="mx-auto w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-black text-sm mb-2 shadow-inner">
                    DL
                  </div>
                  <h3 className="font-sans font-extrabold text-sm uppercase tracking-wider">DigiLocker Identity Sync</h3>
                  <p className="text-[9.5px] text-blue-100 font-medium">Government of India Secure Consent Portal</p>
                </div>

                <div className="p-6 space-y-4">
                  <p className="text-xs text-slate-600 leading-normal">
                    To retrieve your verified e-Aadhar and full profile from DigiLocker, please authorize using your secure security PIN.
                  </p>

                  <div>
                    <label className="block text-[9.5px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      6-Digit Security PIN
                    </label>
                    <input
                      type="password"
                      maxLength={6}
                      value={digiLockerPin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setDigiLockerPin(val);
                        setDigiLockerError("");
                      }}
                      placeholder="Enter 6-digit PIN"
                      className="w-full text-center px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none text-base font-mono tracking-[0.6em]"
                    />
                    <p className="mt-1 text-[8.5px] text-slate-400 font-mono text-center">Default sandbox PIN: 123456</p>
                    
                    {digiLockerError && (
                      <p className="mt-2 text-[10.5px] text-rose-500 font-medium text-center">⚠️ {digiLockerError}</p>
                    )}
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      disabled={digiLockerSyncing}
                      onClick={() => handleDigiLockerVerify(digiLockerPin)}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-sans font-bold text-xs uppercase tracking-wider py-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {digiLockerSyncing ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin inline-block" />
                          <span>Verifying Consent...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm & Authorize</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDigiLockerModalOpen(false)}
                      className="w-full text-center text-[10.5px] text-slate-400 hover:text-slate-600 font-bold transition-colors cursor-pointer py-1"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div id="civic-pulse-app-root" className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900">
      
      {/* Sticky top premium navbar */}
      <nav id="app-sticky-navbar" className="sticky top-0 z-[1000] w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <button 
            onClick={() => handleNavigateToTab("Home")} 
            className="flex items-center gap-2.5 text-left hover:opacity-90 transition-opacity shrink-0"
          >
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-black text-sm shadow-sm">
              C
            </div>
            <span className="font-sans font-extrabold text-slate-900 text-lg md:text-xl tracking-tight">
              Civic+
            </span>
          </button>

          {/* Search Box in Top Bar with AI one-word hashtag recommendations */}
          <div className="relative hidden sm:flex items-center h-16 shrink-0 min-w-[110px] lg:min-w-[140px]">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val && activeTab !== "Track") {
                    setActiveTab("Track");
                  }
                }}
                className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-[11px] font-sans focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all focus:bg-white"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              
              {/* Recommendations dropdown - only appears when input is focused */}
              {isSearchFocused && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 z-[1002] animate-in fade-in slide-in-from-top-1 duration-100 min-w-[160px]">
                  <div className="flex items-center gap-1 mb-1.5">
                    <Sparkles className="w-3 h-3 text-purple-500 shrink-0 animate-pulse" />
                    <span className="text-[9px] text-purple-700 font-extrabold uppercase tracking-wide">AI Recommendation</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['pothole', 'lights', 'water', 'garbage', 'sewage'].map((tag) => {
                      const tagWithHash = `#${tag}`;
                      const isSelected = searchQuery === tagWithHash;
                      return (
                        <button
                          key={tag}
                          onMouseDown={(e) => {
                            // Prevent blur from closing the menu before click event goes through
                            e.preventDefault();
                            const newQuery = isSelected ? "" : tagWithHash;
                            setSearchQuery(newQuery);
                            if (newQuery) {
                              setActiveTab("Track");
                            }
                          }}
                          className={`text-[9px] font-sans font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-purple-100 text-purple-700 border-purple-200" 
                              : "bg-slate-50 text-slate-500 border-slate-150 hover:bg-slate-100"
                          }`}
                        >
                          {tagWithHash}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Tabs Navigation - perfectly spaced with equal room, shifted left */}
          <div id="desktop-tabs-row" className="hidden md:flex items-center justify-start gap-2 lg:gap-3.5 ml-2 lg:ml-3 mr-auto h-16 text-sm font-medium">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  id={`nav-tab-desktop-${item.name.toLowerCase()}`}
                  onClick={() => handleNavigateToTab(item.name)}
                  className={`h-16 px-1 lg:px-2.5 flex flex-col lg:flex-row items-center justify-center gap-1.5 border-b-2 text-[10px] lg:text-[11px] font-bold uppercase tracking-wider transition-all duration-150 shrink-0 ${
                    isActive 
                      ? "text-emerald-600 border-emerald-600 font-extrabold" 
                      : "text-slate-500 border-transparent hover:text-emerald-600 hover:border-slate-200"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Three Dots More Menu placed right next to Community button */}
            <div className="relative shrink-0 flex items-center h-16">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-slate-200 shadow-xs"
                title="More options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {showMoreMenu && (
                <>
                  {/* Backdrop for click away */}
                  <div className="fixed inset-0 z-[1001]" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-[1002] animate-in fade-in slide-in-from-top-1 duration-100">
                    <button
                      onClick={() => {
                        setShowContactsModal(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Municipal Contacts
                    </button>
                    <button
                      onClick={() => {
                        setShowAboutModal(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      About Civic+ App
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      Logout / Exit
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right session User HUD */}
          <div id="top-user-hud" className="flex items-center gap-2 lg:gap-3 shrink-0 ml-auto">
            {/* Direct Quick Action button matching the Sleek design theme */}
            <button 
              onClick={() => handleNavigateToTab("Report")} 
              className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-full text-[11px] font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer hidden lg:block uppercase tracking-wider"
            >
              + Report
            </button>

            {/* Notification Bell Icon & Dropdown */}
            <div className="relative shrink-0 flex items-center">
              <button
                id="notification-bell-btn"
                onClick={() => {
                  setShowNotificationsMenu(!showNotificationsMenu);
                  setShowMoreMenu(false);
                }}
                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-full transition-all cursor-pointer flex items-center justify-center relative border border-slate-200 shadow-xs"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotificationsMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-[1001]" onClick={() => setShowNotificationsMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl py-3 z-[1002] animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-4 h-4 text-emerald-600" />
                        <h4 className="font-sans font-extrabold text-slate-800 text-xs uppercase tracking-wide">
                          Notifications
                        </h4>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold transition-colors cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center flex flex-col items-center justify-center gap-1">
                          <Bell className="w-8 h-8 text-slate-300 animate-pulse" />
                          <span className="text-[11px] font-semibold text-slate-500">No new notifications</span>
                          <span className="text-[9px] text-slate-400 leading-normal mt-1">You'll be notified when issues in {cityName} are verified or resolved.</span>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              handleNavigateToTab("Track", notif.issueId);
                              handleMarkAsRead(notif.id);
                              setShowNotificationsMenu(false);
                            }}
                            className={`px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${!notif.isRead ? "bg-emerald-50/20" : ""}`}
                          >
                            <div className="shrink-0 mt-0.5">
                              {notif.type === "resolved" ? (
                                <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                                  <Check className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                                  <Sparkles className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-[11px] font-extrabold block truncate ${!notif.isRead ? "text-slate-900" : "text-slate-600"}`}>
                                  {notif.title}
                                </span>
                                <span className="text-[8px] text-slate-400 font-medium shrink-0">
                                  {notif.timestamp}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-normal mt-0.5 font-medium line-clamp-2">
                                {notif.message}
                              </p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="px-4 pt-2.5 border-t border-slate-100 flex flex-col gap-2">
                      <button
                        onClick={handleTriggerMockUpdate}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-[9.5px] uppercase tracking-wider py-2 rounded-xl transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                        <span>Simulate Municipality Action</span>
                      </button>
                      <button
                        onClick={handleClearNotifications}
                        className="w-full text-center text-[9px] text-slate-400 hover:text-slate-600 font-bold transition-colors cursor-pointer py-1"
                      >
                        Clear All History
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Vertical light gray divider separating user profile */}
            <div className="hidden sm:block h-8 w-[1px] bg-slate-200 shrink-0 mx-1" />

            {/* Compact and beautiful profile card */}
            <div 
              onClick={() => handleNavigateToTab("Community")}
              className="hidden sm:flex items-center gap-2.5 transition-all cursor-pointer shrink-0 hover:bg-slate-50/50 p-1.5 rounded-2xl border border-transparent hover:border-slate-150 group"
              title="Click to view and edit profile"
            >
              {syncedUserProfile.profilePic ? (
                <img src={syncedUserProfile.profilePic} className="w-8 h-8 rounded-full object-cover border border-emerald-500 shrink-0 shadow-xs" alt="Avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-600 border border-emerald-500 flex items-center justify-center font-sans font-extrabold text-white text-xs uppercase shrink-0">
                  {syncedUserProfile.name ? syncedUserProfile.name.charAt(0).toUpperCase() : syncedUserProfile.email.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-1">
                  <span className="font-sans font-extrabold text-slate-700 text-[9.5px] uppercase tracking-wider block transition-colors leading-none truncate max-w-[150px]">
                    {syncedUserProfile.name || "User"}
                  </span>
                  <Edit2 className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-600 shrink-0" />
                </div>
                <span className="font-sans text-[7.5px] text-slate-400 mt-0.5 leading-none block truncate max-w-[150px]" title={syncedUserProfile.email}>
                  {syncedUserProfile.email}
                </span>
              </div>
            </div>

            {/* Mobile / fallback Profile button */}
            <div 
              onClick={() => handleNavigateToTab("Community")}
              className="flex sm:hidden items-center justify-center w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold cursor-pointer overflow-hidden shrink-0"
              title="Click to view and edit profile"
            >
              {syncedUserProfile.profilePic ? (
                <img src={syncedUserProfile.profilePic} className="w-full h-full object-cover" alt="Avatar" referrerPolicy="no-referrer" />
              ) : (
                syncedUserProfile.name ? syncedUserProfile.name.charAt(0).toUpperCase() : syncedUserProfile.email.charAt(0).toUpperCase()
              )}
            </div>

            {/* Mobile-only More options menu */}
            <div className="relative shrink-0 md:hidden">
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-all cursor-pointer flex items-center justify-center border border-slate-200"
                title="More options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-[1001]" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-[1002] animate-in fade-in slide-in-from-top-1 duration-100">
                    <button
                      onClick={() => {
                        setShowContactsModal(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Municipal Contacts
                    </button>
                    <button
                      onClick={() => {
                        setShowAboutModal(true);
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      About Civic+ App
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowMoreMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      Logout / Exit
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>

        </div>
      </nav>

      {/* Main Tab Render Container with subtle page slide-fade animation */}
      <main id="app-main-viewport" className="flex-1 w-full bg-slate-50/20 py-4 overflow-x-hidden">
        <div className="animate-in fade-in duration-300">
          {activeTab === "Home" && (
            <HomeTab 
              issues={issues} 
              onNavigateToTab={handleNavigateToTab} 
              onVerify={handleVerifyIssue} 
              userLocation={userLocation}
              cityName={cityName}
              currentWard={currentWard}
              user={syncedUserProfile}
              onClaimDailyCheckIn={handleClaimDailyCheckIn}
            />
          )}
          {activeTab === "Report" && (
            <ReportTab 
              onAddIssue={handleAddIssue} 
              onNavigateToTab={handleNavigateToTab} 
              userPoints={userProfile.points}
              onAddPoints={handleAddPoints}
              userLocation={userLocation}
              cityName={cityName}
              currentWard={currentWard}
              onLocationChange={handleLocationUpdate}
              user={syncedUserProfile}
            />
          )}
          {activeTab === "Map" && (
            <MapTab 
              issues={filteredIssues.filter(issue => !isResolvedOver72Hours(issue))} 
              onVerify={handleVerifyIssue} 
              selectedIssueId={selectedIssueId}
              onSelectIssue={setSelectedIssueId}
              userLocation={userLocation}
              cityName={cityName}
              currentWard={currentWard}
              currentUserEmail={syncedUserProfile.email}
            />
          )}
          {activeTab === "Track" && (
            <TrackTab 
              issues={filteredIssues.filter(issue => !isResolvedOver72Hours(issue))} 
              onVerify={handleVerifyIssue} 
              onNavigateToTab={handleNavigateToTab} 
              searchQuery={searchQuery}
              onUpdateStatus={handleUpdateIssueStatus}
              userLocation={userLocation}
              currentUserEmail={syncedUserProfile.email}
              currentWard={currentWard}
              cityName={cityName}
            />
          )}
          {activeTab === "Impact" && (
            <ImpactTab 
              issues={filteredIssues} 
              cityName={cityName}
              userLocation={userLocation}
              currentWard={currentWard}
            />
          )}
          {activeTab === "Community" && (
            <CommunityTab 
              user={syncedUserProfile} 
              onUpdateProfile={saveProfile}
              issues={issues}
            />
          )}
        </div>
      </main>

      {/* Sticky Bottom bar for Mobile responsive layouts */}
      <footer id="mobile-tabs-bar" className="sticky bottom-0 z-[1000] w-full bg-white border-t border-slate-100 shadow-lg md:hidden shrink-0">
        <div className="grid grid-cols-6 h-14">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                id={`nav-tab-mobile-${item.name.toLowerCase()}`}
                onClick={() => handleNavigateToTab(item.name)}
                className="flex flex-col items-center justify-center transition-all active:scale-90"
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                <span className={`text-[9px] font-sans font-semibold mt-0.5 ${
                  isActive ? "text-emerald-600 font-bold" : "text-slate-400"
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </footer>

      {/* Municipality Contacts Modal */}
      {showContactsModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display font-bold text-slate-800 text-base">Municipality Departments</h3>
              </div>
              <button 
                onClick={() => setShowContactsModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500 mb-4">Official communication channels for {cityName} Municipal Corporation departments (AI-verified):</p>
              <div className="border border-slate-150 rounded-xl overflow-hidden text-xs overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-slate-600 font-bold">
                      <th className="p-2.5">Department</th>
                      <th className="p-2.5">Official Email ID</th>
                      <th className="p-2.5">Contact Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {getMunicipalContacts(cityName).map((contact) => (
                      <tr key={contact.dept}>
                        <td className="p-2.5 font-semibold text-slate-700">{contact.dept}</td>
                        <td className="p-2.5 font-mono text-emerald-600 hover:underline select-all">
                          <a href={`mailto:${contact.email}`}>{contact.email}</a>
                        </td>
                        <td className="p-2.5 font-mono text-emerald-600 hover:underline select-all">
                          <a href={`tel:${contact.phone.replace(/[^0-9-]/g, "")}`}>{contact.phone}</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowContactsModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* About Civic+ Modal */}
      {showAboutModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-emerald-600" />
                <h3 className="font-display font-bold text-slate-800 text-base">About Civic+</h3>
              </div>
              <button 
                onClick={() => setShowAboutModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-500/10 to-teal-500/5 p-4 rounded-xl border border-emerald-100/40">
                <div className="p-2 bg-emerald-600 rounded-lg text-white">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-slate-800 text-sm">Hyperlocal Civic Intelligence</h4>
                  <p className="text-[10.5px] text-slate-500 font-sans">Connecting citizens and municipal bodies.</p>
                </div>
              </div>
              
              <div className="space-y-3 text-xs text-slate-600 font-sans leading-relaxed">
                <p>
                  <strong className="text-slate-800">Civic+</strong> is a modern citizen-driven platform designed to empower residents to report, track, and verify local civic issues instantly. 
                </p>
                <p>
                  By leveraging <strong className="text-emerald-700">AI-assisted diagnosis</strong> and crowdsourced <strong className="text-teal-700">citizen consensus</strong>, Civic+ converts mobile evidence into structured, verifiable reports within a 30km range.
                </p>
                <p>
                  Whether it is repairing road potholes, reporting waste piles, or addressing water leaks and streetlight outages, Civic+ bridges the communication gap to fast-track municipal dispatch and build cleaner, safer urban neighborhoods.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Version 1.2.0 (Stable)</span>
                <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                  Active Cluster
                </span>
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowAboutModal(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Congrats Badge Unlocked Modal Popup */}
      {unlockedBadge && (
        <div id="badge-unlocked-popup-overlay" className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[999999] animate-in fade-in duration-300">
          <div id="badge-unlocked-popup-content" className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm w-full overflow-hidden p-6 text-center relative animate-in zoom-in-95 duration-300">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500" />
            
            {/* Visual badge sphere */}
            <div className="mx-auto w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-4 relative shadow-inner">
              <div className={`w-20 h-20 rounded-full bg-gradient-to-tr ${unlockedBadge.color} flex items-center justify-center text-white shadow-md`}>
                {unlockedBadge.name === "Eco Guardian" && <Flame className="w-10 h-10 animate-bounce" />}
                {unlockedBadge.name === "Change Maker" && <Zap className="w-10 h-10 animate-pulse" />}
                {unlockedBadge.name === "Civic Hero" && <ShieldCheck className="w-10 h-10" />}
                {unlockedBadge.name === "Community Helper" && <Users className="w-10 h-10" />}
              </div>
              <div className="absolute -top-1 -right-1 bg-amber-400 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                New Badge!
              </div>
            </div>

            <span className="text-[10px] font-mono font-black text-amber-500 uppercase tracking-widest block mb-1">
              Achievement Unlocked
            </span>
            
            <h3 className="font-sans font-black text-slate-800 text-xl leading-tight">
              {unlockedBadge.name}
            </h3>
            
            <p className="text-slate-500 text-xs font-sans mt-3 px-2 leading-relaxed">
              Congrats! We Honour you with <strong className="text-slate-800 font-bold">{unlockedBadge.name}</strong> badge
            </p>

            <p className="text-slate-400 text-[11px] font-sans italic mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100/50">
              "{unlockedBadge.desc}"
            </p>

            <div className="mt-6 flex justify-center">
              <button
                id="close-badge-popup-btn"
                onClick={() => setUnlockedBadge(null)}
                className="w-full bg-slate-900 hover:bg-slate-950 active:scale-98 text-white font-sans font-black text-xs py-3 rounded-xl transition-all cursor-pointer shadow-md uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔒 Compulsory Citizen Verification PIN Overlay Modal */}
      {verifyingIssueId && (
        <div id="compulsory-verify-auth-overlay" className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-100 relative overflow-hidden transform animate-in zoom-in-95 duration-200">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            
            <div className="flex flex-col items-center text-center">
              {/* Shield Icon */}
              <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 text-emerald-600 mb-5 relative">
                <span className="absolute inset-0 rounded-2xl bg-emerald-500/10 animate-ping" />
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>

              <h2 className="font-sans font-black text-slate-900 text-lg leading-tight uppercase tracking-tight">
                Citizen Authentication Required
              </h2>
              
              <p className="text-slate-500 text-xs font-sans mt-3 px-1 leading-relaxed">
                To securely authenticate your community verification vote and prevent spoofing, please confirm your identity by entering your secure <strong className="text-slate-800 font-bold">6-digit DigiLocker / Aadhar security PIN</strong>.
              </p>

              {/* Pin Input */}
              <div className="mt-6 w-full text-left">
                <label className="block text-[10px] font-mono font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
                  6-Digit Security PIN
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={verificationPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setVerificationPin(val);
                    setVerificationError(null);
                  }}
                  placeholder="••••••"
                  className="w-full text-center tracking-[1.5em] text-lg font-mono font-black py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:bg-white transition-all text-slate-800"
                />
                
                {verificationError && (
                  <p className="mt-2 text-rose-500 text-[11px] font-medium leading-tight text-center">
                    ⚠️ {verificationError}
                  </p>
                )}

                <p className="mt-1.5 text-[9px] text-slate-400 font-mono text-center">
                  Default sandbox PIN: 123456
                </p>
              </div>

              {/* Actions */}
              <div className="mt-6 grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={() => setVerifyingIssueId(null)}
                  disabled={isVerifyingAuth}
                  className="bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-600 font-sans font-black text-xs py-3.5 rounded-xl transition-all cursor-pointer border border-slate-200 uppercase tracking-wider disabled:opacity-55"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmVerificationAuth}
                  disabled={isVerifyingAuth || verificationPin.length !== 6}
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-sans font-black text-xs py-3.5 rounded-xl transition-all cursor-pointer shadow-md uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-55 disabled:cursor-not-allowed"
                >
                  {isVerifyingAuth ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "Authorize"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
      )}
    </>
  );
}
