import { useState, useEffect, useMemo, useRef } from "react";
import { CivicIssue, UserState } from "../types";
import { 
  PlusCircle, Map, List, Trophy, BarChart3, AlertCircle, CheckCircle2, Users, Flame, Heart, ArrowRight, ShieldAlert, Sparkles, Award, AlertTriangle, Check, X, Zap, ShieldCheck
} from "lucide-react";

interface HomeTabProps {
  issues: CivicIssue[];
  onNavigateToTab: (tabName: string, id?: string) => void;
  onVerify: (id: string) => void;
  userLocation: { lat: number; lng: number };
  cityName: string;
  currentWard: string;
  user: UserState;
  onClaimDailyCheckIn?: () => void;
}

// Haversine formula helper to calculate distance in meters
function getDistanceInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

// Dynamic municipal ward name mapper based on locality and city location
function getDynamicWardName(locality: string, currentCity: string): string {
  const loc = locality.toLowerCase();
  const city = currentCity || "Varanasi";
  
  // If city is Varanasi, return Varanasi's real wards
  if (city.toLowerCase().includes("varanasi")) {
    if (loc.includes("assi")) return "Assi Ward";
    if (loc.includes("lanka")) return "Lanka Ward";
    if (loc.includes("bhu") || loc.includes("nagwa")) return "Nagwa Ward";
    if (loc.includes("godowlia") || loc.includes("dashaswamedh")) return "Dashaswamedh Ward";
    if (loc.includes("sigra")) return "Sigra Ward";
    return "Kashi Ward";
  }

  // If city is New Delhi
  if (city.toLowerCase().includes("delhi")) {
    if (loc.includes("assi")) return "Chanakyapuri Ward";
    if (loc.includes("lanka")) return "Connaught Place Ward";
    if (loc.includes("bhu") || loc.includes("nagwa")) return "Vasant Kunj Ward";
    if (loc.includes("godowlia") || loc.includes("dashaswamedh")) return "Karol Bagh Ward";
    if (loc.includes("sigra")) return "Dwarka Ward";
    return "New Delhi Ward";
  }

  // If city is Bengaluru
  if (city.toLowerCase().includes("bengaluru") || city.toLowerCase().includes("bangalore")) {
    if (loc.includes("assi")) return "Indiranagar Ward";
    if (loc.includes("lanka")) return "Koramangala Ward";
    if (loc.includes("bhu") || loc.includes("nagwa")) return "Jayanagar Ward";
    if (loc.includes("godowlia") || loc.includes("dashaswamedh")) return "Malleshwaram Ward";
    if (loc.includes("sigra")) return "Whitefield Ward";
    return "Bengaluru Central Ward";
  }

  // If city is San Francisco
  if (city.toLowerCase().includes("francisco") || city.toLowerCase().includes("sf")) {
    if (loc.includes("assi")) return "Mission District Ward";
    if (loc.includes("lanka")) return "SOMA District Ward";
    if (loc.includes("bhu") || loc.includes("nagwa")) return "Presidio Ward";
    if (loc.includes("godowlia") || loc.includes("dashaswamedh")) return "Haight-Ashbury Ward";
    if (loc.includes("sigra")) return "Castro District Ward";
    return "Downtown Ward";
  }

  // For any other city in the world, make it beautifully dynamic!
  const capitalizedCity = city.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  if (loc.includes("assi")) return `${capitalizedCity} East Ward`;
  if (loc.includes("lanka")) return `${capitalizedCity} South Ward`;
  if (loc.includes("bhu") || loc.includes("nagwa")) return `${capitalizedCity} North Ward`;
  if (loc.includes("godowlia") || loc.includes("dashaswamedh")) return `${capitalizedCity} Central Ward`;
  if (loc.includes("sigra")) return `${capitalizedCity} Metro Ward`;

  // If the locality is already a nice dynamic ward name (e.g. from Nominatim)
  if (locality && locality !== "Local" && locality !== "Lanka" && locality !== "Assi" && locality !== "BHU Gate") {
    let formatted = locality;
    if (!formatted.toLowerCase().includes("ward") && !formatted.toLowerCase().includes("district")) {
      formatted = `${formatted} Ward`;
    }
    return formatted;
  }
  return `${capitalizedCity} Ward`;
}

// Helper to determine if an issue belongs to a city
function isIssueInCity(issue: CivicIssue, city: string): boolean {
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
}

