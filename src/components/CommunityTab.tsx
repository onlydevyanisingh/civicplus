import { useState, useEffect, useMemo, ChangeEvent } from "react";
import { 
  Award, Flame, Users, CheckCircle2, ShieldAlert, Zap, Medal, Star, ShieldCheck, 
  UserCircle, Upload, Camera, Globe, Lock, Check, Sparkles, X, Edit2, ArrowRight 
} from "lucide-react";
import { UserState, CivicIssue } from "../types";

interface CommunityTabProps {
  user: UserState;
  onUpdateProfile?: (updated: UserState) => void;
  issues: CivicIssue[];
}

export default function CommunityTab({ user, onUpdateProfile, issues }: CommunityTabProps) {
  // Compute user dynamic badge
  const userBadge = useMemo(() => {
    const userIssues = issues.filter(i => i.id.startsWith("issue-custom-"));
    const resolvedUserIssues = userIssues.filter(i => i.status === "resolved").length;
    const underInspectionCount = userIssues.filter(i => i.status === "in-progress" || i.status === "resolved").length;
    const highPriorityCount = userIssues.filter(i => (i.severity === "High" || i.severity === "Critical" || i.urgency === "High" || i.urgency === "Critical")).length;

    const isEcoGuardian = resolvedUserIssues >= 5;
    const isChangeMaker = underInspectionCount >= 5;
    const isCivicHero = highPriorityCount >= 5;

    if (isEcoGuardian) {
      return { name: "Eco Guardian", icon: "Flame", color: "from-rose-400 to-pink-500", desc: "Awarded when 5+ reported issues by user gets completely resolved." };
    }
    if (isChangeMaker) {
      return { name: "Change Maker", icon: "Zap", color: "from-emerald-400 to-teal-500", desc: "Awarded when 5+ reported issues by user gets inspection started status." };
    }
    if (isCivicHero) {
      return { name: "Civic Hero", icon: "ShieldCheck", color: "from-amber-400 to-orange-500", desc: "Granted for filing 5+ high-priority issues that garner community consensus." };
    }
    return { name: "Community Helper", icon: "Users", color: "from-blue-400 to-indigo-500", desc: "Unlocked by verifying at least 5 local municipal complaints." };
  }, [user.points, user.verifiedCount, issues]);

  // Profile Form States initialized from user
  const [editName, setEditName] = useState(user.name || "");
  const [editAge, setEditAge] = useState<string | number>(user.age || "");
  const [editAadhar, setEditAadhar] = useState(user.aadharId || "");
  const [editCity, setEditCity] = useState(user.city || "");
  const [editCountry, setEditCountry] = useState(user.country || "");
  const [editProfilePic, setEditProfilePic] = useState(user.profilePic || "");
  const [editEmail, setEditEmail] = useState(user.email || "");
  const [profileErrors, setProfileErrors] = useState<{ [key: string]: string }>({});
  const [isSavedSuccessfully, setIsSavedSuccessfully] = useState(false);

  // Google Simulated Auth state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [googleAuthSuccess, setGoogleAuthSuccess] = useState(false);

  // Sub-tab selection state (Community vs User Profile)
  const [activeSubTab, setActiveSubTab] = useState<"Community" | "Profile">("Community");

  // Sync edit state with incoming user changes (e.g. from app updates)
  useEffect(() => {
    setEditName(user.name || "");
    setEditAge(user.age || "");
    setEditAadhar(user.aadharId || "");
    setEditCity(user.city || "");
    setEditCountry(user.country || "");
    setEditProfilePic(user.profilePic || "");
    setEditEmail(user.email || "");
  }, [user]);

  // Handle uploader
  const handleProfilePicChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditProfilePic(reader.result as string);
        setIsSavedSuccessfully(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Live city look-up helper
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

  // Submit Handler
  const handleSaveProfile = () => {
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
      setIsSavedSuccessfully(false);
      return;
    }

    setProfileErrors({});
    if (onUpdateProfile) {
      onUpdateProfile({
        ...user,
        name: editName.trim(),
        email: editEmail.trim() || user.email,
        age: parseInt(editAge.toString(), 10),
        aadharId: editAadhar.trim(),
        city: editCity.trim(),
        country: editCountry.trim(),
        profilePic: editProfilePic
      });
      setIsSavedSuccessfully(true);
      setTimeout(() => setIsSavedSuccessfully(false), 4000);
    }
  };

  // Dynamic Leaderboard (user rank is updated dynamically)
  const leaderboard = useMemo(() => {
    return [
      { rank: 1, name: "Aarav Sharma", points: 840, reported: 12, verified: 28, badge: "Eco Guardian", isCurrentUser: false },
      { rank: 2, name: "Ananya Verma", points: 620, reported: 8, verified: 19, badge: "Change Maker", isCurrentUser: false },
      { rank: 3, name: user.name || user.email, points: user.points, reported: user.reportedCount, verified: user.verifiedCount, badge: userBadge.name, isCurrentUser: true },
      { rank: 4, name: "Rahul Singh", points: 410, reported: 5, verified: 15, badge: "Community Helper", isCurrentUser: false },
      { rank: 5, name: "Pooja Gupta", points: 350, reported: 4, verified: 11, badge: "Community Helper", isCurrentUser: false },
      { rank: 6, name: "Priyanshu Patel", points: 290, reported: 3, verified: 9, badge: "Community Helper", isCurrentUser: false },
      { rank: 7, name: "Aditi Rao", points: 240, reported: 2, verified: 8, badge: "Civic Hero", isCurrentUser: false },
      { rank: 8, name: "Amit Dwivedi", points: 180, reported: 2, verified: 5, badge: "Community Helper", isCurrentUser: false },
      { rank: 9, name: "Sneha Mishra", points: 150, reported: 1, verified: 4, badge: "Community Helper", isCurrentUser: false },
      { rank: 10, name: "Vikram Pandey", points: 95, reported: 1, verified: 2, badge: "Civic Hero", isCurrentUser: false },
    ].sort((a, b) => b.points - a.points)
     .map((item, idx) => ({ ...item, rank: idx + 1 }))
     .slice(0, 10);
  }, [user, userBadge]);

  // Badges Ledger definitions
  const badges = useMemo(() => {
    const userIssues = issues.filter(i => i.id.startsWith("issue-custom-"));
    const resolvedUserIssues = userIssues.filter(i => i.status === "resolved").length;
    const underInspectionCount = userIssues.filter(i => i.status === "in-progress" || i.status === "resolved").length;
    const highPriorityCount = userIssues.filter(i => (i.severity === "High" || i.severity === "Critical" || i.urgency === "High" || i.urgency === "Critical")).length;

    return [
      {
        id: "b1",
        name: "Community Helper",
        desc: "Unlocked by verifying at least 5 local municipal complaints.",
        requirement: "5+ verifications",
        icon: Users,
        color: "from-blue-400 to-indigo-500",
        unlocked: user.verifiedCount >= 5 || user.points >= 150,
      },
      {
        id: "b2",
        name: "Civic Hero",
        desc: "Granted for filing 5+ high-priority issues that garner community consensus.",
        requirement: "Report 5+ High-priority issues",
        icon: ShieldCheck,
        color: "from-amber-400 to-orange-500",
        unlocked: highPriorityCount >= 5,
      },
      {
        id: "b3",
        name: "Change Maker",
        desc: "Awarded when 5+ reported issues by user gets inspection started status.",
        requirement: "5+ reported issues under inspection",
        icon: Zap,
        color: "from-emerald-400 to-teal-500",
        unlocked: underInspectionCount >= 5,
      },
      {
        id: "b4",
        name: "Eco Guardian",
        desc: "Awarded when 5+ reported issues by user gets completely resolved.",
        requirement: "5+ reported issues resolved",
        icon: Flame,
        color: "from-rose-400 to-pink-500",
        unlocked: resolvedUserIssues >= 5,
      }
    ];
  }, [user, issues]);

  return (
    <div id="community-page-container" className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 font-sans">
      
      {/* Sub-tab segmented bar */}
      <div id="community-sub-tabs" className="bg-slate-100/85 p-1 rounded-2xl flex gap-1.5 max-w-md mx-auto border border-slate-200/50 shadow-2xs mb-4">
        <button
          onClick={() => setActiveSubTab("Community")}
          className={`flex-1 py-2.5 rounded-xl font-sans font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer text-center ${
            activeSubTab === "Community"
              ? "bg-white text-emerald-800 shadow-xs border border-slate-200/10"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          🏆 Community Standings
        </button>
        <button
          onClick={() => setActiveSubTab("Profile")}
          className={`flex-1 py-2.5 rounded-xl font-sans font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer text-center ${
            activeSubTab === "Profile"
              ? "bg-white text-emerald-800 shadow-xs border border-slate-200/10"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          👤 Edit Profile Details
        </button>
      </div>

      {activeSubTab === "Community" ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Leaderboard Bento Frame */}
          <div id="leaderboard-card-container" className="bg-white rounded-3xl border border-slate-100 shadow-md p-6">
            <div className="mb-6 flex items-center justify-between gap-4 flex-wrap text-left">
              <div>
                <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase">Wards Standings</span>
                <h3 className="font-sans font-bold text-slate-800 text-base mt-0.5 flex items-center gap-2">
                  <Medal className="w-4.5 h-4.5 text-emerald-600" />
                  🏆 Top Civic Contributors
                </h3>
                <p className="text-slate-400 text-[11px] font-sans mt-0.5">Top performing citizens ranked by report quality and verification consensus.</p>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold px-3 py-1 rounded-full">
                Active: 2,408 citizens
              </span>
            </div>

            {/* Standings Table */}
            <div className="divide-y divide-slate-100 overflow-hidden">
              {leaderboard.map((item) => (
                <div
                  key={item.name}
                  className={`py-3 flex items-center justify-between gap-4 transition-all px-2 rounded-xl ${
                    item.isCurrentUser ? "bg-emerald-50/20 border border-emerald-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Ranking Medals */}
                    <div className="w-7 h-7 flex items-center justify-center shrink-0">
                      {item.rank === 1 ? (
                        <span className="text-xl">🥇</span>
                      ) : item.rank === 2 ? (
                        <span className="text-xl">🥈</span>
                      ) : item.rank === 3 ? (
                        <span className="text-xl">🥉</span>
                      ) : (
                        <span className="font-mono text-slate-400 font-bold text-xs">#{item.rank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-sans font-bold text-xs shrink-0 border border-slate-100 ${
                      item.isCurrentUser ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700"
                    }`}>
                      {item.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Name & Badge */}
                    <div className="min-w-0 text-left">
                      <span className={`font-sans font-semibold text-xs text-slate-800 block truncate ${
                        item.isCurrentUser ? "font-bold" : ""
                      }`}>
                        {item.name} {item.isCurrentUser && <span className="text-[9px] text-emerald-600 font-bold">(You)</span>}
                      </span>
                      <span className="text-[10.5px] text-slate-400 font-sans flex items-center gap-1 mt-0.5">
                        <Medal className="w-3.5 h-3.5 text-amber-500" />
                        Honorary badge: <strong>{item.badge}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Contributor Score Metrics */}
                  <div className="flex items-center gap-6 text-right">
                    <div className="hidden sm:block">
                      <span className="text-[9px] text-slate-400 uppercase font-sans">Reported / Verified</span>
                      <p className="font-mono text-slate-600 text-xs font-semibold mt-0.2">
                        {item.reported} / {item.verified}
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-sans">Score Balance</span>
                      <p className="font-display font-black text-slate-800 text-sm tracking-tight">
                        {item.points} <span className="text-[10px] text-slate-400 font-sans">XP</span>
                      </p>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>

          {/* Badges Vault Section */}
          <div id="badges-vault-cell" className="bg-white rounded-3xl border border-slate-100 shadow-md p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between text-left">
              <div>
                <h3 className="font-sans font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  🏅 Civic+ Honour Badges
                </h3>
                <p className="text-slate-400 text-[10.5px] font-sans mt-0.5">Complete local community challenges to unlock municipal badges.</p>
              </div>
              <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-100">
                Achievements Ledger
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left">
              {badges.map((badge) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.id}
                    className={`border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                      badge.unlocked 
                        ? "bg-slate-50/50 border-slate-100 hover:scale-[1.02] hover:shadow-xs" 
                        : "bg-slate-100/30 border-slate-100 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${badge.color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {badge.unlocked ? (
                        <span className="bg-emerald-50 text-emerald-600 text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-emerald-100">
                          ✓ Earned
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-400 text-[8.5px] font-medium px-1.5 py-0.5 rounded-full">
                          Locked
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <h4 className="font-sans font-bold text-xs text-slate-800 leading-tight">
                        {badge.name}
                      </h4>
                      <p className="text-slate-550 text-[10px] leading-tight font-sans mt-1 line-clamp-2">
                        {badge.desc}
                      </p>
                      <span className="text-[9px] text-emerald-600 font-mono font-semibold block mt-1.5">
                        Goal: {badge.requirement}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* 📝 Details Editing Section Directly On Page */}
          <div id="inline-profile-details-editor" className="bg-white rounded-3xl border border-slate-100 shadow-md p-6">
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-sans font-bold text-slate-800 text-base">Edit Citizen Profile Details</h3>
                  <p className="text-slate-400 text-[11px] font-sans">Manage your personal municipal profile data, verified identity records, and avatar credentials directly on-page.</p>
                </div>
              </div>
              <span className="text-[9.5px] bg-slate-50 text-slate-500 font-bold px-2.5 py-1 rounded-md border border-slate-200">
                Secure Form
              </span>
            </div>

            {isSavedSuccessfully && (
              <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-3 flex items-center gap-2 text-xs font-semibold animate-in fade-in duration-200">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3px]" />
                <span>Profile details updated and saved successfully! Your identity records are fully synced.</span>
              </div>
            )}

            <div className="grid grid-cols-1 grid-cols-12 md:grid-cols-12 gap-6 items-start">
              {/* Column A: Picture & Bio Appreciation */}
              <div className="col-span-12 md:col-span-4 space-y-4">
                <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-2xl flex flex-col items-center text-center">
                  <div className="relative w-20 h-20 rounded-full bg-slate-200 border-2 border-slate-300 flex items-center justify-center text-slate-400 overflow-hidden mb-3 shadow-inner">
                    {editProfilePic ? (
                      <img src={editProfilePic} className="w-full h-full object-cover" alt="Profile" referrerPolicy="no-referrer" />
                    ) : (
                      <Camera className="w-8 h-8 text-slate-400" />
                    )}
                    <label className="absolute inset-0 bg-black/50 text-white text-[9.5px] font-extrabold flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                      <Upload className="w-4 h-4 mb-0.5" />
                      <span>Upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleProfilePicChange} 
                      />
                    </label>
                  </div>
                  <span className="text-[11.5px] font-bold text-slate-800">Avatar Photo</span>
                  <p className="text-[10px] text-slate-400 leading-normal mt-0.5 max-w-[180px]">
                    Support PNG or JPEG files. Max 2MB. Hover to edit picture.
                  </p>
                  {editProfilePic && (
                    <button 
                      onClick={() => { setEditProfilePic(""); setIsSavedSuccessfully(false); }}
                      className="text-[10px] text-rose-500 hover:underline font-bold mt-2"
                    >
                      Remove photo
                    </button>
                  )}
                </div>

                {/* AI Appreciation companion box */}
                <div className="bg-gradient-to-r from-emerald-500/5 to-teal-500/5 border border-emerald-100/50 rounded-2xl p-4 text-left">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4.5 h-4.5 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="text-[9.5px] font-sans font-black text-emerald-700 tracking-wider uppercase block leading-none mb-1">
                        AI Active Rating
                      </span>
                      <p className="text-[10.5px] text-slate-700 leading-normal italic font-medium">
                        {user.points >= 300 
                          ? "🏆 Elite Vanguard! Your dedicated reports and consensus checks keep our ward health top-notch."
                          : user.points >= 200
                            ? "🤝 Star Contributor! Your verification reviews help establish community trust across districts."
                            : "🌟 Rising Catalyst! Varanasi is safer and cleaner because of your participation."
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Column B: Editable Profile Fields Form */}
              <div className="col-span-12 md:col-span-8 space-y-4 text-left">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Full Name */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        if (profileErrors.name) setProfileErrors({ ...profileErrors, name: "" });
                        setIsSavedSuccessfully(false);
                      }}
                      placeholder="Enter your full name"
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                        profileErrors.name ? 'border-rose-300 focus:ring-1 focus:ring-rose-500 bg-rose-50/10' : 'border-slate-200 focus:ring-1 focus:ring-emerald-500 focus:bg-white'
                      }`}
                    />
                    {profileErrors.name && (
                      <p className="text-[9.5px] text-rose-500 font-bold mt-1">{profileErrors.name}</p>
                    )}
                  </div>

                  {/* Age */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Age <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={editAge}
                      onChange={(e) => {
                        setEditAge(e.target.value);
                        if (profileErrors.age) setProfileErrors({ ...profileErrors, age: "" });
                        setIsSavedSuccessfully(false);
                      }}
                      placeholder="Enter your age"
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                        profileErrors.age ? 'border-rose-300 focus:ring-1 focus:ring-rose-500 bg-rose-50/10' : 'border-slate-200 focus:ring-1 focus:ring-emerald-500 focus:bg-white'
                      }`}
                    />
                    {profileErrors.age && (
                      <p className="text-[9.5px] text-rose-500 font-bold mt-1">{profileErrors.age}</p>
                    )}
                  </div>

                  {/* Valid Aadhar ID */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Valid Aadhar ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      maxLength={12}
                      value={editAadhar}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        setEditAadhar(val);
                        if (profileErrors.aadhar) setProfileErrors({ ...profileErrors, aadhar: "" });
                        setIsSavedSuccessfully(false);
                      }}
                      placeholder="Enter 12-digit Aadhar ID"
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono focus:outline-none transition-all ${
                        profileErrors.aadhar ? 'border-rose-300 focus:ring-1 focus:ring-rose-500 bg-rose-50/10' : 'border-slate-200 focus:ring-1 focus:ring-emerald-500 focus:bg-white'
                      }`}
                    />
                    {profileErrors.aadhar && (
                      <p className="text-[9.5px] text-rose-500 font-bold mt-1">{profileErrors.aadhar}</p>
                    )}
                  </div>

                  {/* Country */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Country <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editCountry}
                      onChange={(e) => {
                        setEditCountry(e.target.value);
                        if (profileErrors.country) setProfileErrors({ ...profileErrors, country: "" });
                        setIsSavedSuccessfully(false);
                      }}
                      placeholder="Your country"
                      className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                        profileErrors.country ? 'border-rose-300 focus:ring-1 focus:ring-rose-500 bg-rose-50/10' : 'border-slate-200 focus:ring-1 focus:ring-emerald-500 focus:bg-white'
                      }`}
                    />
                    {profileErrors.country && (
                      <p className="text-[9.5px] text-rose-500 font-bold mt-1">{profileErrors.country}</p>
                    )}
                  </div>

                  {/* City with Live Location */}
                  <div className="col-span-12 sm:col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      City (Live Location Lookup) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex gap-2.5">
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => {
                          setEditCity(e.target.value);
                          if (profileErrors.city) setProfileErrors({ ...profileErrors, city: "" });
                          setIsSavedSuccessfully(false);
                        }}
                        placeholder="Your city"
                        className={`flex-1 px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold focus:outline-none transition-all ${
                          profileErrors.city ? 'border-rose-300 focus:ring-1 focus:ring-rose-500 bg-rose-50/10' : 'border-slate-200 focus:ring-1 focus:ring-emerald-500 focus:bg-white'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => { handleGetLiveCityForProfile(); setIsSavedSuccessfully(false); }}
                        className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl text-[10.5px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Get GPS Location</span>
                      </button>
                    </div>
                    {profileErrors.city && (
                      <p className="text-[9.5px] text-rose-500 font-bold mt-1">{profileErrors.city}</p>
                    )}
                  </div>

                  {/* Registered Email (Locked / Google auth simulated action) */}
                  <div className="col-span-12 sm:col-span-2 pt-1 border-t border-slate-50 mt-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Registered Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 select-none">
                        <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{editEmail}</span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => setShowGoogleModal(true)}
                        className="bg-white hover:bg-slate-50 border border-slate-200 py-2 px-3.5 rounded-xl text-[10.5px] font-black text-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-3xs active:scale-98 whitespace-nowrap"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        <span>Change Email via Google</span>
                      </button>
                    </div>
                  </div>

                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-black text-xs py-2.5 px-6 rounded-xl transition-all cursor-pointer shadow-sm active:scale-98 animate-pulse"
                  >
                    Save Profile Details
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Profiles HUD row - Full Width User Profile Banner AT THE BOTTOM ONLY */}
          <div id="user-community-profile-card" className="bg-gradient-to-br from-slate-800 to-slate-950 text-slate-100 rounded-3xl border border-slate-800 shadow-xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row items-center gap-5 z-10 w-full md:w-auto">
              {editProfilePic ? (
                <img src={editProfilePic} className="w-16 h-16 rounded-2xl object-cover border border-emerald-500 shrink-0 shadow-md animate-in fade-in" alt="Avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center font-sans font-black text-white text-2xl shadow-md border border-white/10 shrink-0">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-center md:text-left min-w-0">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 font-mono text-[9px] px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-bold uppercase tracking-widest animate-pulse">
                    Citizen Identity Verified
                  </span>
                  <div className="flex items-center gap-1 bg-slate-900/40 px-2 py-0.5 rounded-full border border-slate-800">
                    <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
                    <span className="font-mono text-[10px] text-orange-300 font-bold">{user.streak} Day Streak</span>
                  </div>
                </div>
                <h3 className="font-sans font-bold text-white text-lg md:text-xl truncate mt-2">
                  {user.name || "Active Citizen"}
                </h3>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-3 gap-y-1 mt-1 text-xs text-slate-400">
                  <span>{user.email}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-medium">{user.city || "Varanasi"}, {user.country || "IN"}</span>
                  {user.aadharId && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-amber-300 font-mono" id="community-aadhar-display">Aadhaar: {user.aadharId.trim().replace(/(\d{4})/g, '$1 ').trim()}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Dynamic Earned Badge Panel directly inside User Card */}
            <div className="flex items-center gap-3.5 bg-slate-900/50 border border-slate-800 rounded-2xl p-3.5 z-10 max-w-sm w-full md:w-auto shrink-0">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${userBadge.color} flex items-center justify-center text-white shrink-0 shadow-sm relative`}>
                {userBadge.icon === "Zap" && <Zap className="w-5.5 h-5.5 text-white fill-white/10 animate-pulse" />}
                {userBadge.icon === "Flame" && <Flame className="w-5.5 h-5.5 text-white fill-white/10 animate-bounce" />}
                {userBadge.icon === "Users" && <Users className="w-5.5 h-5.5 text-white fill-white/10" />}
                {userBadge.icon === "ShieldCheck" && <ShieldCheck className="w-5.5 h-5.5 text-white fill-white/10 animate-bounce" />}
              </div>
              <div className="text-left">
                <span className="text-[8px] text-amber-400 font-sans block font-extrabold uppercase tracking-wider">
                  Earned Honor Badge
                </span>
                <strong className="text-sm font-sans font-black text-white leading-none block">
                  {userBadge.name}
                </strong>
                <span className="text-[9.5px] text-emerald-400 mt-1 font-mono font-black block">
                  {user.points} XP Highlighted
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 z-10 w-full md:w-auto justify-center md:justify-end">
              <div className="grid grid-cols-2 gap-3 min-w-[200px]">
                <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-900 text-center md:text-left">
                  <span className="text-[9px] text-slate-400 font-sans block uppercase">Reported Issues</span>
                  <strong className="font-mono text-white text-base">{user.reportedCount}</strong>
                </div>
                <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-900 text-center md:text-left">
                  <span className="text-[9px] text-slate-400 font-sans block uppercase">Verifications</span>
                  <strong className="font-mono text-white text-base">{user.verifiedCount}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simulated Google Authentication Modal (Scoped internally inside tab) */}
      {showGoogleModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 animate-in zoom-in-95 duration-200 text-slate-800">
            {/* Google Brand Header */}
            <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
              <svg className="w-9 h-9 mb-3" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <h3 className="font-display font-black text-slate-800 text-base">Sign in with Google</h3>
              <p className="text-[11px] text-slate-400 font-sans mt-1">to continue to Civic+</p>
            </div>

            {googleAuthLoading ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-500 font-bold">Connecting to accounts.google.com...</span>
              </div>
            ) : googleAuthSuccess ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
                  <Check className="w-6 h-6 stroke-[3px]" />
                </div>
                <span className="text-xs font-black text-emerald-700">Authenticated successfully!</span>
                <p className="text-[10px] text-slate-550">Your profile email has been updated.</p>
              </div>
            ) : (
              <div className="py-4 space-y-3">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Choose an account:</p>
                
                {/* Simulated Google Accounts */}
                <div className="space-y-1.5">
                  {[
                    "sunflowerr.flowerr25@gmail.com",
                    "sunflowerr.civic@gmail.com",
                    "sunflowerr.google@gmail.com"
                  ].map((emailOpt) => (
                    <button
                      key={emailOpt}
                      onClick={() => {
                        setGoogleAuthLoading(true);
                        setTimeout(() => {
                          setGoogleAuthLoading(false);
                          setGoogleAuthSuccess(true);
                          setEditEmail(emailOpt);
                          // trigger update to parent instantly
                          if (onUpdateProfile) {
                            onUpdateProfile({ ...user, email: emailOpt });
                          }
                          setTimeout(() => {
                            setGoogleAuthSuccess(false);
                            setShowGoogleModal(false);
                          }, 1200);
                        }, 1000);
                      }}
                      className="w-full p-2.5 text-left text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[9px] uppercase">
                        {emailOpt.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{emailOpt}</span>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setShowGoogleModal(false)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
