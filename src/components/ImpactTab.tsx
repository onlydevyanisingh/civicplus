import { useEffect, useState, useMemo } from "react";
import { CivicIssue, ActionRecommendation } from "../types";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid 
} from "recharts";
import { 
  TrendingUp, AlertOctagon, CheckCircle2, ShieldAlert, Zap, 
  RefreshCw, Users, ShieldCheck, Flame, Compass, Heart, ArrowRight, Clock, Sparkles
} from "lucide-react";

interface ImpactTabProps {
  issues: CivicIssue[];
  cityName?: string;
  userLocation?: { lat: number; lng: number };
  currentWard?: string;
}

function getDistanceInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export default function ImpactTab({ 
  issues, 
  cityName = "Varanasi", 
  userLocation = { lat: 25.2820, lng: 83.0080 },
  currentWard = "Lanka Ward"
}: ImpactTabProps) {
  const [recommendations, setRecommendations] = useState<ActionRecommendation[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [activeRecTab, setActiveRecTab] = useState<"Citizen" | "Municipality">("Citizen");

  const [surgicalSuggestions, setSurgicalSuggestions] = useState<Array<{
    area: string;
    issueType: string;
    count: number;
    isDuplicate: boolean;
    priority: string;
    measure: string;
    isCustomNamed?: boolean;
  }>>([]);
  const [isLoadingSurgical, setIsLoadingSurgical] = useState(false);

  // Filter issues within 30kms range of the user's current live location
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (typeof issue.lat !== "number" || typeof issue.lng !== "number") return false;
      const dist = getDistanceInM(userLocation.lat, userLocation.lng, issue.lat, issue.lng);
      return dist <= 30000; // 30 kms in meters
    });
  }, [issues, userLocation]);

  // Signature Feature 1: Dynamic Neighborhood Health Calculator
  const calculateLocalityHealth = (localityName: string) => {
    const localityIssues = filteredIssues.filter((i) => i.locality.toLowerCase().includes(localityName.toLowerCase()));
    if (localityIssues.length === 0) {
      return { 
        score: "N/A" as any, 
        status: "N/A" as const, 
        color: "text-slate-400", 
        bg: "bg-slate-50/70", 
        border: "border-slate-100", 
        unresolvedCount: 0, 
        resolvedCount: 0 
      };
    }

    const totalCount = localityIssues.length;
    const unresolvedCount = localityIssues.filter((i) => i.status !== "resolved").length;
    const resolvedCount = localityIssues.filter((i) => i.status === "resolved").length;
    
    if (unresolvedCount === 0 && resolvedCount === 0) {
      return { 
        score: "N/A" as any, 
        status: "N/A" as const, 
        color: "text-slate-400", 
        bg: "bg-slate-50/70", 
        border: "border-slate-100", 
        unresolvedCount: 0, 
        resolvedCount: 0 
      };
    }

    const overdueCount = localityIssues.filter(i => {
      if (i.status === "resolved") return false;
      const createdTime = new Date(i.createdAt).getTime();
      if (isNaN(createdTime)) return false;
      return (Date.now() - createdTime) > 48 * 60 * 60 * 1000;
    }).length;

    const activePercentage = (unresolvedCount / totalCount) * 100;
    const overduePercentage = (overdueCount / totalCount) * 100;
    const resolutionRatePercentage = (resolvedCount / totalCount) * 100;

    const score = Math.max(0, Math.min(100, Math.round(
      100 - (activePercentage * 0.40) - (overduePercentage * 0.30) + (resolutionRatePercentage * 0.20)
    )));

    let status: "Excellent" | "Good" | "Needs Attention" | "Escalation Required" | "Previously Active Hotspot" | "N/A" = "Excellent";
    let color = "text-emerald-500";
    let bg = "bg-emerald-50/70";
    let border = "border-emerald-100";

    if (unresolvedCount === 0 && resolvedCount > 0) {
      // All resolved
      status = "Previously Active Hotspot";
      color = "text-emerald-500"; // Green color in circle and text
      bg = "bg-emerald-50/70";
      border = "border-emerald-100";
    } else {
      if (score >= 85) {
        status = "Excellent";
        color = "text-emerald-500";
        bg = "bg-emerald-50/70";
        border = "border-emerald-100";
      } else if (score >= 70) {
        status = "Good";
        color = "text-yellow-500";
        bg = "bg-yellow-50/50";
        border = "border-yellow-100";
      } else if (score >= 50) {
        status = "Needs Attention";
        color = "text-orange-500";
        bg = "bg-orange-50/60";
        border = "border-orange-100";
      } else {
        status = "Escalation Required";
        color = "text-rose-500";
        bg = "bg-rose-50";
        border = "border-rose-100";
      }
    }

    return { score, status, color, bg, border, unresolvedCount, resolvedCount };
  };

  const computedWards = useMemo(() => {
    const isVns = (cityName || "Varanasi").toLowerCase().includes("varanasi") || 
                  (cityName || "Varanasi").toLowerCase().includes("banaras") ||
                  (cityName || "Varanasi").toLowerCase().includes("vns");

    if (isVns) {
      // Varanasi specific wards sorted by proximity to user's current live location
      const vnsWards = [
        { name: "Lanka", desc: "Commercial Hub with High Resident Footfall", lat: 25.2798, lng: 83.0012 },
        { name: "Assi", desc: "Historical River Approach / Ghat Zone", lat: 25.2885, lng: 83.0118 },
        { name: "BHU Gate", desc: "Premium University Buffer Corridor", lat: 25.2748, lng: 83.0055 },
      ];

      return vnsWards.map(ward => {
        const distance = getDistanceInM(userLocation.lat, userLocation.lng, ward.lat, ward.lng);
        return {
          ...ward,
          distance,
          displayName: `${ward.name} Ward`
        };
      }).sort((a, b) => a.distance - b.distance);
    } else {
      // Check if we have a valid geocoded ward name
      const isWardAvailable = currentWard && 
                              !currentWard.toLowerCase().includes("local ward") && 
                              !currentWard.toLowerCase().includes("unknown") && 
                              currentWard.trim() !== "" &&
                              currentWard !== "Ward";

      // Group issues within 30km by locality/landmark
      const localityCounts: { [key: string]: { count: number; lat: number; lng: number; lastCategory: string } } = {};
      
      filteredIssues.forEach(issue => {
        const loc = (issue.locality || "").trim();
        if (!loc) return;
        const key = loc.toLowerCase();
        if (!localityCounts[key]) {
          localityCounts[key] = { count: 0, lat: issue.lat, lng: issue.lng, lastCategory: issue.category };
        }
        localityCounts[key].count += 1;
      });

      // Sort unique localities by distance to user's live location
      const sortedLocalities = Object.entries(localityCounts).map(([key, data]) => {
        const originalName = filteredIssues.find(i => i.locality?.toLowerCase() === key)?.locality || key;
        const distance = getDistanceInM(userLocation.lat, userLocation.lng, data.lat, data.lng);
        return {
          key,
          name: originalName,
          count: data.count,
          distance,
          lat: data.lat,
          lng: data.lng,
          lastCategory: data.lastCategory
        };
      }).sort((a, b) => a.distance - b.distance);

      const results = [];

      // If we have a valid geocoded current ward, add it as the first card!
      if (isWardAvailable) {
        results.push({
          name: currentWard,
          displayName: currentWard.toLowerCase().includes("ward") ? currentWard : `${currentWard} Ward`,
          desc: `Current active municipal ward monitoring local infrastructure and service delivery.`,
          lat: userLocation.lat,
          lng: userLocation.lng,
          distance: 0
        });
      }

      // Add nearest landmarks where issues were reported
      sortedLocalities.forEach(loc => {
        // Avoid duplicating if the landmark name is very close to currentWard
        if (isWardAvailable && loc.name.toLowerCase().includes(currentWard.toLowerCase())) {
          return;
        }
        results.push({
          name: loc.name,
          displayName: `Near ${loc.name}`,
          desc: `Civic area monitoring local ${loc.lastCategory || "infrastructure"} issues.`,
          lat: loc.lat,
          lng: loc.lng,
          distance: loc.distance
        });
      });

      // Fallback pad if there are less than 3 cards
      const fallbacks = [
        { name: "Main Crossing", displayName: `Near Main Crossing`, desc: "Commercial corridor monitoring local traffic and sanitation", offsetLat: 0.005, offsetLng: -0.002 },
        { name: "Town Square", displayName: `Near Town Square`, desc: "Central community gathering hub and public park", offsetLat: -0.004, offsetLng: 0.006 },
        { name: "Station Crossing", displayName: `Near Station Crossing`, desc: "Transportation access route with heavy footfall logistics", offsetLat: 0.003, offsetLng: 0.004 },
      ];

      let fallbackIdx = 0;
      while (results.length < 3 && fallbackIdx < fallbacks.length) {
        const fb = fallbacks[fallbackIdx];
        const fLat = userLocation.lat + fb.offsetLat;
        const fLng = userLocation.lng + fb.offsetLng;
        const distance = getDistanceInM(userLocation.lat, userLocation.lng, fLat, fLng);
        results.push({
          name: fb.name,
          displayName: fb.displayName,
          desc: fb.desc,
          lat: fLat,
          lng: fLng,
          distance
        });
        fallbackIdx++;
      }

      return results.slice(0, 3);
    }
  }, [cityName, userLocation, filteredIssues, currentWard]);

  // Fetch AI Agents Predictions and Checklists
  const loadAIPredictions = async (forceRefresh = false) => {
    setIsLoadingAgents(true);
    try {
      const response = await fetch("/api/agents/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues: filteredIssues }),
      });
      const data = await response.json();
      if (response.ok && data.predictions) {
        setRecommendations(data.recommendations);
      } else {
        throw new Error("Invalid API payload");
      }
    } catch (err) {
      console.warn("AI Insights API failed. Loading fallback predictions.");
      // Standard local fallbacks
      setTimeout(() => {
        setRecommendations([
          {
            target: "Citizen",
            title: "Hyperlocal Sweeping & Bagging Crew",
            steps: [
              "Coordinate a 2-hour neighborhood clean-up session on Saturday morning.",
              "Apply standard biological sanitizing powder to dry waste areas to minimize vectors.",
              "Publish photographic updates via Civic+ community channel to notify municipal auditors."
            ],
            impact: "Reduces surrounding organic vector breeding rates by 80% and clears market pathways.",
            difficulty: "Easy",
          },
          {
            target: "Municipality",
            title: "Assi Culvert Desilting Dispatch",
            steps: [
              "Deploy high-pressure water vacuum truck to clear silt blocks from secondary ghat drains.",
              "Introduce floating trash nets across open water channels to trap commercial plastics.",
              "Upgrade steel grate dimensions to maximize flow bypass capacity."
            ],
            impact: "Bypasses drainage bottlenecks, reducing regional water-logging risks by 90%.",
            difficulty: "Hard",
          },
          {
            target: "Citizen",
            title: "Vulnerable Student Safe-Escort Escrow",
            steps: [
              "Establish a student-led night walking group for dark corridors along BHU Wall.",
              "Carry secondary high-lumen pocket flashlights during late evening classes.",
              "Upvote streetlight reports daily to escalate maintenance service orders."
            ],
            impact: "Safeguards 120+ female students walking night routes until lighting repairs complete.",
            difficulty: "Medium",
          },
          {
            target: "Municipality",
            title: "High-Visibility Streetlight Replacement",
            steps: [
              "Mobilize electricity board maintenance van to BHU outer wall.",
              "Replace obsolete mercury vapor ballasts with high-draw 120W LED fixtures.",
              "Perform comprehensive insulation resistance checks across wiring conduits."
            ],
            impact: "Restores 100% illumination coverage, enhancing the security index of BHU Ward.",
            difficulty: "Medium",
          }
        ]);
      }, 1000);
    } finally {
      setIsLoadingAgents(false);
    }
  };

  const loadSurgicalSuggestions = async () => {
    setIsLoadingSurgical(true);
    try {
      const response = await fetch("/api/agents/surgical-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issues: filteredIssues }),
      });
      const data = await response.json();
      if (response.ok && data.suggestions) {
        setSurgicalSuggestions(data.suggestions);
      } else {
        throw new Error("Invalid surgical suggestions payload");
      }
    } catch (err) {
      console.warn("Surgical suggestions API failed. Loading local fallback.");
      const active = filteredIssues.filter(i => i.status !== "resolved");
      const targetIssues = active.length > 0 ? active : filteredIssues;
      
      const groups: { [key: string]: CivicIssue[] } = {};
      targetIssues.forEach(issue => {
        const areaKey = (issue.locality || "").trim();
        const catKey = (issue.category || "").trim();
        const key = `${areaKey}|${catKey}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(issue);
      });

      const fallbackSugs: any[] = [];
      const processed = new Set<string>();

      Object.entries(groups).forEach(([key, groupIssues]) => {
        if (groupIssues.length > 1) {
          processed.add(key);
          const [locality, category] = key.split("|");
          let recommendedName = `${locality} Multi-hazard Area`;
          if (category.toLowerCase().includes("waste")) recommendedName = `${locality} Waste Overflow Zone`;
          else if (category.toLowerCase().includes("light")) recommendedName = `${locality} Dark Pathway Belt`;
          else if (category.toLowerCase().includes("pothhole") || category.toLowerCase().includes("road")) recommendedName = `${locality} Road Fracture Sector`;
          else if (category.toLowerCase().includes("water") || category.toLowerCase().includes("sewage")) recommendedName = `${locality} Waterlogging Corridor`;

          let attentionPlan = "Dispatch immediate cleanup crews";
          if (category.toLowerCase().includes("light")) attentionPlan = "Install high lumen bulbs";
          else if (category.toLowerCase().includes("pothhole") || category.toLowerCase().includes("road")) attentionPlan = "Patch deep tarmac craters";
          else if (category.toLowerCase().includes("water") || category.toLowerCase().includes("sewage")) attentionPlan = "Seal water pipeline leak";

          fallbackSugs.push({
            area: recommendedName,
            issueType: category,
            count: groupIssues.length,
            isDuplicate: true,
            priority: groupIssues.some(i => i.severity === "Critical" || i.urgency === "Critical") ? "Critical" : "High",
            measure: attentionPlan,
            isCustomNamed: true
          });
        }
      });

      targetIssues.forEach(issue => {
        const key = `${(issue.locality || "").trim()}|${(issue.category || "").trim()}`;
        if (!processed.has(key) && fallbackSugs.length < 3) {
          processed.add(key);
          let practicalMeasure = "Inspect and fix immediately";
          const cat = (issue.category || "").toLowerCase();
          if (cat.includes("light")) {
            practicalMeasure = `Deploy technicians to replace broken lamp and check electrical wire connections at ${issue.locality}.`;
          } else if (cat.includes("waste") || cat.includes("garbage")) {
            practicalMeasure = `Dispatch waste disposal vehicle to lift the garbage stack and disinfect the concrete base at ${issue.locality}.`;
          } else if (cat.includes("road") || cat.includes("pothhole") || cat.includes("infrastructure")) {
            practicalMeasure = `Deploy repair crew to level the gravel and fill tarmac craters with hot asphalt at ${issue.locality}.`;
          } else if (cat.includes("water") || cat.includes("leakage")) {
            practicalMeasure = `Shut main valves and weld the pipe burst to prevent local flooding at ${issue.locality}.`;
          }

          fallbackSugs.push({
            area: issue.locality,
            issueType: issue.category,
            count: 1,
            isDuplicate: false,
            priority: issue.severity || "High",
            measure: practicalMeasure,
            isCustomNamed: false
          });
        }
      });

      if (fallbackSugs.length === 0) {
        fallbackSugs.push({
          area: "Lanka Waste Overflow Zone",
          issueType: "waste managemnt",
          count: 2,
          isDuplicate: true,
          priority: "Critical",
          measure: "Clear trash piles immediately",
          isCustomNamed: true
        });
        fallbackSugs.push({
          area: "BHU Outer Blackout Belt",
          issueType: "street lights",
          count: 2,
          isDuplicate: true,
          priority: "High",
          measure: "Replace broken light bulbs",
          isCustomNamed: true
        });
        fallbackSugs.push({
          area: "Assi Ghat Road Fracture Sector",
          issueType: "pothholes",
          count: 2,
          isDuplicate: true,
          priority: "High",
          measure: "Level road surface immediately",
          isCustomNamed: true
        });
      }

      setSurgicalSuggestions(fallbackSugs.slice(0, 3));
    } finally {
      setIsLoadingSurgical(false);
    }
  };

  useEffect(() => {
    loadAIPredictions();
    loadSurgicalSuggestions();
  }, [filteredIssues]);

  // Synchronize surgical suggestions to user's live location city
  const processedSuggestions = useMemo(() => {
    const isVns = (cityName || "Varanasi").toLowerCase().includes("varanasi") || 
                  (cityName || "Varanasi").toLowerCase().includes("banaras") ||
                  (cityName || "Varanasi").toLowerCase().includes("vns");

    return surgicalSuggestions.map(sug => {
      // Find matching issue from filteredIssues (within 30km)
      const matchingIssue = filteredIssues.find(i => 
        i.category.toLowerCase() === sug.issueType.toLowerCase() ||
        sug.area.toLowerCase().includes(i.locality.toLowerCase()) ||
        (i.locality && sug.measure.toLowerCase().includes(i.locality.toLowerCase()))
      );

      let resolvedArea = sug.area;

      if (matchingIssue) {
        if (isVns) {
          resolvedArea = `${matchingIssue.locality} Ward`;
        } else {
          resolvedArea = `NEAR ${matchingIssue.locality.toUpperCase()}`;
        }
      } else {
        if (isVns) {
          resolvedArea = "Lanka Ward";
        } else {
          resolvedArea = `NEAR ${(cityName || "LOCALITY").toUpperCase()}`;
        }
      }

      return {
        ...sug,
        area: resolvedArea
      };
    });
  }, [surgicalSuggestions, filteredIssues, cityName]);

  // Preparing chart data dynamically from actual issue states
  const getCategoryCount = (catName: string, status: "resolved" | "active") => {
    return filteredIssues.filter((i) => 
      i.category === catName && 
      (status === "resolved" ? i.status === "resolved" : i.status !== "resolved")
    ).length;
  };

  const categories = ["street lights", "waste managemnt", "roads and infrastructure", "water leakage", "pothholes"];
  const barChartData = categories.map((cat) => ({
    name: cat === "street lights" ? "Lights" : cat === "waste managemnt" ? "Waste" : cat === "roads and infrastructure" ? "Roads" : cat === "water leakage" ? "Water" : "Potholes", // shorter name
    Active: getCategoryCount(cat, "active"),
    Resolved: getCategoryCount(cat, "resolved"),
  }));

  // Simple trends projection data based on current issues
  const lineChartData = [
    { week: "Week 21", Reports: 8, Resolutions: 5 },
    { week: "Week 22", Reports: 12, Resolutions: 10 },
    { week: "Week 23", Reports: 19, Resolutions: 12 },
    { week: "Week 24", Reports: 26, Resolutions: 20 },
    { week: "Current", Reports: filteredIssues.length, Resolutions: filteredIssues.filter((i) => i.status === "resolved").length },
  ];

  // Overall Impact Stats
  const totalIssues = filteredIssues.length;
  const resolvedIssues = filteredIssues.filter((i) => i.status === "resolved").length;
  const activeIssues = totalIssues - resolvedIssues;
  const resolutionRate = totalIssues > 0 ? Math.round((resolvedIssues / totalIssues) * 100) : 100;

  // Dynamic Impact Summary Counters synced to user's live city location
  const totalVerificationsCount = filteredIssues.reduce((sum, i) => sum + (i.verificationCount || 0), 0);
  const resolvedCount = filteredIssues.filter((i) => i.status === "resolved").length;
  const totalReportsCount = filteredIssues.length;
  const crewsDispatchedCount = filteredIssues.filter((i) => i.status === "in-progress" || i.status === "resolved").length;

  // No-op - local suggestions are now stateful and loaded via agentic AI

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "Easy": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Medium": return "bg-blue-50 text-blue-700 border-blue-100";
      case "Hard": return "bg-rose-50 text-rose-700 border-rose-100";
      default: return "bg-slate-50 text-slate-700";
    }
  };

  return (
    <div id="impact-page-container" className="max-w-6xl mx-auto p-4 md:p-6 space-y-8">
      
      {/* Signature Feature 1: Ward Health Score Bento & Signature Feature 4: Heatmap */}
      <div id="ward-health-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {computedWards.map((ward) => {
          const health = calculateLocalityHealth(ward.name);
          return (
            <div
              key={ward.name}
              id={`ward-health-cell-${ward.name.toLowerCase().replace(/\s+/g, "-")}`}
              className={`bg-white rounded-2xl border border-slate-100 shadow-md p-5 flex flex-col justify-between transition-all hover:scale-101 hover:shadow-lg relative overflow-hidden`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    {(cityName || "Varanasi").toUpperCase()} MUNICIPAL WARD
                  </span>
                  
                  {/* Signature Feature 4: Heatmap Color Mapping */}
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    health.status === "Excellent" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    health.status === "Previously Active Hotspot" ? "bg-emerald-50 text-emerald-600 border-emerald-200" :
                    health.status === "Good" ? "bg-yellow-50 text-yellow-600 border-yellow-200" :
                    health.status === "Needs Attention" ? "bg-orange-50 text-orange-600 border-orange-200" :
                    health.status === "N/A" ? "bg-slate-50 text-slate-500 border-slate-200" :
                    "bg-rose-50 text-rose-600 border-rose-200"
                  }`}>
                    {health.status === "Excellent" ? "🟢 Excellent" :
                     health.status === "Previously Active Hotspot" ? "🟢 Previously Active Hotspot" :
                     health.status === "Good" ? "🟡 Good" :
                     health.status === "Needs Attention" ? "🟠 Needs Attention" :
                     health.status === "N/A" ? "⚪ Civic Health N/A" :
                     "🔴 Escalation Required"}
                  </span>
                </div>
                
                <h3 className="font-display font-black text-slate-800 text-lg mt-3 mb-0.5">
                  {ward.displayName}
                </h3>
                <p className="text-slate-400 text-[11px] font-sans leading-tight">
                  {ward.desc}
                </p>
 
                {/* Ward statistics panel */}
                <div className="grid grid-cols-2 gap-2 mt-4 py-2 border-y border-slate-50">
                  <div className="text-left">
                    <span className="text-[9px] font-sans text-slate-400 block uppercase">Unresolved Issues</span>
                    <strong className="font-mono text-slate-700 text-sm">{health.unresolvedCount}</strong>
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] font-sans text-slate-400 block uppercase">Resolved Issues</span>
                    <strong className="font-mono text-emerald-600 text-sm">{health.resolvedCount}</strong>
                  </div>
                </div>
              </div>
 
              {/* Health index big circle score */}
              <div className="flex items-center gap-4 mt-5">
                <div className="w-14 h-14 rounded-full border-4 border-slate-100 flex items-center justify-center shrink-0 relative shadow-inner" style={{ borderColor: health.status === "Escalation Required" ? "#fecdd3" : health.status === "Needs Attention" ? "#ffedd5" : health.status === "Good" ? "#fef9c3" : health.status === "N/A" ? "#cbd5e1" : "#d1fae5" }}>
                  <span className={`font-display font-bold text-lg ${health.color}`}>{health.score}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-700 block font-sans">Civic Health Index</span>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                    Weighted calculation of active municipal hazards & citizens endorsing.
                  </p>
                </div>
              </div>
 
              {/* Decorative side accent mapping to Heatmap classification */}
              <div className={`absolute top-0 right-0 w-1 h-full ${
                health.status === "Excellent" || health.status === "Previously Active Hotspot" ? "bg-emerald-500" :
                health.status === "Good" ? "bg-yellow-400" :
                health.status === "Needs Attention" ? "bg-orange-400" :
                health.status === "N/A" ? "bg-slate-300" : "bg-rose-500"
              }`} />
            </div>
          );
        })}
      </div>

      {/* Analytical Charts Bento Section */}
      <div id="analytics-charts-bento" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Weekly trends LineChart */}
        <div id="trends-chart-cell" className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-md p-5 md:p-6 flex flex-col justify-between">
          <div className="mb-4">
            <span className="text-[9px] font-mono font-bold text-blue-500 uppercase">Aesthetic Reporting Load</span>
            <h3 className="font-display font-bold text-slate-800 text-base mt-1 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Reporting & Resolution Trends
            </h3>
            <p className="text-slate-400 text-[11px] font-sans mt-0.5">Cumulative progress ratio over consecutive municipal blocks.</p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#94a3b8" }} stroke="#e2e8f0" />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} stroke="#e2e8f0" />
                <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "11px" }} />
                <Legend wrapperStyle={{ fontSize: "10.5px", marginTop: "10px" }} />
                <Line type="monotone" dataKey="Reports" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Resolutions" stroke="#10b981" strokeWidth={2.5} strokeDasharray="3 3" dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Categories BarChart and overall stat box */}
        <div id="resolution-chart-cell" className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-md p-5 md:p-6 flex flex-col justify-between">
          <div className="mb-4">
            <span className="text-[9px] font-mono font-bold text-indigo-500 uppercase">Ward Resource Load</span>
            <h3 className="font-display font-bold text-slate-800 text-base mt-1">
              Category Distribution
            </h3>
            <p className="text-slate-400 text-[11px] font-sans mt-0.5">Quantity of unresolved vs resolved hazards sorted by municipal class.</p>
          </div>

          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} stroke="#e2e8f0" />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} stroke="#e2e8f0" />
                <Tooltip contentStyle={{ background: "#0f172a", borderRadius: "8px", border: "none", color: "#fff", fontSize: "10px" }} />
                <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                <Bar dataKey="Active" fill="#f43f5e" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Resolved" fill="#10b981" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Grid containing Active Impact Summary and Surgical AI-Suggestions for Municipality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* 📈 ACTIVE IMPACT SUMMARY */}
        <div id="active-impact-summary-panel" className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-between">
          <div>
            {/* Glow ambient background graphics */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Heading */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Sparkles className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-emerald-500/20 text-emerald-300 font-mono text-[8px] px-1.5 py-0.2 rounded-full border border-emerald-500/30 font-bold uppercase tracking-widest">
                    City Analytics Core
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <h2 className="font-sans font-extrabold text-white text-base md:text-lg mt-0.5">
                  Civic+ Impact Summary
                </h2>
              </div>
            </div>

            {/* Reduced to 4 points of at max 4-5 words with numeric data */}
            <div className="space-y-2.5">
              <div className="flex gap-2.5 items-center bg-slate-850/50 border border-slate-800/80 hover:border-emerald-500/30 rounded-xl p-3 transition-all">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0">
                  1
                </div>
                <p className="text-slate-300 text-xs font-semibold leading-none">
                  <strong className="text-white font-extrabold">{totalVerificationsCount}</strong> citizen verifications registered
                </p>
              </div>

              <div className="flex gap-2.5 items-center bg-slate-850/50 border border-slate-800/80 hover:border-emerald-500/30 rounded-xl p-3 transition-all">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0">
                  2
                </div>
                <p className="text-slate-300 text-xs font-semibold leading-none">
                  <strong className="text-white font-extrabold">{resolvedCount}</strong> critical hazards resolved
                </p>
              </div>

              <div className="flex gap-2.5 items-center bg-slate-850/50 border border-slate-800/80 hover:border-emerald-500/30 rounded-xl p-3 transition-all">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0">
                  3
                </div>
                <p className="text-slate-300 text-xs font-semibold leading-none">
                  <strong className="text-white font-extrabold">{totalReportsCount}</strong> incoming reports routed
                </p>
              </div>

              <div className="flex gap-2.5 items-center bg-slate-850/50 border border-slate-800/80 hover:border-emerald-500/30 rounded-xl p-3 transition-all">
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-mono text-[10px] font-bold text-white shrink-0">
                  4
                </div>
                <p className="text-slate-300 text-xs font-semibold leading-none">
                  <strong className="text-white font-extrabold">{crewsDispatchedCount}</strong> municipal crews dispatched
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ⚡ SURGICAL AI-SUGGESTIONS FOR MUNICIPALITY */}
        <div id="surgical-suggestions-panel" className="bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 shadow-xl p-5 md:p-6 relative overflow-hidden flex flex-col justify-between">
          <div>
            {/* Glow ambient background graphics */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            {/* Heading */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-500/20 text-indigo-300 font-mono text-[8px] px-1.5 py-0.2 rounded-full border border-indigo-500/30 font-bold uppercase tracking-widest">
                    Surgical Dispatch Guide
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                </div>
                <h2 className="font-sans font-extrabold text-white text-base md:text-lg mt-0.5">
                  Surgical AI-Suggestions for Municipality
                </h2>
              </div>
            </div>

            {/* 3 Suggestions in easy language */}
            <div className="space-y-3">
              {isLoadingSurgical ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2 text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-[10px] font-mono">Agentic AI formulating surgical action plans...</span>
                </div>
              ) : processedSuggestions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No active issues to formulate surgical dispatch plans.
                </div>
              ) : (
                processedSuggestions.map((suggestion, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-850/50 border border-slate-800/80 hover:border-indigo-500/30 rounded-xl p-3 transition-all relative animate-in fade-in duration-200"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-black uppercase tracking-wider text-indigo-400">
                            {suggestion.area}
                          </span>
                          {suggestion.isCustomNamed && (
                            <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono text-[8.5px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                              Custom Named Area
                            </span>
                          )}
                        </div>
                        <h4 className="text-white text-xs font-bold capitalize mt-0.5">
                          {suggestion.issueType}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {suggestion.isDuplicate ? (
                          <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase">
                            ⚠️ {suggestion.count} Duplicated Reports
                          </span>
                        ) : (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase">
                            🔥 High Urgency Alert
                          </span>
                        )}
                        
                        <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                          suggestion.priority === "Critical" ? "bg-rose-600 text-white" : "bg-indigo-600 text-white"
                        }`}>
                          {suggestion.priority}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-300 text-[11px] font-medium leading-relaxed">
                      <strong className="text-indigo-300">Action: </strong>
                      {suggestion.measure}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
