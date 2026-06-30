import { useState, useEffect } from "react";
import { CivicIssue } from "../types";
import { 
  Heart, MapPin, Share2, Calendar, 
  ArrowRightLeft, Clock, MapIcon, Sparkles, CheckCircle
} from "lucide-react";

const formatTimelineDate = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parts[0].substring(2);
    const month = parts[1];
    const day = parts[2];
    return `${day}/${month}/${year}`;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).substring(2);
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // ignore
  }
  return dateStr;
};

interface TrackTabProps {
  issues: CivicIssue[];
  onVerify: (id: string) => void;
  onNavigateToTab: (tabName: string, id?: string) => void;
  searchQuery?: string;
  onUpdateStatus?: (id: string, newStatus: "reported" | "in-progress" | "resolved") => void;
  userLocation?: { lat: number; lng: number };
  currentUserEmail?: string;
  currentWard?: string;
  cityName?: string;
}

export default function TrackTab({ issues, onVerify, onNavigateToTab, searchQuery, onUpdateStatus, userLocation, currentUserEmail, currentWard, cityName }: TrackTabProps) {
  const [activeFilter, setActiveFilter] = useState<"reported" | "in-progress" | "resolved">("reported");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [shareSuccessId, setShareSuccessId] = useState<string | null>(null);
  const [expandedAiSummaries, setExpandedAiSummaries] = useState<Record<string, boolean>>({});
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  // Auto-expand and align category selection based on hashtag or search queries
  useEffect(() => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase().replace("#", "").trim();
      if (q.includes("pothole")) {
        setSelectedCategory("pothholes");
      } else if (q.includes("light")) {
        setSelectedCategory("street lights");
      } else if (q.includes("water")) {
        setSelectedCategory("water leakage");
      } else if (q.includes("garbage") || q.includes("trash") || q.includes("waste")) {
        setSelectedCategory("waste managemnt");
      } else if (q.includes("road") || q.includes("infra")) {
        setSelectedCategory("roads and infrastructure");
      } else {
        setSelectedCategory("All");
      }

      // Automatically expand descriptions and AI summaries of all matching issues
      const matchingIds: Record<string, boolean> = {};
      issues.forEach((issue) => {
        matchingIds[issue.id] = true;
      });
      setExpandedDescriptions(matchingIds);
      setExpandedAiSummaries(matchingIds);
    }
  }, [searchQuery, issues]);

  const categories = ["All", "street lights", "waste managemnt", "roads and infrastructure", "water leakage", "pothholes"];

  const userLat = userLocation?.lat ?? 25.2820;
  const userLng = userLocation?.lng ?? 83.0080;

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    return R * c; // Distance in km
  };

  // Filter Issues (Only show issues within 30km of user's live location)
  const filteredIssues = issues.filter((issue) => {
    const matchesStatus = issue.status === activeFilter;
    const matchesCategory = selectedCategory === "All" || issue.category === selectedCategory;
    const distance = getDistanceKm(userLat, userLng, issue.lat, issue.lng);
    const isNearby = distance <= 30;

    return matchesStatus && matchesCategory && isNearby;
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "Critical": return "bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse";
      case "High": return "bg-amber-50 text-amber-700 border-amber-200 font-semibold";
      case "Medium": return "bg-yellow-50 text-yellow-600 border-yellow-200 font-medium";
      default: return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "waste managemnt": return "text-orange-600";
      case "roads and infrastructure": return "text-purple-600";
      case "water leakage": return "text-cyan-600";
      case "street lights": return "text-yellow-600";
      case "pothholes": return "text-red-600";
      default: return "text-blue-600";
    }
  };

  const handleShare = (id: string) => {
    // Write link to clipboard
    const shareUrl = `${window.location.origin}?issueId=${id}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setShareSuccessId(id);
        setTimeout(() => setShareSuccessId(null), 2500);
      })
      .catch(() => {});
  };

  return (
    <div id="track-page-container" className="max-w-5xl mx-auto p-4 md:p-6">
      
      {/* Filters Segment (Search removed) */}
      <div id="track-filter-segment" className="bg-white rounded-2xl border border-slate-100 p-4 md:p-6 shadow-sm mb-6 flex flex-col sm:flex-row gap-4 justify-between items-center shrink-0">
        
        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setActiveFilter("reported")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-sans transition-all ${
              activeFilter === "reported" ? "bg-amber-100 text-amber-700 shadow-sm border border-amber-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            New Reports
          </button>
          <button
            onClick={() => setActiveFilter("in-progress")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-sans transition-all ${
              activeFilter === "in-progress" ? "bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Under Inspection
          </button>
          <button
            onClick={() => setActiveFilter("resolved")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-sans transition-all ${
              activeFilter === "resolved" ? "bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Solved Issues
          </button>
        </div>

      </div>

      {/* Grid of Cards */}
      <div id="track-cards-grid" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredIssues.length > 0 ? (
          filteredIssues.map((issue) => {
            const hasAfterImage = !!issue.afterImageUrl;

            // Prepare a citizen-friendly filtered timeline
            const baseTimeline = issue.timeline.filter(event => event.status !== "verified");
            const hasInProgress = baseTimeline.some(event => event.status === "in-progress");
            const hasResolved = baseTimeline.some(event => event.status === "resolved");
            
            if (hasResolved && !hasInProgress) {
              const reportedEvent = baseTimeline.find(event => event.status === "reported");
              const reportedDateStr = reportedEvent ? reportedEvent.date : "2026-06-22";
              baseTimeline.splice(1, 0, {
                status: "in-progress",
                date: reportedDateStr,
                description: "Municipal inspector verified the site and scheduled a cleanup crew."
              });
            }

            return (
              <div
                key={issue.id}
                id={`track-issue-card-${issue.id}`}
                className="bg-white rounded-2xl border border-slate-100 shadow-md hover:shadow-lg transition-all p-5 flex flex-col justify-between overflow-hidden relative"
              >
                {/* Header info */}
                <div>
                  {/* Single-line high-profile resolved highlight at top */}
                  {issue.status === "resolved" && (
                    <div className="mb-3.5 bg-emerald-500 text-white text-[10px] font-sans font-extrabold rounded-lg py-1.5 px-3 flex items-center gap-1.5 uppercase tracking-wider shadow-sm select-none">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-100 shrink-0" />
                      <span>Issue Solved & Resolved</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[11px] font-sans font-extrabold uppercase tracking-wider ${getCategoryColor(issue.category)}`}>
                        {issue.category}
                      </span>
                      <span className={`text-[9px] border px-2 py-0.5 rounded font-bold uppercase font-sans ${getUrgencyBadge(issue.urgency)}`}>
                        Urgency: {issue.urgency}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans flex items-center gap-1 shrink-0">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(issue.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title & Location details */}
                  <h3 className="font-sans font-bold text-slate-800 text-sm md:text-base mt-3 mb-1">
                    {issue.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-sans flex items-center gap-1 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    Area: <strong className="text-slate-600 uppercase font-bold">{issue.locality}</strong>
                  </p>

                  {/* Before & After Proof */}
                  {issue.status === "resolved" && hasAfterImage ? (
                    <div id={`before-after-panel-${issue.id}`} className="mb-4 bg-gradient-to-r from-slate-50 via-white to-emerald-50 rounded-xl p-3 border border-emerald-100">
                      <span className="text-[9px] font-mono font-black text-emerald-700 block mb-2 uppercase tracking-widest text-center">
                        Proof of Fix (Before & After)
                      </span>
                      <div className="flex gap-2 items-center justify-center">
                        {/* Before Frame */}
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-100 shadow-sm shrink-0">
                          <img src={issue.imageUrl} className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 left-1 bg-black/60 text-white font-mono text-[8px] px-1 rounded">
                            Before
                          </span>
                        </div>
                        {/* Swapper icon */}
                        <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                          <ArrowRightLeft className="w-4 h-4 text-emerald-600 animate-pulse" />
                        </div>
                        {/* After Frame */}
                        <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-emerald-200 shadow-sm shrink-0">
                          <img src={issue.afterImageUrl} className="w-full h-full object-cover" />
                          <span className="absolute bottom-1 left-1 bg-emerald-600 text-white font-mono text-[8px] px-1 rounded">
                            Fixed
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 text-center">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-3 py-1 rounded-full inline-flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Fixed in {issue.resolvedIn || "3 days"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Default Single Image */
                    <div className="relative w-full h-44 rounded-xl overflow-hidden mb-4 border border-slate-100">
                      <img src={issue.imageUrl} className="w-full h-full object-cover transition-transform duration-300 hover:scale-102" />
                      <span className={`absolute top-3 right-3 text-[9px] font-mono font-bold px-2 py-1 rounded-md border capitalize shadow ${
                        issue.status === "in-progress" ? "bg-emerald-600 text-white border-emerald-700" : "bg-amber-500 text-white border-amber-600"
                      }`}>
                        {issue.status === "in-progress" ? "working on it" : issue.status}
                      </span>
                    </div>
                  )}

                  {/* Full Description Segment with Toggle */}
                  <div className="mb-4 bg-slate-50/50 hover:bg-slate-50 p-2.5 rounded-xl border border-slate-100/50 transition-all">
                    <button
                      onClick={() => setExpandedDescriptions(prev => ({ ...prev, [issue.id]: !prev[issue.id] }))}
                      className="text-left w-full focus:outline-none group cursor-pointer text-xs font-sans text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="font-sans text-[11px] text-slate-600 truncate">
                        <strong className="text-slate-700 font-bold mr-1.5">Full Description:</strong>
                        <span className="italic text-slate-500">
                          {issue.description.split(" ").slice(0, 4).join(" ")}...
                        </span>
                      </span>
                      <span className="text-[9px] bg-slate-200/60 text-slate-600 px-2 py-0.5 rounded-md font-bold group-hover:bg-slate-200 shrink-0 select-none">
                        {expandedDescriptions[issue.id] ? "Collapse" : "Click to View"}
                      </span>
                    </button>
                    
                    {expandedDescriptions[issue.id] && (
                      <p className="mt-2 text-slate-600 text-xs font-sans leading-relaxed bg-white p-3 rounded-lg border border-slate-100/80 transition-all duration-200">
                        {issue.description}
                      </p>
                    )}
                  </div>

                  {/* AI Summary Interactive Button */}
                  {issue.aiAnalysis && (
                    <div className="mb-4">
                      <button
                        onClick={() => setExpandedAiSummaries(prev => ({ ...prev, [issue.id]: !prev[issue.id] }))}
                        className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-sm cursor-pointer border border-purple-700/25"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-100" />
                        {expandedAiSummaries[issue.id] ? "Hide AI Summary" : "View AI Summary"}
                      </button>

                      {expandedAiSummaries[issue.id] && (
                        <div 
                          style={{ backgroundColor: "#e7d0fd" }}
                          className="mt-2 bg-purple-50/50 rounded-xl p-3 border border-purple-100 flex gap-2 items-start transition-all duration-200"
                        >
                          <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5 animate-pulse" />
                          <div className="min-w-0">
                            <span className="text-[9px] font-bold text-purple-800 block font-sans uppercase tracking-wider">AI Easy Summary</span>
                            <p className="text-[10px] text-slate-600 font-sans italic leading-normal mt-0.5">
                              "{issue.aiAnalysis}"
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timeline section */}
                  <div className="mt-4 pt-3 border-t border-slate-50">
                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2">Timeline of Fix</span>
                    <div className="space-y-3.5">
                      {baseTimeline.map((event, idx) => {
                        const isCompletedStep = event.status === "resolved" || event.status === "reported" || (event.status === "in-progress" && issue.status === "resolved");
                        
                        // Determine reporter name & ward
                        let reporterName = "You (Verified Citizen)";
                        if (issue.id === "issue-1") {
                          reporterName = "Aarav Sharma";
                        } else if (issue.id === "issue-2") {
                          reporterName = "Ananya Verma";
                        } else if (issue.id === "issue-3") {
                          reporterName = "Rahul Singh";
                        } else if (issue.id === "issue-4") {
                          reporterName = "Priya Patel";
                        } else if (issue.id === "issue-5") {
                          reporterName = "Vikram Malhotra";
                        } else if (issue.id === "issue-6") {
                          reporterName = "Divya Iyer";
                        } else if (issue.id === "issue-7") {
                          reporterName = "Amit Mishra";
                        } else if (issue.id === "issue-8") {
                          reporterName = "Sneha Reddy";
                        }

                        let wardName = currentWard;
                        if (!wardName || wardName.toLowerCase().includes("local ward") || wardName.toLowerCase().includes("unknown")) {
                          wardName = issue.locality ? `${issue.locality} Landmark` : "Local Area";
                        }

                        return (
                          <div key={idx} className="flex gap-2.5 items-start">
                            <div className="flex flex-col items-center shrink-0">
                              {isCompletedStep ? (
                                <CheckCircle className="w-4 h-4 text-emerald-600 bg-emerald-50 rounded-full shrink-0" />
                              ) : (
                                <Clock className="w-4 h-4 text-amber-500 bg-amber-50 rounded-full shrink-0" />
                              )}
                              {idx < baseTimeline.length - 1 && (
                                <div className="w-0.5 h-10 bg-slate-100" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] text-slate-400 font-mono font-semibold block">{formatTimelineDate(event.date)}</span>
                              
                              {event.status === "reported" && (
                                <div className="mt-0.5">
                                  <span className="inline-block bg-amber-500 text-white text-[9.5px] font-sans font-black uppercase px-2 py-0.5 rounded-md tracking-wider shadow-2xs">
                                    Report Filed
                                  </span>
                                  <p className="text-[10px] text-slate-700 font-sans leading-tight mt-1">
                                    Issue filed by <span className="font-extrabold text-slate-900">{reporterName}</span> from <span className="font-extrabold text-slate-900">{wardName}</span>.
                                  </p>
                                  <p className="text-[9.5px] text-slate-500 font-sans italic mt-0.5">
                                    "{issue.description}"
                                  </p>
                                </div>
                              )}

                              {event.status === "in-progress" && (
                                <div className="mt-0.5">
                                  <span className="inline-block bg-blue-600 text-white text-[9.5px] font-sans font-black uppercase px-2 py-0.5 rounded-md tracking-wider shadow-2xs">
                                    Inspection & Action
                                  </span>
                                  <p className="text-[10px] text-slate-700 font-sans leading-tight mt-1">
                                    Scheduled and assigned to the {cityName || "Varanasi"} Municipal crew.
                                  </p>
                                  <p className="text-[9.5px] text-slate-500 font-sans italic mt-0.5">
                                    "Inspector verified site and dispatched cleanup/repair crew."
                                  </p>
                                </div>
                              )}

                              {event.status === "resolved" && (
                                <div className="mt-0.5">
                                  <span className="inline-block bg-emerald-600 text-white text-[9.5px] font-sans font-black uppercase px-2 py-0.5 rounded-md tracking-wider shadow-2xs">
                                    Fixed & Resolved
                                  </span>
                                  <p className="text-[10px] text-slate-700 font-sans leading-tight mt-1">
                                    {cityName || "Varanasi"} Sanitation & Infrastructure Department successfully resolved the issue.
                                  </p>
                                  <p className="text-[9.5px] text-slate-500 font-sans italic mt-0.5">
                                    "On-site team executed final repair work, cleaned surrounding area, and updated proof."
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Simulated Municipal Action Controls for Testing Badges */}
                {issue.id.startsWith("issue-custom-") && onUpdateStatus && (
                  <div className="mt-4 p-3 bg-slate-50/70 border border-slate-100 rounded-xl flex flex-col gap-2">
                    <span className="text-[9.5px] font-sans font-black text-slate-500 uppercase tracking-wider block">
                      ⚙️ Simulate Municipal Action:
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                      <button 
                        onClick={() => onUpdateStatus(issue.id, "reported")}
                        className={`px-2 py-1 rounded-md text-[9px] font-bold font-sans transition-all cursor-pointer ${
                          issue.status === "reported" 
                            ? "bg-amber-100 text-amber-800 border border-amber-200" 
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        New Report
                      </button>
                      <button 
                        onClick={() => onUpdateStatus(issue.id, "in-progress")}
                        className={`px-2 py-1 rounded-md text-[9px] font-bold font-sans transition-all cursor-pointer ${
                          issue.status === "in-progress" 
                            ? "bg-blue-100 text-blue-800 border border-blue-200" 
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        In Progress
                      </button>
                      <button 
                        onClick={() => onUpdateStatus(issue.id, "resolved")}
                        className={`px-2 py-1 rounded-md text-[9px] font-bold font-sans transition-all cursor-pointer ${
                          issue.status === "resolved" 
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        Resolved 🎉
                      </button>
                    </div>
                  </div>
                )}

                {/* Footer Controls */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10.5px] text-slate-550 font-sans font-bold">
                      👍 {issue.verificationCount} neighbor votes
                    </span>
                  </div>

                  {/* Action Group */}
                  <div className="flex items-center gap-1.5">
                    {/* Verify Upvote Button */}
                    {!issue.verifications.includes(currentUserEmail || "sunflowerr.flowerr25@gmail.com") && issue.status !== "resolved" ? (
                      <button
                        onClick={() => onVerify(issue.id)}
                        style={issue.id === "issue-2" ? { backgroundColor: "#009966" } : undefined}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                        title="Verify this civic report"
                      >
                        <Heart className="w-3 h-3 fill-rose-500 stroke-rose-500" />
                        Verify
                      </button>
                    ) : (
                      <span 
                        style={issue.id === "issue-1" ? { backgroundColor: "#d1f9f9" } : undefined}
                        className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-lg border border-emerald-200"
                      >
                        {issue.status === "resolved" ? "Resolved 🎉" : "Verified ✓"}
                      </span>
                    )}

                    {/* Track Fly-to-map Button */}
                    <button
                      onClick={() => onNavigateToTab("Map", issue.id)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1 transition-all cursor-pointer"
                      title="Fly to coordinate on map"
                    >
                      <MapIcon className="w-3 h-3" />
                      Track
                    </button>

                    {/* Share Button */}
                    <button
                      onClick={() => handleShare(issue.id)}
                      className={`text-[10px] font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                        shareSuccessId === issue.id 
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                      }`}
                      title="Copy sharing link to clipboard"
                    >
                      <Share2 className="w-3 h-3" />
                      {shareSuccessId === issue.id ? "Copied" : "Share"}
                    </button>
                  </div>
                </div>

              </div>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 bg-slate-50/50 rounded-2xl border border-slate-100">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="font-sans font-bold text-slate-700">No reports match this category</h4>
            <p className="text-slate-400 text-xs mt-1">Try selecting another Category.</p>
          </div>
        )}
      </div>

    </div>
  );
}