// Helper to get area name using "Near [nearest landmark name]" for cities without explicit ward names
function getIssueAreaName(issue: CivicIssue, currentCity: string): string {
  const city = currentCity || "Varanasi";
  const cityLower = city.toLowerCase();
  
  const isExplicitCity = cityLower.includes("varanasi") || 
                         cityLower.includes("delhi") || 
                         cityLower.includes("bengaluru") || 
                         cityLower.includes("bangalore") || 
                         cityLower.includes("francisco") || 
                         cityLower.includes("sf");

  if (!isExplicitCity) {
    // Try to find a "near [place]" pattern in title or description
    const titleMatch = issue.title.match(/(?:near|opposite|at|beside|behind|outside|by)\s+([A-Za-z0-9\s]+)/i);
    if (titleMatch && titleMatch[1]) {
      const landmark = titleMatch[1].trim().split(/\s{2,}/)[0];
      if (landmark.length > 2 && landmark.length < 30) {
        return `Near ${landmark.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")}`;
      }
    }

    const descMatch = issue.description.match(/(?:near|opposite|at|beside|behind|outside|by)\s+([A-Za-z0-9\s,]+)/i);
    if (descMatch && descMatch[1]) {
      const landmark = descMatch[1].trim().split(/[.,]/)[0].trim();
      if (landmark.length > 2 && landmark.length < 30) {
        return `Near ${landmark.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")}`;
      }
    }

    if (issue.locality && issue.locality.length > 2 && issue.locality.toLowerCase() !== "local" && !issue.locality.toLowerCase().includes("ward")) {
      return `Near ${issue.locality}`;
    }

    const cat = issue.category.toLowerCase();
    let landmarkFallback = "Transit Hub";
    if (cat.includes("pothole") || cat.includes("road") || cat.includes("infra")) {
      landmarkFallback = "Main Intersection";
    } else if (cat.includes("waste") || cat.includes("garbage") || cat.includes("trash")) {
      landmarkFallback = "Community Market Gate";
    } else if (cat.includes("water") || cat.includes("leak") || cat.includes("drain")) {
      landmarkFallback = "Public Park Entrance";
    } else if (cat.includes("light") || cat.includes("street")) {
      landmarkFallback = "Bus Stop";
    }

    return `Near ${landmarkFallback}`;
  }

  // If it is an explicit city, use getDynamicWardName
  return getDynamicWardName(issue.locality, city);
}

// Helper to map complex category names into short, punchy terms for tasks
function getShortCategory(category: string): string {
  const cat = (category || "").toLowerCase();
  if (cat.includes("pothole")) return "Pothole";
  if (cat.includes("light") || cat.includes("streetlight") || cat.includes("dark")) return "Dark Zone";
  if (cat.includes("water") || cat.includes("leak") || cat.includes("sew")) return "Water Leak";
  if (cat.includes("waste") || cat.includes("garbage") || cat.includes("trash") || cat.includes("dump")) return "Garbage";
  if (cat.includes("road") || cat.includes("infra") || cat.includes("sidewalk")) return "Road Hazard";
  return "Civic Issue";
}

export default function HomeTab({ issues, onNavigateToTab, onVerify, userLocation, cityName, currentWard, user, onClaimDailyCheckIn }: HomeTabProps) {
  const cityIssues = useMemo(() => {
    return issues.filter(issue => isIssueInCity(issue, cityName));
  }, [issues, cityName]);

  const activeCitizensCount = useMemo(() => {
    const base = cityName.toLowerCase().includes("varanasi") ? 2408 :
                 cityName.toLowerCase().includes("delhi") ? 8912 :
                 cityName.toLowerCase().includes("bengaluru") || cityName.toLowerCase().includes("bangalore") ? 12450 :
                 cityName.toLowerCase().includes("francisco") || cityName.toLowerCase().includes("sf") ? 4120 :
                 Math.max(150, (cityName.length * 115) % 1000 + 45);
    
    // Add dynamic variation based on city-specific issue verifications
    const customVerifications = cityIssues.reduce((acc, issue) => acc + (issue.verificationCount || 0), 0);
    return base + customVerifications + cityIssues.length * 4;
  }, [cityName, cityIssues]);

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

  const userRank = useMemo(() => {
    const players = [
      { name: "Aarav Sharma", points: 840 },
      { name: "Ananya Verma", points: 620 },
      { name: "You", points: user.points || 0 },
      { name: "Rahul Singh", points: 410 },
      { name: "Pooja Gupta", points: 350 },
      { name: "Priyanshu Patel", points: 290 },
      { name: "Aditi Rao", points: 240 },
      { name: "Amit Dwivedi", points: 180 },
      { name: "Sneha Mishra", points: 150 },
      { name: "Vikram Pandey", points: 95 },
    ];
    players.sort((a, b) => b.points - a.points);
    const idx = players.findIndex((p) => p.name === "You");
    return idx !== -1 ? idx + 1 : 3;
  }, [user.points]);

  const dailyQuote = useMemo(() => {
    const quotes = [
      {
        text: "The best way to find yourself is to lose yourself in the service of others.",
        author: "Mahatma Gandhi",
        img: "https://images.unsplash.com/photo-1561361513-2d000a50f0db?auto=format&fit=crop&w=600&q=80"
      },
      {
        text: "Never doubt that a small group of thoughtful, committed citizens can change the world.",
        author: "Margaret Mead",
        img: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80"
      },
      {
        text: "Citizenship is a tough occupation which requires more than just voting; it requires active participation.",
        author: "Robert F. Kennedy",
        img: "https://images.unsplash.com/photo-1571536802807-30451e3955d8?auto=format&fit=crop&w=600&q=80"
      },
      {
        text: "The greatness of a community is most accurately measured by the compassionate actions of its members.",
        author: "Coretta Scott King",
        img: "https://images.unsplash.com/photo-1605649487212-47bdab064df7?auto=format&fit=crop&w=600&q=80"
      },
      {
        text: "Be the change that you wish to see in your neighborhood and your city today.",
        author: "Mahatma Gandhi",
        img: "https://images.unsplash.com/photo-1561361513-2d000a50f0db?auto=format&fit=crop&w=600&q=80"
      },
      {
        text: "Varanasi shines brightest when its citizens work together to uplift every street and ward.",
        author: "Kashi Civic Guardians",
        img: "https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=600&q=80"
      },
      {
        text: "A clean street is the mirror of a clean mind and a progressive community.",
        author: "Swachh Bharat Mantra",
        img: "https://images.unsplash.com/photo-1571536802807-30451e3955d8?auto=format&fit=crop&w=600&q=80"
      }
    ];
    const now = new Date();
    const day = now.getDate();
    const index = day % quotes.length;
    return quotes[index];
  }, []);

  const [aiTasks, setAiTasks] = useState<{ id: string; text: string; issueId: string; isFresh: boolean }[]>([]);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState<{
    status: string;
    priorityAreas: string;
    hotspot: string;
    prediction: string;
    participation: string;
    recommendation: string;
    confidence: string;
  } | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(false);

  // States for escalation alert and interactive AI advice modal
  const [escalationStatus, setEscalationStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [escalatedScore, setEscalatedScore] = useState<number | null>(null);
  const [isAiAdviceOpen, setIsAiAdviceOpen] = useState(false);

  const lastTasksPayloadRef = useRef<string>("");
  const lastBriefPayloadRef = useRef<string>("");

  const unresolvedIssues = useMemo(() => {
    return cityIssues.filter((i) => i.status !== "resolved");
  }, [cityIssues]);

  useEffect(() => {
    const issuesForTasks = unresolvedIssues.map(issue => {
      const ward = getIssueAreaName(issue, cityName);
      const distance = getDistanceInM(userLocation.lat, userLocation.lng, issue.lat, issue.lng);
      const isFresh = issue.id.startsWith("issue-custom-");
      return {
        id: issue.id,
        category: issue.category,
        locality: ward,
        distance,
        isFresh
      };
    });

    const serializedPayload = JSON.stringify({
      cityName,
      issues: issuesForTasks.map(i => ({
        id: i.id,
        category: i.category,
        isFresh: i.isFresh,
        distanceApprox: Math.round(i.distance / 150) * 150 // round distance to nearest 150m to avoid slight movements re-fetching
      }))
    });

    if (lastTasksPayloadRef.current === serializedPayload) {
      return;
    }
    lastTasksPayloadRef.current = serializedPayload;

    setIsTasksLoading(true);
    fetch("/api/agents/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issues: issuesForTasks, cityName })
    })
      .then(res => res.json())
      .then(data => {
        if (data.tasks && data.tasks.length > 0) {
          setAiTasks(data.tasks);
        }
      })
      .catch(err => {
        console.error("Error loading AI tasks:", err);
        // Clear last ref on error to allow retry
        lastTasksPayloadRef.current = "";
      })
      .finally(() => setIsTasksLoading(false));
  }, [unresolvedIssues, userLocation, cityName]);

  useEffect(() => {
    const serializedBriefPayload = JSON.stringify({
      cityName,
      issues: cityIssues.map(i => ({ id: i.id, category: i.category, status: i.status }))
    });

    if (lastBriefPayloadRef.current === serializedBriefPayload) {
      return;
    }
    lastBriefPayloadRef.current = serializedBriefPayload;

    setIsBriefLoading(true);
    fetch("/api/agents/civic-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issues: cityIssues, cityName })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.status) {
          setAiBrief(data);
        }
      })
      .catch(err => {
        console.error("Error loading AI brief:", err);
        // Clear last ref on error to allow retry
        lastBriefPayloadRef.current = "";
      })
      .finally(() => setIsBriefLoading(false));
  }, [cityIssues, cityName]);

  const helpTasks = useMemo(() => {
    const list: { id: string; text: string; action: () => void; isVerify?: boolean }[] = [];

    // Find the closest unresolved issue in user's city
    const unresolved = cityIssues.filter(i => i.status !== "resolved");
    let closestIssue: CivicIssue | null = null;
    let minDistance = Infinity;

    unresolved.forEach(issue => {
      const d = getDistanceInM(userLocation.lat, userLocation.lng, issue.lat, issue.lng);
      if (d < minDistance) {
        minDistance = d;
        closestIssue = issue;
      }
    });

    // Task 1: Verify Issue (Only show if distance is < 3000m)
    if (closestIssue && minDistance < 3000) {
      const formattedDist = minDistance < 1000 ? `${minDistance}m` : `${(minDistance / 1000).toFixed(1)}km`;
      const shortCategory = getShortCategory(closestIssue.category);
      list.push({
        id: "help-verify",
        text: `Verify ${shortCategory} (${formattedDist} away)`,
        action: () => onNavigateToTab("Map", closestIssue!.id),
        isVerify: true
      });
    }

    // Task 2: Report a new issue in your area (using nearest landmark name or ward)
    const isExplicit = cityName.toLowerCase().includes("varanasi") || 
                       cityName.toLowerCase().includes("delhi") || 
                       cityName.toLowerCase().includes("bengaluru") || 
                       cityName.toLowerCase().includes("bangalore") || 
                       cityName.toLowerCase().includes("francisco") || 
                       cityName.toLowerCase().includes("sf");
    const areaText = isExplicit ? (currentWard || "your ward") : (closestIssue ? getIssueAreaName(closestIssue, cityName).toLowerCase() : "your area");
    list.push({
      id: "help-report",
      text: `Report new issue in ${areaText}`,
      action: () => onNavigateToTab("Report")
    });

    // Task 3: Track new issue reported
    list.push({
      id: "help-track",
      text: `Track new issue reported`,
      action: () => onNavigateToTab("Track")
    });

    // Task 4: Read AI-advice before you go out
    list.push({
      id: "help-advice",
      text: `Read AI-advice before you go out`,
      action: () => setIsAiAdviceOpen(true)
    });

    return list;
  }, [cityIssues, userLocation, cityName, currentWard]);
  
  // Calculate dynamic overall metrics
  const totalIssues = cityIssues.length;
  const resolvedIssues = cityIssues.filter((i) => i.status === "resolved").length;
  const activeIssues = totalIssues - resolvedIssues;

  // Calculate reports and resolved cases within 30km of user's current live location
  const issuesWithin30km = useMemo(() => {
    return issues.filter((issue) => {
      if (typeof issue.lat !== "number" || typeof issue.lng !== "number") return false;
      const dist = getDistanceInM(userLocation.lat, userLocation.lng, issue.lat, issue.lng);
      return dist <= 30000; // 30 kms in meters
    });
  }, [issues, userLocation]);

  const totalReportsWithin30km = issuesWithin30km.length;
  const resolvedIssuesWithin30km = issuesWithin30km.filter((i) => i.status === "resolved").length;

  // Additional dynamic metrics for the AI-Civic Brief
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const activeThreeDaysIssues = cityIssues.filter(
    (i) => i.status !== "resolved" && new Date(i.createdAt) >= threeDaysAgo
  ).length;
  const activeIssuesCount = activeThreeDaysIssues > 0 ? activeThreeDaysIssues : Math.max(1, cityIssues.filter((i) => i.status !== "resolved").length);

  const localBrief = useMemo(() => {
    const unresolved = cityIssues.filter(i => i.status !== "resolved");
    const resolved = cityIssues.filter(i => i.status === "resolved");
    const total = cityIssues.length;

    // 1. Status
    let status = "🟢 Stable";
    if (unresolved.some(i => i.severity === "Critical" || i.urgency === "Critical")) {
      status = "🔴 Critical";
    } else if (unresolved.length > 2 || unresolved.some(i => i.severity === "High" || i.urgency === "High")) {
      status = "🟡 Alert";
    }

    // 2. Priority Areas
    const categoriesSet = new Set<string>();
    unresolved.forEach(i => {
      const cat = i.category.toLowerCase();
      if (cat.includes("pothole") || cat.includes("road") || cat.includes("infra")) categoriesSet.add("roads");
      if (cat.includes("waste") || cat.includes("garbage") || cat.includes("trash") || cat.includes("dump")) categoriesSet.add("waste");
      if (cat.includes("water") || cat.includes("leak") || cat.includes("drain") || cat.includes("sewer")) categoriesSet.add("drainage");
      if (cat.includes("light") || cat.includes("electricity")) categoriesSet.add("streetlights");
    });
    if (categoriesSet.size === 0) {
      categoriesSet.add("roads").add("waste").add("drainage");
    }
    const priorityAreas = Array.from(categoriesSet).slice(0, 3).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ");

    // 3. Emerging Hotspot
    const wardCounts: Record<string, number> = {};
    unresolved.forEach(i => {
      const w = getIssueAreaName(i, cityName);
      wardCounts[w] = (wardCounts[w] || 0) + 1;
    });
    const isExplicit = cityName.toLowerCase().includes("varanasi") || 
                       cityName.toLowerCase().includes("delhi") || 
                       cityName.toLowerCase().includes("bengaluru") || 
                       cityName.toLowerCase().includes("bangalore") || 
                       cityName.toLowerCase().includes("francisco") || 
                       cityName.toLowerCase().includes("sf");
    let hotspot = isExplicit ? `${cityName || "Varanasi"} Central Ward` : "Near Main Intersection";
    let maxCount = 0;
    Object.keys(wardCounts).forEach(w => {
      if (wardCounts[w] > maxCount) {
        maxCount = wardCounts[w];
        hotspot = w;
      }
    });

    // 4. Prediction
    let prediction = `Infrastructure status remains highly stable; zero critical alerts anticipated over the next 48 hours.`;
    if (categoriesSet.has("waste")) {
      prediction = `Slight upward pressure on solid waste clearing times expected near markets due to heavy weekend traffic; drainage flows look highly stable.`;
    } else if (categoriesSet.has("drainage")) {
      prediction = `Minor stormwater logging expected near low-lying intersections; rapid community verification will bypass local system latency.`;
    } else if (categoriesSet.has("roads")) {
      prediction = `Localized transport delays likely near high-density pothole points; dry weather projections will accelerate community patching verification.`;
    }

    // 5. Citizen Participation
    const resolvedPercentage = total > 0 ? (resolved.length / total) : 0.5;
    const participationPercentage = Math.min(98, Math.max(62, Math.round(70 + resolvedPercentage * 20)));
    let rating = "Good";
    if (participationPercentage >= 85) rating = "Excellent";
    else if (participationPercentage < 70) rating = "Low";
    const participation = `${participationPercentage}% (${rating})`;

    // 6. AI Recommendation
    let recommendation = `Report any fresh municipal safety hazards or dark zones in your vicinity.`;
    if (unresolved.length > 0) {
      let closest = unresolved[0];
      let minDist = Infinity;
      unresolved.forEach(i => {
        const d = getDistanceInM(userLocation.lat, userLocation.lng, i.lat, i.lng);
        if (d < minDist) {
          minDist = d;
          closest = i;
        }
      });
      
      const dist = minDist === Infinity ? 150 : minDist;
      let verb = "Verify pothole";
      const cat = closest.category.toLowerCase();
      if (cat.includes("waste") || cat.includes("garbage") || cat.includes("trash")) verb = "Flag garbage pile";
      else if (cat.includes("light") || cat.includes("electric")) verb = "Confirm dark zone";
      else if (cat.includes("water") || cat.includes("leak") || cat.includes("drain")) verb = "Endorse leak report";

      const formattedArea = getIssueAreaName(closest, cityName);
      recommendation = `${verb} ${dist}m away ${formattedArea.toLowerCase().startsWith("near") ? formattedArea : "near " + formattedArea}`;
    }

    // 7. Confidence
    const verifiedCount = cityIssues.filter(i => (i.verificationCount || 0) > 0).length;
    const confidencePercentage = total > 0 ? Math.min(99, Math.max(75, Math.round((verifiedCount / total) * 100))) : 90;
    const confidence = `${confidencePercentage}%`;

    return {
      status,
      priorityAreas,
      hotspot,
      prediction,
      participation,
      recommendation,
      confidence
    };
  }, [cityIssues, cityName, userLocation]);
  
  const verifiedLastHourCount = Math.max(1, Math.min(4, Math.floor(cityIssues.length / 3)));
  const inspectionsCount = cityIssues.filter((i) => i.status === "in-progress").length || 3;
  const resolvedTodayCount = cityIssues.filter((i) => i.status === "resolved").length || 2;
  
  const isCivicHealthNA = totalReportsWithin30km === 0;
  
  // Dynamic average regional civic health index calculation
  const overallHealthIndex = (() => {
    if (isCivicHealthNA) return 100;
    
    const totalCount = issuesWithin30km.length;
    const activeCount = issuesWithin30km.filter(i => i.status !== "resolved").length;
    const overdueCount = issuesWithin30km.filter(i => {
      if (i.status === "resolved") return false;
      const createdTime = new Date(i.createdAt).getTime();
      if (isNaN(createdTime)) return false;
      return (Date.now() - createdTime) > 48 * 60 * 60 * 1000;
    }).length;
    const resolvedCount = issuesWithin30km.filter(i => i.status === "resolved").length;

    const activePercentage = (activeCount / totalCount) * 100;
    const overduePercentage = (overdueCount / totalCount) * 100;
    const resolutionRatePercentage = (resolvedCount / totalCount) * 100;

    const score = 100 - (activePercentage * 0.40) - (overduePercentage * 0.30) + (resolutionRatePercentage * 0.20);
    return Math.max(0, Math.min(100, Math.round(score)));
  })();

  const getHealthStatus = (score: number) => {
    if (isCivicHealthNA) return { label: "na", color: "text-slate-400 font-bold", bg: "bg-slate-50", hex: "#cbd5e1" };
    if (score >= 85) return { label: "Excellent", color: "text-emerald-500", bg: "bg-emerald-50", hex: "#10b981" };
    if (score >= 70) return { label: "Good", color: "text-yellow-500", bg: "bg-yellow-50", hex: "#eab308" };
    if (score >= 50) return { label: "Needs Attention", color: "text-orange-500", bg: "bg-orange-50", hex: "#f97316" };
    return { label: "Escalation Required", color: "text-rose-500", bg: "bg-rose-50", hex: "#ef4444" };
  };

  const healthStatus = getHealthStatus(overallHealthIndex);

  // Auto-escalate to municipality when civic health index is below 50
  useEffect(() => {
    if (!isCivicHealthNA && overallHealthIndex < 50 && escalatedScore !== overallHealthIndex && escalationStatus !== "sending" && escalationStatus !== "sent") {
      setEscalationStatus("sending");
      const alertText = `🚨 ESCALATION CRITICAL ALERT: Civic Health Index for ${cityName || "Varanasi"} has degraded to ${overallHealthIndex}. Immediate municipal attention and community triage requested.`;
      
      fetch("/api/municipality/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertText,
          cityName,
          overallHealthIndex
        })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setEscalationStatus("sent");
            setEscalatedScore(overallHealthIndex);
          } else {
            setEscalationStatus("error");
          }
        })
        .catch(err => {
          console.error("Escalation error:", err);
          setEscalationStatus("error");
        });
    } else if (overallHealthIndex >= 50 && escalationStatus !== "idle") {
      setEscalationStatus("idle");
      setEscalatedScore(null);
    }
  }, [overallHealthIndex, cityName, escalatedScore, escalationStatus]);

  // Quick Action List
  const quickActions = [
    { name: "Report", desc: "Interactive 5-Step AI Report Journey", icon: PlusCircle, tab: "Report", color: "bg-gradient-to-br from-emerald-600 to-teal-700 text-white" },
    { name: "Explore Map", desc: "Live Leaflet Coordinate Viewer", icon: Map, tab: "Map", color: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm" },
    { name: "Track", desc: "Resolution Timeline & Comparison", icon: List, tab: "Track", color: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm" },
    { name: "Community", desc: "Citizen Standings, Streak & Badges", icon: Trophy, tab: "Community", color: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm" },
    { name: "Impact", desc: "Weekly AI Risk Forecasting Sheets", icon: BarChart3, tab: "Impact", color: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 shadow-sm" },
  ];

  // Nearby Feed
  const nearbyIssues = [...issues]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3); // Get latest 3

  return (
    <div id="home-page-container" className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      
      {/* Citizen Honor Badge Row */}
      <div id="home-honor-badge-alert" className="bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-indigo-600/10 border border-emerald-500/20 rounded-2xl p-3 md:p-4 -mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300">
        <div className="flex items-start gap-3">
          {/* Big Earned Honor Badge Icon */}
          <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-tr ${userBadge.color} flex items-center justify-center text-white shrink-0 shadow-sm relative`}>
            {userBadge.icon === "Zap" && <Zap className="w-10 h-10 md:w-12 h-12 text-white fill-white/20 animate-pulse" />}
            {userBadge.icon === "Flame" && <Flame className="w-10 h-10 md:w-12 h-12 text-white fill-white/20 animate-bounce" style={{ animationDuration: '3s' }} />}
            {userBadge.icon === "Users" && <Users className="w-10 h-10 md:w-12 h-12 text-white fill-white/20 animate-pulse" />}
            {userBadge.icon === "ShieldCheck" && <ShieldCheck className="w-10 h-10 md:w-12 h-12 text-white fill-white/20 animate-bounce" style={{ animationDuration: '3s' }} />}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border border-white"></span>
            </span>
          </div>
          <div className="flex flex-col h-20 md:h-24 justify-between pt-0 pb-1.5 -mt-1.5">
            <div>
              <span className="text-slate-500 font-sans text-[11px] font-semibold leading-none">
                You are the,
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Beside icon: the badge name styled as text-lg md:text-xl */}
              <h4 className="font-sans font-black text-slate-800 leading-none text-lg md:text-xl">
                {userBadge.name}
              </h4>
              {/* XP on the right side of badge name with larger symbol */}
              <span className="font-mono text-[11px] md:text-xs font-black text-emerald-800 bg-emerald-100/70 border border-emerald-200 rounded-full px-2.5 py-0.5 leading-none select-none flex items-center gap-1 shadow-xs shrink-0">
                <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-400/20 animate-pulse" />
                {user.points} XP
              </span>
            </div>
            
            {/* Dynamic streak, rank and reports indicators - with smaller text size */}
            <div className="flex flex-col gap-0.5 md:gap-1">
              <div className="flex items-center gap-1.5 text-slate-500 font-sans text-[10px] md:text-xs leading-none shrink-0">
                <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500/10 shrink-0" />
                <span>Active Streak: <strong className="text-slate-800 font-extrabold">{user.streak} Days</strong></span>
                {user.streak === 0 && onClaimDailyCheckIn && (
                  <button 
                    onClick={onClaimDailyCheckIn}
                    className="ml-1 px-1.5 py-0.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-sans text-[8px] font-black uppercase rounded shadow-xs transition-transform cursor-pointer animate-pulse"
                    title="Claim Daily Check-In"
                  >
                    Check In
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 font-sans text-[10px] md:text-xs leading-none shrink-0">
                <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Community Rank: <strong className="text-slate-800 font-extrabold">#{userRank}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500 font-sans text-[10px] md:text-xs leading-none shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Reports Filed: <strong className="text-slate-800 font-extrabold">{user.reportedCount} reported</strong></span>
              </div>
            </div>
          </div>
        </div>
        <button 
          onClick={() => onNavigateToTab("Community")}
          className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-black text-[9px] uppercase tracking-widest px-3.5 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer shrink-0 flex items-center justify-center gap-1 active:scale-95"
        >
          <span>View Standings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
      
      {/* Good morning greeting instead of large Civic+ card */}
      <div id="home-welcome-header" className="text-left py-3 shrink-0">
        <h1 className="font-sans font-black text-slate-900 text-3xl md:text-4xl tracking-tight leading-none">
          Good morning, <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600">{user.name || "Citizen"}</span> 👋
        </h1>
        <p className="font-sans text-xs text-slate-500 mt-1.5 font-medium">
          Let's work together to make our neighborhood safer, cleaner, and better today.
        </p>
      </div>

      {/* Your City Heading */}
      <div className="text-center py-1">
        <h2 className="font-sans font-black text-2xl md:text-3xl tracking-tight text-slate-800">
          Your City: <span style={{ color: "#0806a3" }}>{cityName}</span>
        </h2>
      </div>

      {/* Statistics Bento Grid */}
      <div id="home-stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 shrink-0">
        
        {/* Total Issues */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 shadow-sm flex items-center gap-4 transition-transform hover:scale-101 h-full">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <AlertCircle className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              Total Reports
              <span className="bg-rose-50 text-rose-600 px-1 py-0.5 rounded text-[8px] font-bold tracking-widest leading-none border border-rose-200/50">
                LIVE
              </span>
            </span>
            <strong className="font-sans font-black text-slate-800 text-lg md:text-2xl font-mono block leading-none mt-1">
              {totalReportsWithin30km}
            </strong>
            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium leading-none">Within 30 km range</span>
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 shadow-sm flex items-center gap-4 transition-transform hover:scale-101 h-full">
          <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <CheckCircle2 className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider block">Resolved Cases</span>
            <strong className="font-sans font-black text-teal-600 text-lg md:text-2xl font-mono block leading-none mt-1">
              {resolvedIssuesWithin30km}
            </strong>
            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium leading-none">Within 30 km range</span>
          </div>
        </div>

        {/* Active Citizens */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 shadow-sm flex items-center gap-4 transition-transform hover:scale-101 h-full">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Users className="w-5.5 h-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider block">Active Citizens</span>
            <strong className="font-sans font-black text-emerald-700 text-lg md:text-2xl font-mono block leading-none mt-1">
              {activeCitizensCount.toLocaleString()}
            </strong>
          </div>
        </div>

        {/* Civic Health Index - Dynamic Score Ring */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5 shadow-sm flex flex-col justify-center transition-transform hover:scale-101 relative overflow-hidden h-full">
          <div className="flex items-center gap-4">
            <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
              {/* SVG Circular progress indicator */}
              <svg className="absolute w-full h-full transform -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  className="stroke-slate-100"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  className="transition-all duration-500 ease-out"
                  stroke={healthStatus.hex}
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray="125.6"
                  strokeDashoffset={isCivicHealthNA ? 125.6 : 125.6 - (overallHealthIndex / 100) * 125.6}
                  strokeLinecap="round"
                />
              </svg>
              <span className={`font-sans font-black text-xs z-10 ${healthStatus.color}`}>{isCivicHealthNA ? "na" : overallHealthIndex}</span>
            </div>
            <div>
              <span className="text-[10px] font-sans font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                Civic Health Index
                <span className="bg-rose-50 text-rose-600 px-1 py-0.5 rounded text-[8px] font-bold tracking-widest leading-none border border-rose-200/50">
                  LIVE
                </span>
              </span>
              <strong className={`font-sans font-extrabold text-xs uppercase ${healthStatus.color} block leading-none mt-1`}>
                {healthStatus.label}
              </strong>
            </div>
          </div>
        </div>

      </div>

      {/* Escalation Alert (Shown only when Civic Health Index is < 50) */}
      {!isCivicHealthNA && overallHealthIndex < 50 && (
        <div id="civic-escalation-alert-box" className="p-4 bg-rose-50 border border-rose-100 rounded-3xl animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0 animate-bounce" style={{ animationDuration: '3s' }} />
            <div>
              <span className="text-[11px] font-sans font-extrabold text-rose-800 uppercase tracking-wider block">
                🚨 AI-ESCALATION ALERT
              </span>
              <p className="text-xs text-slate-600 leading-normal mt-0.5">
                Civic Health has dropped below critical threshold. Immediate municipal attention and community triage requested.
              </p>
              <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-600 font-sans font-extrabold">
                <Check className="w-4 h-4 stroke-[3px]" />
                <span>Escalation alert notified to municipality</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Deck */}
      <div id="home-quick-actions">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-3 pl-1">
          QUICK LAUNCHPAD ACTIONS
        </span>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.name}
                id={`quick-action-btn-${action.name.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => onNavigateToTab(action.tab)}
                className={`p-3 rounded-2xl text-left transition-all duration-200 hover:scale-103 hover:shadow-md ${action.color} flex flex-col justify-between h-[92px]`}
              >
                <div className={`w-7.5 h-7.5 rounded-lg flex items-center justify-center shadow-sm ${
                  action.name === "Report" ? "bg-white/10 text-white" : "bg-slate-50 text-slate-600"
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-display font-black text-xs block leading-tight">
                    {action.name}
                  </span>
                  <p className={`text-[9.5px] leading-none font-sans mt-0.5 ${
                    action.name === "Report" ? "text-blue-100" : "text-slate-400"
                  }`}>
                    {action.desc.split(" ")[0]} ...
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Two Columns: How can you help Today? & AI-Civic Brief */}
      <div id="home-briefs-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* Card 1: How can you help Today? */}
        <div className="bg-emerald-50/60 border border-emerald-100/80 rounded-3xl p-5 md:p-6 shadow-sm h-full flex flex-col justify-between">
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  <Sparkles className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <h3 className="font-display font-black text-slate-800 text-base">
                  How can you help Today?
                </h3>
              </div>
              <p className="text-slate-500 text-[11px] font-sans mb-4">
                Agentic AI live analysis of current community issues:
              </p>
              
              <ul className="space-y-2 text-slate-700 font-sans">
                {helpTasks.map((task) => (
                  <li key={task.id}>
                    <button
                      onClick={task.action}
                      className="w-full text-left flex items-center gap-2 text-xs font-semibold hover:text-emerald-700 hover:bg-emerald-100/35 p-2 rounded-xl transition-all group cursor-pointer"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full group-hover:scale-125 transition-transform shrink-0 ${task.isVerify ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                      <span className="flex-1 truncate leading-tight font-medium">{task.text}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-emerald-600 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Daily Motivational Citizen Quote (Highlighted, No Image) */}
            <div className="mt-6 bg-white border border-emerald-150/60 rounded-2xl p-4 shadow-3xs text-left">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] bg-emerald-500 text-white font-sans font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none">
                  🌅 Fueling Inspiration
                </span>
                <span className="text-[9px] text-emerald-600 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100/60 select-none">
                  Updates Daily
                </span>
              </div>
              
              <div className="border-l-3 border-emerald-500 pl-3 py-1">
                <p className="font-sans font-extrabold text-[12px] leading-relaxed text-slate-800 italic">
                  "{dailyQuote.text}"
                </p>
                <p className="text-[10px] text-emerald-700 font-bold mt-2 tracking-wider uppercase">
                  — {dailyQuote.author}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: AI-Civic Brief */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-sm h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <ShieldAlert className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-slate-800 text-base">
                    AI-Civic Brief
                  </h3>
                  <span className="text-[9.5px] text-indigo-600 font-sans font-bold tracking-wide block -mt-0.5 italic">
                    Ai-powered city brief
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isBriefLoading && (
                  <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-indigo-500 bg-indigo-50/50 px-2 py-0.5 rounded-full animate-pulse">
                    <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                    AI Syncing
                  </div>
                )}
                <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 text-rose-600 px-2 py-0.5 rounded-md text-[9.5px] font-sans font-black tracking-widest leading-none select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                  <span>LIVE</span>
                </div>
              </div>
            </div>


            <div id="ai-civic-brief-sections" className="space-y-3.5 mt-4">
              {/* 1. Today's City Status */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                  Today's City Status
                </span>
                <span className="text-xs font-sans font-black px-2.5 py-0.5 rounded-full bg-slate-50 border border-slate-100 text-slate-800">
                  {(aiBrief || localBrief).status}
                </span>
              </div>

              {/* 2. Priority Areas */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                  Priority Areas
                </span>
                <span className="text-xs font-sans font-bold text-slate-800">
                  {(aiBrief || localBrief).priorityAreas}
                </span>
              </div>

              {/* 3. Emerging Hotspot */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                  Emerging Hotspot
                </span>
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded border border-indigo-100/30">
                  {(aiBrief || localBrief).hotspot}
                </span>
              </div>

              {/* 4. Prediction */}
              <div className="py-1.5 border-b border-slate-100">
                <span className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Prediction
                </span>
                <p className="text-xs text-slate-600 font-sans leading-relaxed">
                  {(aiBrief || localBrief).prediction}
                </p>
              </div>

              {/* 5. Citizen Participation */}
              <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                <span className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                  Citizen Participation
                </span>
                <span className="text-xs font-sans font-extrabold text-emerald-600">
                  {(aiBrief || localBrief).participation}
                </span>
              </div>

              {/* 6. AI Recommendation */}
              <div className="py-1.5 border-b border-slate-100">
                <span className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  AI Recommendation
                </span>
                <div className="text-xs font-sans font-bold text-slate-800 bg-emerald-50/60 border border-emerald-100/50 rounded-xl p-2.5 flex items-center justify-between">
                  <span>{(aiBrief || localBrief).recommendation}</span>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 ml-1" />
                </div>
              </div>

              {/* 7. Confidence */}
              <div className="flex items-center justify-between py-1.5">
                <span className="text-[11px] font-sans font-bold text-slate-500 uppercase tracking-wider">
                  Confidence
                </span>
                <span className="text-xs font-mono font-black text-indigo-600">
                  {(aiBrief || localBrief).confidence}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Personalized AI Advice Modal */}
      {isAiAdviceOpen && (
        <div id="ai-advice-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <Sparkles className="w-4.5 h-4.5" />
                </div>
                <h3 className="font-display font-black text-slate-800 text-base">
                  AI Companion Advice
                </h3>
              </div>
              <button 
                onClick={() => setIsAiAdviceOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-slate-600 text-xs leading-relaxed font-medium">
                Based on real-time city parameters and active municipal reports, here is your personalized AI civic advisory:
              </p>
              
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50/60 border border-emerald-100/30 rounded-2xl flex items-start gap-2.5">
                  <span className="text-base">🚶</span>
                  <div>
                    <h5 className="text-xs font-bold text-emerald-800">Walkway Safety</h5>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-normal">
                      {issues.some(i => i.category.toLowerCase().includes("waste") && i.status !== "resolved") 
                        ? `Solid waste reports exist near your zone. Watch your step around market streets.`
                        : `Pedestrian paths are highly clean today with zero waste reports. Enjoy your walk!`}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/60 border border-indigo-100/30 rounded-2xl flex items-start gap-2.5">
                  <span className="text-base">💡</span>
                  <div>
                    <h5 className="text-xs font-bold text-indigo-800">Night Visibility</h5>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-normal">
                      {issues.some(i => i.category.toLowerCase().includes("light") && i.status !== "resolved") 
                        ? `Streetlight issues detected. Carry a flashlight if traveling through secondary lanes after sunset.`
                        : `Widespread dark-zone reports are resolved. Main roads are well lit.`}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-amber-50/60 border border-amber-100/30 rounded-2xl flex items-start gap-2.5">
                  <span className="text-base">🚗</span>
                  <div>
                    <h5 className="text-xs font-bold text-amber-800">Road Transit</h5>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-normal">
                      {issues.some(i => i.category.toLowerCase().includes("pothole") && i.status !== "resolved") 
                        ? `Drive cautiously. Local potholes may cause slight congestion near active wards.`
                        : `Major transit routes report zero deep potholes. Driving conditions are smooth.`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsAiAdviceOpen(false)}
              className="w-full mt-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-sans font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
            >
              Got it, thank you!
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
