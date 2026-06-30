import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { CivicIssue } from "../types";
import { Compass, Maximize, Navigation, Layers, CheckCircle2, AlertTriangle, Flame, ShieldAlert, Heart, Map as MapIcon, RotateCcw, Sparkles, Info, Moon, Check, X } from "lucide-react";

interface MapTabProps {
  issues: CivicIssue[];
  onVerify: (id: string) => void;
  selectedIssueId: string | null;
  onSelectIssue: (id: string | null) => void;
  userLocation?: { lat: number; lng: number };
  cityName?: string;
  currentWard?: string;
  currentUserEmail?: string;
}

const WARD_BOUNDARIES_DATA = [
  {
    name: "BHU Gate",
    desc: "Premium University Buffer Corridor",
    color: "#6366f1", // Indigo
    coords: [
      [25.260, 82.992],
      [25.271, 82.994],
      [25.270, 83.006],
      [25.259, 83.003]
    ] as [number, number][]
  },
  {
    name: "Lanka",
    desc: "Commercial Hub with High Resident Footfall",
    color: "#a855f7", // Purple
    coords: [
      [25.271, 82.994],
      [25.281, 82.995],
      [25.280, 83.008],
      [25.270, 83.006]
    ] as [number, number][]
  },
  {
    name: "Assi",
    desc: "Historical River Approach / Ghat Zone",
    color: "#06b6d4", // Cyan
    coords: [
      [25.281, 82.995],
      [25.293, 83.000],
      [25.291, 83.013],
      [25.280, 83.008]
    ] as [number, number][]
  }
];

export default function MapTab({ 
  issues, 
  onVerify, 
  selectedIssueId, 
  onSelectIssue,
  userLocation,
  cityName,
  currentWard,
  currentUserEmail
}: MapTabProps) {
  const userLat = userLocation?.lat ?? 25.2820;
  const userLng = userLocation?.lng ?? 83.0080;
  const userCity = cityName || "Varanasi";

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

  const localIssues = issues.filter((issue) => {
    const distance = getDistanceKm(userLat, userLng, issue.lat, issue.lng);
    return distance <= 30;
  });

  const cityHasWards = userCity.toLowerCase().includes("varanasi") || 
                       userCity.toLowerCase().includes("banaras") || 
                       userCity.toLowerCase().includes("vns");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const wardPolygonsRef = useRef<L.Polygon[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const userCircleRef = useRef<L.Circle | null>(null);

  const [mapMode, setMapMode] = useState<"standard" | "satellite">("standard");
  const [is3D, setIs3D] = useState(false);
  const [compassAngle, setCompassAngle] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<CivicIssue | null>(null);
  const [resolvedIssueToShow, setResolvedIssueToShow] = useState<CivicIssue | null>(null);
  const [showDescription, setShowDescription] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [isLayersDropdownOpen, setIsLayersDropdownOpen] = useState(false);
  const [enabledLayers, setEnabledLayers] = useState({
    activeIssues: false,
    resolvedIssues: false,
    underInspection: false,
    wardBoundaries: false
  });
  const [isMapReady, setIsMapReady] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFull = !!document.fullscreenElement;
      setIsFullscreen(isCurrentlyFull);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Helper for traveling safety advices (each point maximum 4-5 words)
  const getTravelSafetyAdvices = (issue: CivicIssue) => {
    const cat = normalizeCategory(issue.category);
    const isCritical = issue.urgency === "Critical" || issue.urgency === "High";
    
    switch (cat) {
      case "waste managemnt":
        return [
          isCritical ? "After 7pm avoid route" : "Avoid driving over debris",
          "Keep car windows closed",
          "Watch out stray animals",
          isCritical ? "Avoid blocked road lanes" : "Slow down at pile"
        ];
      case "roads and infrastructure":
        return [
          isCritical ? "After 7pm avoid route" : "Use well-lit alternate routes",
          "Avoid overtaking vehicles here",
          "Follow temporary sign boards",
          "Drive slowly near construction"
        ];
      case "water leakage":
        return [
          "Beware slippery road surface",
          isCritical ? "Avoid flooded street routes" : "Avoid sudden hard braking",
          "Check tire grip before",
          "Maintain safe vehicle gap"
        ];
      case "street lights":
        return [
          isCritical ? "After 7pm avoid route" : "Use well-lit roads post-sunset",
          "Keep vehicle headlights high",
          "Watch for dark pedestrians",
          "Stay highly alert on turns"
        ];
      case "pothholes":
        return [
          isCritical ? "Reduce speed below 20kmh" : "Reduce travel speed immediately",
          "Avoid sudden lane change",
          isCritical ? "After 7pm avoid route" : "Watch front vehicle closely",
          "Hold steering wheel firmly"
        ];
      default:
        return [
          isCritical ? "After 7pm avoid route" : "Use well-lit roads post-sunset",
          "Proceed with high caution",
          "Maintain safe speed limits",
          "Stay alert on road"
        ];
    }
  };

  // Helper for future risk AI predictions depending on issue type and urgency
  const getAIPredictions = (issue: CivicIssue) => {
    const cat = normalizeCategory(issue.category);
    const isCritical = issue.urgency === "Critical" || issue.urgency === "High";
    switch (cat) {
      case "waste managemnt":
        return [
          isCritical ? "🚨 Severe rodent infestation risk" : "⚠️ Minor health/sanitation degradation",
          "😷 Foul odor dispersion expected",
          "⚠️ Stray animal gather risk",
          isCritical ? "🚨 Lane blockage within 48h" : "⚠️ Street cleanliness drop"
        ];
      case "roads and infrastructure":
        return [
          isCritical ? "🚨 Severe vehicle chassis damage" : "⚠️ Minor car suspension wear",
          "🚗 High peak-hour travel delay",
          "⚠️ Tire puncture risk present",
          isCritical ? "🚨 Sudden car swerving danger" : "⚠️ Intermittent lane blockages"
        ];
      case "water leakage":
        return [
          isCritical ? "🚨 Road sub-surface erosion risk" : "⚠️ Surface street flooding risk",
          "🦠 High stagnant water infection",
          "🚗 Vehicle hydroplaning hazard danger",
          "⚠️ Asphalt damage over time"
        ];
      case "street lights":
        return [
          isCritical ? "🚨 High personal safety risk" : "⚠️ Restricted road visibility risk",
          "🚗 Pedestrian accident risk increases",
          "⚠️ Turn navigation confusion hazard",
          isCritical ? "🚨 Complete block safety risk" : "⚠️ Reduced transit accuracy"
        ];
      case "pothholes":
        return [
          isCritical ? "🚨 Car tire blowout risk" : "⚠️ Vehicle suspension damage risk",
          "🚗 Sudden braking crash risk",
          "⚠️ Pedestrian trip hazard risk",
          isCritical ? "🚨 Total lane failure danger" : "⚠️ Mud splash hazard danger"
        ];
      default:
        return [
          isCritical ? "🚨 Hazard level escalation risk" : "⚠️ Ongoing minor safety risk",
          "🚗 Gradual transit delay risk",
          "⚠️ Safety rating decline risk"
        ];
    }
  };

  // Render highlighted text dynamically (max 2-3 words highlighted in red or yellow/amber, others black)
  const renderHighlightedText = (text: string) => {
    const lowercase = text.toLowerCase();
    
    // RED alerts
    if (lowercase.includes("after 7pm avoid")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-red-600 font-black">After 7pm avoid</span> {text.replace(/after 7pm avoid/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("avoid blocked")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-red-600 font-black">Avoid blocked</span> {text.replace(/avoid blocked/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("avoid flooded")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-red-600 font-black">Avoid flooded</span> {text.replace(/avoid flooded/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("avoid overtaking")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-red-600 font-black">Avoid overtaking</span> {text.replace(/avoid overtaking/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("beware slippery")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-red-600 font-black">Beware slippery</span> {text.replace(/beware slippery/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("reduce speed")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-red-600 font-black">Reduce speed</span> {text.replace(/reduce speed/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("high caution")) {
      return (
        <span className="text-slate-900 font-semibold">
          Proceed with <span className="text-red-600 font-black">high caution</span>
        </span>
      );
    }

    // YELLOW alerts
    if (lowercase.includes("avoid driving")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Avoid driving</span> {text.replace(/avoid driving/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("avoid sudden")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Avoid sudden</span> {text.replace(/avoid sudden/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("keep car windows")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Keep windows closed</span>
        </span>
      );
    }
    if (lowercase.includes("keep vehicle headlights")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Headlights high</span>
        </span>
      );
    }
    if (lowercase.includes("use well-lit")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Use well-lit</span> {text.replace(/use well-lit/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("drive slowly")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Drive slowly</span> {text.replace(/drive slowly/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("stay highly alert") || lowercase.includes("stay alert")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Stay highly alert</span>
        </span>
      );
    }
    if (lowercase.includes("watch out")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Watch out</span> {text.replace(/watch out/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("watch for")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Watch for</span> {text.replace(/watch for/i, "").trim()}
        </span>
      );
    }
    if (lowercase.includes("watch front")) {
      return (
        <span className="text-slate-900 font-semibold">
          <span className="text-amber-500 font-black">Watch front</span> {text.replace(/watch front/i, "").trim()}
        </span>
      );
    }

    return <span className="text-slate-800 font-semibold">{text}</span>;
  };

  // Map Tile Layers
  const tileLayers = {
    standard: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", // Airbnb-like warm styling
    satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", // Real Esri Satellite
  };

  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Normalize category string to handle spelling and casing variations
  const normalizeCategory = (category: string): string => {
    if (!category) return "";
    const clean = category.trim().toLowerCase();
    if (clean.includes("waste")) return "waste managemnt";
    if (clean.includes("road") || clean.includes("infrastructure")) return "roads and infrastructure";
    if (clean.includes("water") || clean.includes("leak")) return "water leakage";
    if (clean.includes("light") || clean.includes("lamp")) return "street lights";
    if (clean.includes("pothole") || clean.includes("pothhole")) return "pothholes";
    return clean;
  };

  // Get color for category
  const getCategoryColor = (category: string) => {
    const normalized = normalizeCategory(category);
    switch (normalized) {
      case "waste managemnt": return "#f97316"; // orange
      case "roads and infrastructure": return "#a855f7"; // purple
      case "water leakage": return "#06b6d4"; // cyan
      case "street lights": return "#eab308"; // yellow
      case "pothholes": return "#8B4513"; // brown
      default: return "#8B4513"; // brown
    }
  };

  // Get SVG path/content for markers
  const getSvgIconContent = (category: string) => {
    const normalized = normalizeCategory(category);
    switch (normalized) {
      case "waste managemnt":
        return `<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>`;
      case "roads and infrastructure":
        return `<path d="M4 22V4c0-.5.2-1 .6-1.4C5 2.2 5.5 2 6 2h12c.5 0 1 .2 1.4.6.4.4.6.9.6 1.4v18M12 2v20M8 8h8M8 14h8"/>`;
      case "water leakage":
        return `<path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/>`;
      case "street lights":
        return `<path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M12 2v3M12 19v3M20 12h2M2 12h2M17.6 6.4l-2.1 2.1M8.5 15.5l-2.1 2.1"/>`;
      case "pothholes":
        return `<circle cx="12" cy="12" r="10"/><path d="m10 15 2-2 2 2M10 9l2 2 2-2"/>`;
      default:
        return `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3ZM12 9v4M12 17h.01"/>`;
    }
  };

  // Create pulsing customized marker
  const createCustomMarker = (category: string, status: string, severity: string) => {
    const isResolved = status === "resolved";
    const isUnderInspection = status === "in-progress";
    const color = getCategoryColor(category);
    
    const shadowColor = isResolved 
      ? "#10b98144" 
      : isUnderInspection 
        ? "#3b82f644" 
        : color + "44";
        
    const borderClass = isResolved 
      ? "border-emerald-500 shadow-[0_0_8px_#10b981]" 
      : isUnderInspection 
        ? "border-blue-500 shadow-[0_0_8px_#3b82f6]" 
        : "border-white";

    let tickBadgeHtml = "";
    if (isResolved) {
      tickBadgeHtml = `
        <div class="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-emerald-500 rounded-full border border-white flex items-center justify-center shadow-md z-10" style="box-shadow: 0 0 6px rgba(16,185,129,0.6);">
          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `;
    } else if (isUnderInspection) {
      tickBadgeHtml = `
        <div class="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-blue-500 rounded-full border border-white flex items-center justify-center shadow-md z-10" style="box-shadow: 0 0 6px rgba(59,130,246,0.6);">
          <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `;
    }

    const html = `
      <div class="relative flex items-center justify-center" style="width: 36px; height: 36px;">
        <div class="absolute inset-0 rounded-full animate-ping opacity-40" style="background-color: ${shadowColor};"></div>
        <div class="relative w-8 h-8 rounded-full border-2 ${borderClass} shadow-lg flex items-center justify-center text-white transition-transform duration-300 hover:scale-115" style="background-color: ${color};">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${getSvgIconContent(category)}
          </svg>
          ${tickBadgeHtml}
        </div>
      </div>
    `;

    return L.divIcon({
      html: html,
      className: "custom-leaflet-icon",
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [userLat, userLng],
      zoom: 14,
      zoomControl: false, // Position standard zoom to bottom-right or custom
    });

    mapRef.current = map;
    setIsMapReady(true);

    // Add Tile Layer
    const layer = L.tileLayer(tileLayers[mapMode], {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
    }).addTo(map);
    tileLayerRef.current = layer;

    // Add custom zoom control at bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Track map heading when dragged/rotated if needed
    map.on("drag", () => {
      // simulate minor organic compass movement
      setCompassAngle((prev) => (prev + 0.5) % 360);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  // Sync live location marker on user's current-live position and always locate user
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Remove existing user marker and circle if any
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (userCircleRef.current) {
      userCircleRef.current.remove();
      userCircleRef.current = null;
    }

    // Always center map on user's current-live position
    map.setView([userLat, userLng], 14);

    // Create custom pulsing marker for user's live position
    const locateIcon = L.divIcon({
      html: `
        <div class="w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg relative">
          <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
          <div class="w-2.5 h-2.5 bg-white rounded-full"></div>
        </div>
      `,
      className: "current-location-marker",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    userMarkerRef.current = L.marker([userLat, userLng], { icon: locateIcon }).addTo(map);

    // Also add a light range circle around the user's location
    userCircleRef.current = L.circle([userLat, userLng], {
      radius: 120,
      color: "#3b82f6",
      fillColor: "#3b82f6",
      fillOpacity: 0.1,
      weight: 1.5,
    }).addTo(map);

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (userCircleRef.current) {
        userCircleRef.current.remove();
        userCircleRef.current = null;
      }
    };
  }, [userLat, userLng, isMapReady]);

  // Sync Map Layers
  useEffect(() => {
    if (tileLayerRef.current && mapRef.current) {
      tileLayerRef.current.setUrl(tileLayers[mapMode]);
    }
  }, [mapMode]);

  // Sync Ward Boundaries Polygons
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Clear existing polygons
    wardPolygonsRef.current.forEach((polygon) => polygon.remove());
    wardPolygonsRef.current = [];

    if (enabledLayers.wardBoundaries && cityHasWards) {
      WARD_BOUNDARIES_DATA.forEach((ward) => {
        const polygon = L.polygon(ward.coords, {
          color: ward.color,
          fillColor: ward.color,
          fillOpacity: 0.12,
          weight: 2.5,
          dashArray: "6, 6",
        }).addTo(map);

        polygon.bindTooltip(
          `<div class="font-sans p-1">
            <span class="font-black text-indigo-600 block text-xs">${ward.name} Ward</span>
            <span class="text-[9.5px] text-slate-500 font-bold block mt-0.5">${ward.desc}</span>
           </div>`,
          { permanent: false, direction: "center", className: "custom-ward-tooltip bg-white/95 border border-slate-100 shadow-md rounded-lg p-1.5" }
        );

        wardPolygonsRef.current.push(polygon);
      });
    }
  }, [enabledLayers.wardBoundaries, isMapReady, cityHasWards]);

  // Sync Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // Clear old markers
    Object.keys(markersRef.current).forEach((key) => {
      markersRef.current[key]?.remove();
    });
    markersRef.current = {};

    const allIssuesLayersUnticked = !enabledLayers.activeIssues && !enabledLayers.resolvedIssues && !enabledLayers.underInspection;

    // Load new markers
    issues.forEach((issue) => {
      // Determine if issue is visible based on layer settings
      let isVisible = true;
      if (!allIssuesLayersUnticked) {
        if (issue.status === "resolved") {
          isVisible = enabledLayers.resolvedIssues;
        } else if (issue.status === "in-progress") {
          isVisible = enabledLayers.underInspection;
        } else { // reported or verified
          isVisible = enabledLayers.activeIssues;
        }
      }

      if (!isVisible) return;

      const marker = L.marker([issue.lat, issue.lng], {
        icon: createCustomMarker(issue.category, issue.status, issue.severity),
      });

      marker.addTo(map);
      marker.on("click", () => {
        setSelectedIssue(issue);
        onSelectIssue(issue.id);
        map.setView([issue.lat, issue.lng], 15);
        if (issue.status === "resolved") {
          setResolvedIssueToShow(issue);
        }
      });

      markersRef.current[issue.id] = marker;
    });

    // Fly to selected issue if requested from parent
    if (selectedIssueId) {
      const targetIssue = issues.find((i) => i.id === selectedIssueId);
      if (targetIssue) {
        setSelectedIssue(targetIssue);
        map.setView([targetIssue.lat, targetIssue.lng], 16);
      }
    }
  }, [issues, selectedIssueId, enabledLayers, isMapReady]);

  // Deselect selectedIssue if its layer is turned off
  useEffect(() => {
    if (selectedIssue) {
      const allIssuesLayersUnticked = !enabledLayers.activeIssues && !enabledLayers.resolvedIssues && !enabledLayers.underInspection;
      let isVisible = true;
      if (!allIssuesLayersUnticked) {
        if (selectedIssue.status === "resolved") {
          isVisible = enabledLayers.resolvedIssues;
        } else if (selectedIssue.status === "in-progress") {
          isVisible = enabledLayers.underInspection;
        } else {
          isVisible = enabledLayers.activeIssues;
        }
      }
      if (!isVisible) {
        setSelectedIssue(null);
        onSelectIssue(null);
      }
    }
  }, [enabledLayers, selectedIssue, onSelectIssue]);

  // Locate Layer option helper
  const handleLocateLayer = (layerKey: string) => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    // First ensure the layer is enabled
    setEnabledLayers((prev) => ({
      ...prev,
      [layerKey]: true,
    }));

    if (layerKey === "activeIssues") {
      const active = issues.filter((i) => i.status === "reported");
      if (active.length > 0) {
        const bounds = L.latLngBounds(active.map((i) => [i.lat, i.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else {
        map.setView([25.283, 83.006], 14);
      }
    } else if (layerKey === "underInspection") {
      const progress = issues.filter((i) => i.status === "in-progress");
      if (progress.length > 0) {
        const bounds = L.latLngBounds(progress.map((i) => [i.lat, i.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else {
        map.setView([25.283, 83.006], 14);
      }
    } else if (layerKey === "resolvedIssues") {
      const resolved = issues.filter((i) => i.status === "resolved");
      if (resolved.length > 0) {
        const bounds = L.latLngBounds(resolved.map((i) => [i.lat, i.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      } else {
        map.setView([25.283, 83.006], 14);
      }
    } else if (layerKey === "wardBoundaries") {
      if (!cityHasWards) return;
      const allCoords = WARD_BOUNDARIES_DATA.flatMap((w) => w.coords);
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  };

  useEffect(() => {
    setShowDescription(false);
  }, [selectedIssueId]);

  // Handle fly to current location
  const handleLocateMe = () => {
    if (!mapRef.current) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          mapRef.current?.setView([latitude, longitude], 15);

          // Add a pulsing accuracy circle and custom marker
          const accuracyMarker = L.circle([latitude, longitude], {
            radius: 80,
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
          }).addTo(mapRef.current!);

          const locateIcon = L.divIcon({
            html: `
              <div class="w-6 h-6 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center shadow-lg relative">
                <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                <div class="w-2.5 h-2.5 bg-white rounded-full"></div>
              </div>
            `,
            className: "current-location-marker",
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          L.marker([latitude, longitude], { icon: locateIcon }).addTo(mapRef.current!);
        },
        (err) => {
          alert("Could not retrieve geolocation. Centering back to Varanasi Hub.");
          mapRef.current?.setView([25.283, 83.006], 14);
        }
      );
    }
  };

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!fullscreenContainerRef.current) return;
    if (!isFullscreen) {
      fullscreenContainerRef.current.requestFullscreen?.()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document.exitFullscreen?.()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  };

  // Reset compass
  const handleResetCompass = () => {
    setCompassAngle(0);
    if (mapRef.current) {
      mapRef.current.setView([25.283, 83.006], 14);
    }
  };

  // Verify / upvote from map drawer
  const handleVerifyIssue = (id: string) => {
    onVerify(id);
    // update state locally to show immediate counter update
    if (selectedIssue && selectedIssue.id === id) {
      setSelectedIssue((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          verificationCount: prev.verificationCount + 1,
          verifications: [...prev.verifications, currentUserEmail || "sunflowerr.flowerr25@gmail.com"],
        };
      });
    }
  };

  // Urgency color helper
  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "Critical":
        return "bg-rose-50 border-rose-200 text-rose-700 font-bold";
      case "High":
        return "bg-amber-50 border-amber-200 text-amber-700 font-semibold";
      case "Medium":
        return "bg-yellow-50 border-yellow-200 text-yellow-600 font-medium";
      default:
        return "bg-slate-50 border-slate-200 text-slate-600";
    }
  };

  // Calculate issue category statistics dynamically
  const activePointsWithin30km = issues.filter((issue) => {
    if (issue.status === "resolved") return false;
    const distance = getDistanceKm(userLat, userLng, issue.lat, issue.lng);
    return distance <= 30;
  }).length;

  const darkSpotsCount = issues.filter(i => {
    const title = i.title.toLowerCase();
    const cat = i.category.toLowerCase();
    return title.includes("light") || title.includes("dark") || cat.includes("light") || cat.includes("dark");
  }).length;

  const roadHazardsCount = issues.filter(i => {
    const title = i.title.toLowerCase();
    const cat = i.category.toLowerCase();
    return title.includes("pothole") || title.includes("road") || title.includes("infra") || cat.includes("pothole") || cat.includes("road") || cat.includes("infra");
  }).length;

  return (
    <div id="map-page-container" className="h-[calc(100vh-140px)] flex flex-col md:flex-row relative gap-4 p-2 md:p-4 overflow-hidden">
      {/* Sidebar - AI Safety Advisor */}
      <div id="map-issues-sidebar" className="w-full md:w-80 shrink-0 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-slate-100 flex flex-col h-[340px] md:h-full z-[10] overflow-hidden">
        <div className="p-4 border-b border-slate-100 shrink-0 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-black text-slate-800 text-sm md:text-base flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse shrink-0" />
              AI Safety Advisor
            </h3>
            <span className="bg-emerald-50 text-emerald-600 font-mono text-[9px] px-2 py-0.5 rounded-full font-bold shrink-0">
              {issues.length} Active points
            </span>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-slate-400 italic font-medium">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-slate-100 border border-slate-200 text-slate-400 font-mono font-bold not-italic text-[9px] shrink-0 mt-0.5">i</span>
            <span>Choose any marker point on map to get ai-saftey advice</span>
          </div>

          {/* Active points within 30km of live location */}
          <div className="bg-blue-50/70 border border-blue-100/80 rounded-xl p-2.5 mt-1 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-sans font-black text-blue-900 block">Nearby Active Points</span>
              <span className="text-[9.5px] text-slate-500 font-medium block leading-tight">Within 30km of your live location</span>
            </div>
            <div className="bg-blue-600 text-white font-display font-extrabold text-xs px-2.5 py-1 rounded-lg shadow-sm shrink-0">
              {activePointsWithin30km}
            </div>
          </div>
        </div>

        {/* Dynamic Panel Main Area */}
        <div className="overflow-y-auto flex-1 p-3.5 space-y-4 bg-slate-50/50 flex flex-col">
          {selectedIssue ? (
            <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="text-[10px] font-mono font-black text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  Area safety measures
                </span>
                <button 
                  onClick={() => {
                    setSelectedIssue(null);
                    onSelectIssue(null);
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-red-500 bg-white hover:bg-red-50 hover:border-red-200 shadow-3xs px-2 py-1 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                >
                  Clear Area
                </button>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-3xs">
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wide block">SELECTED LOCATION</span>
                <h4 className="font-display font-black text-slate-800 text-sm mt-0.5 leading-tight">{selectedIssue.locality}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[8.5px] px-1.5 py-0.2 rounded-full font-bold uppercase border ${
                    selectedIssue.urgency === "Critical" ? "bg-red-50 text-red-600 border-red-200" :
                    selectedIssue.urgency === "High" ? "bg-amber-50 text-amber-600 border-amber-200" :
                    "bg-slate-50 text-slate-600 border-slate-200"
                  }`}>
                    {selectedIssue.urgency} Urgency
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans font-semibold">
                    Category: {selectedIssue.category}
                  </span>
                </div>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-3xs">
                <span className="text-[9.5px] font-mono font-black text-slate-400 uppercase tracking-wider block mb-2.5">
                  🛡️ TRAVEL SAFETY MEASURES:
                </span>
                <ul className="space-y-2">
                  {getTravelSafetyAdvices(selectedIssue).map((advice, index) => {
                    return (
                      <li key={index} className="text-[11px] text-slate-800 flex items-start gap-2">
                        <span className="text-slate-900 font-extrabold shrink-0 mt-0.5">•</span>
                        <span className="leading-tight">
                          {renderHighlightedText(advice)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 animate-in fade-in duration-200">
              <div className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider border-b border-slate-200/60 pb-1.5">
                City safety advices
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-3xs">
                <ul className="space-y-3">
                  <li className="text-[11px] text-slate-800 flex items-start gap-2">
                    <span className="text-slate-900 font-extrabold shrink-0 mt-0.5">•</span>
                    <span className="leading-tight font-semibold">
                      With {darkSpotsCount} dark spots, <span className="text-red-600 font-black">use well-lit roads</span> after sunset.
                    </span>
                  </li>

                  <li className="text-[11px] text-slate-800 flex items-start gap-2">
                    <span className="text-slate-900 font-extrabold shrink-0 mt-0.5">•</span>
                    <span className="leading-tight font-semibold">
                      Active hazards: <span className="text-red-600 font-black">reduce transit speeds</span> to prevent accidents.
                    </span>
                  </li>

                  <li className="text-[11px] text-slate-800 flex items-start gap-2">
                    <span className="text-slate-900 font-extrabold shrink-0 mt-0.5">•</span>
                    <span className="leading-tight font-semibold">
                      In critical spots, <span className="text-red-600 font-black">after 7pm avoid</span> using this route.
                    </span>
                  </li>

                  <li className="text-[11px] text-slate-800 flex items-start gap-2">
                    <span className="text-slate-900 font-extrabold shrink-0 mt-0.5">•</span>
                    <span className="leading-tight font-semibold">
                      Wet streets: <span className="text-amber-500 font-black">maintain safe distance</span> between vehicles.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Map Area Container */}
      <div 
        ref={fullscreenContainerRef}
        id="map-canvas-container" 
        className="flex-1 relative rounded-2xl shadow-lg border border-slate-100 overflow-hidden z-[1] h-full flex flex-col bg-slate-50"
      >
        {/* Style selection pill */}
        <div id="map-style-selector" className="absolute top-4 left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-xl p-1 shadow-md border border-slate-100 flex items-center gap-1">
          <button
            onClick={() => setMapMode("standard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-sans flex items-center gap-1 transition-all cursor-pointer ${
              mapMode === "standard" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Vector
          </button>
          <button
            onClick={() => setMapMode("satellite")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-sans flex items-center gap-1 transition-all cursor-pointer ${
              mapMode === "satellite" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Satellite
          </button>
          
          <div className="w-[1px] h-5 bg-slate-200 mx-1" />
          
          <button
            onClick={() => setIsLayersDropdownOpen(!isLayersDropdownOpen)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium font-sans flex items-center gap-1 transition-all relative cursor-pointer ${
              isLayersDropdownOpen ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Layers
            {Object.values(enabledLayers).some(v => !v) && (
              <span className="w-1.5 h-1.5 bg-rose-500 rounded-full absolute top-1 right-1" />
            )}
          </button>
        </div>

        {/* Map Layers Dropdown Panel */}
        {isLayersDropdownOpen && (
          <div 
            id="map-layers-panel" 
            className="absolute top-[62px] left-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-slate-100 w-[205px] animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
              <span className="text-[9px] font-mono font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Map Layers ({userCity})
              </span>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setEnabledLayers({ activeIssues: false, resolvedIssues: false, underInspection: false, wardBoundaries: false })}
                  className="p-1 hover:bg-rose-50 text-rose-500 rounded transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                  title="Clear (untick) all options"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setIsLayersDropdownOpen(false)}
                  className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded font-bold uppercase transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Live City Sync Indicator */}
            <div className="text-[10px] bg-emerald-50/70 text-emerald-800 px-2.5 py-1.5 rounded-xl font-sans font-extrabold flex items-center gap-1.5 mb-2.5 border border-emerald-100/60 shadow-3xs">
              <MapIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Live: {userCity} (30km range)</span>
            </div>

            <div className="space-y-2.5">
              {/* Active Issues Option */}
              <div className="flex items-center justify-between group">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={enabledLayers.activeIssues}
                    onChange={(e) => setEnabledLayers(prev => ({ ...prev, activeIssues: e.target.checked }))}
                    className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-sans font-bold text-slate-700 leading-tight">Active Issues</span>
                    <span className="text-[8px] text-slate-400 font-mono leading-none">
                      {localIssues.filter(i => i.status === "reported").length} reports
                    </span>
                  </div>
                </label>
                <button
                  onClick={() => handleLocateLayer("activeIssues")}
                  className="p-1 hover:bg-indigo-50 text-indigo-500 rounded transition-all active:scale-90 cursor-pointer flex items-center justify-center"
                  title="Locate Active Issues"
                >
                  <Navigation className="w-3 h-3 rotate-45" />
                </button>
              </div>

              {/* Under Inspection Option */}
              <div className="flex items-center justify-between group">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={enabledLayers.underInspection}
                    onChange={(e) => setEnabledLayers(prev => ({ ...prev, underInspection: e.target.checked }))}
                    className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-sans font-bold text-slate-700 leading-tight">Under Inspection</span>
                    <span className="text-[8px] text-slate-400 font-mono leading-none">
                      {localIssues.filter(i => i.status === "in-progress").length} reports
                    </span>
                  </div>
                </label>
                <button
                  onClick={() => handleLocateLayer("underInspection")}
                  className="p-1 hover:bg-indigo-50 text-indigo-500 rounded transition-all active:scale-90 cursor-pointer flex items-center justify-center"
                  title="Locate Under Inspection"
                >
                  <Navigation className="w-3 h-3 rotate-45" />
                </button>
              </div>

              {/* Resolved Issues Option */}
              <div className="flex items-center justify-between group">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={enabledLayers.resolvedIssues}
                    onChange={(e) => setEnabledLayers(prev => ({ ...prev, resolvedIssues: e.target.checked }))}
                    className="w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-sans font-bold text-slate-700 leading-tight">Resolved Issues</span>
                    <span className="text-[8px] text-slate-400 font-mono leading-none">
                      {localIssues.filter(i => i.status === "resolved").length} completed
                    </span>
                  </div>
                </label>
                <button
                  onClick={() => handleLocateLayer("resolvedIssues")}
                  className="p-1 hover:bg-indigo-50 text-indigo-500 rounded transition-all active:scale-90 cursor-pointer flex items-center justify-center"
                  title="Locate Resolved Issues"
                >
                  <Navigation className="w-3 h-3 rotate-45" />
                </button>
              </div>

              {/* Ward Boundaries Option */}
              <div className="flex items-center justify-between group">
                <label className={`flex items-center gap-2 select-none ${cityHasWards ? "cursor-pointer" : "opacity-60 cursor-not-allowed"}`}>
                  <input 
                    type="checkbox"
                    checked={enabledLayers.wardBoundaries && cityHasWards}
                    disabled={!cityHasWards}
                    onChange={(e) => {
                      if (cityHasWards) {
                        setEnabledLayers(prev => ({ ...prev, wardBoundaries: e.target.checked }));
                      }
                    }}
                    className={`w-3 h-3 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 ${cityHasWards ? "cursor-pointer" : "cursor-not-allowed"}`}
                  />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-sans font-bold text-slate-700 leading-tight flex items-center gap-1">
                      Ward Boundaries
                      {!cityHasWards && (
                        <span className="text-[9px] text-rose-500 font-mono font-black uppercase tracking-tight bg-rose-50 border border-rose-100 px-1 rounded leading-none shrink-0">
                          na
                        </span>
                      )}
                    </span>
                    <span className="text-[8px] text-slate-400 font-mono leading-none">
                      {cityHasWards ? "BHU, Lanka, Assi Wards" : "No wards available"}
                    </span>
                  </div>
                </label>
                {cityHasWards && (
                  <button
                    onClick={() => handleLocateLayer("wardBoundaries")}
                    className="p-1 hover:bg-indigo-50 text-indigo-500 rounded transition-all active:scale-90 cursor-pointer flex items-center justify-center"
                    title="Locate Ward Boundaries"
                  >
                    <Navigation className="w-3 h-3 rotate-45" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Map Legend Key */}
        <div id="map-color-legend" className={`absolute top-[62px] z-[1000] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-slate-100 min-w-[170px] max-w-[200px] transition-all duration-200 ${
          isLayersDropdownOpen ? "left-[218px]" : "left-4"
        }`}>
          <button 
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className="flex items-center justify-between w-full gap-2 text-left cursor-pointer"
          >
            <span className="text-[9px] font-mono font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Map Key
            </span>
            <span className="text-[9px] bg-slate-100 text-slate-500 hover:bg-slate-200 px-1.5 py-0.5 rounded font-black uppercase font-sans">
              {isLegendOpen ? "Hide" : "Show"}
            </span>
          </button>
          
          {isLegendOpen && (
            <div className="grid grid-cols-1 gap-2.5 mt-2 pt-2 border-t border-slate-100 animate-in fade-in duration-100">
              {[
                { category: "water leakage", label: "Water leakage", color: "#06b6d4" },
                { category: "pothholes", label: "Potholes", color: "#8B4513" },
                { category: "street lights", label: "Street lights", color: "#eab308" },
                { category: "waste managemnt", label: "Waste management", color: "#f97316" },
                { category: "roads and infrastructure", label: "Roads & infrastructure", color: "#a855f7" },
              ].map((item) => (
                <div key={item.category} className="flex items-center gap-2.5">
                  <div 
                    className="w-6 h-6 rounded-full border-2 border-white shadow-md flex items-center justify-center text-white shrink-0" 
                    style={{ backgroundColor: item.color }}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="11" 
                      height="11" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      dangerouslySetInnerHTML={{ __html: getSvgIconContent(item.category) }}
                    />
                  </div>
                  <span className="text-[10px] font-sans font-bold text-slate-700">{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Floating HUD controls on top-right */}
        <div id="map-floating-hud" className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
          {/* Geolocation trigger */}
          <button
            onClick={handleLocateMe}
            className="w-10 h-10 bg-white hover:bg-slate-50 rounded-xl shadow-md border border-slate-100 flex items-center justify-center text-slate-700 transition-all hover:scale-105 active:scale-95"
            title="Locate Current Position"
          >
            <Navigation className="w-5 h-5 text-emerald-600" />
          </button>

          {/* Compass Widget */}
          <button
            onClick={handleResetCompass}
            className="w-10 h-10 bg-white hover:bg-slate-50 rounded-xl shadow-md border border-slate-100 flex items-center justify-center text-slate-700 transition-all relative overflow-hidden"
            title="Reset Compass / Center Map"
          >
            <Compass
              className="w-5 h-5 text-emerald-600 transition-transform duration-300"
              style={{ transform: `rotate(${compassAngle}deg)` }}
            />
            {compassAngle !== 0 && (
              <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
            )}
          </button>

          {/* 3D Perspective Control */}
          <button
            onClick={() => setIs3D(!is3D)}
            className={`w-10 h-10 rounded-xl shadow-md border flex items-center justify-center transition-all hover:scale-105 ${
              is3D
                ? "bg-emerald-600 border-emerald-700 text-white"
                : "bg-white hover:bg-slate-50 border-slate-100 text-slate-700"
            }`}
            title="Toggle 3D Perspective Tilt"
          >
            <span className="font-sans font-bold text-xs">3D</span>
          </button>

          {/* Fullscreen Trigger */}
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 bg-white hover:bg-slate-50 rounded-xl shadow-md border border-slate-100 flex items-center justify-center text-slate-700 transition-all"
            title="Toggle Fullscreen Map"
          >
            <Maximize className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Actual Leaflet Map Canvas */}
        <div
          ref={mapContainerRef}
          id="leaflet-canvas-element"
          className="w-full flex-1 transition-transform duration-500 ease-out"
          style={{
            transform: is3D ? "perspective(900px) rotateX(25deg) scale(1.02)" : "none",
            transformOrigin: "center bottom",
          }}
        />

        {/* Custom rounded popup details modal overlay instead of standard popup */}
        {selectedIssue && (() => {
          const urgencyScore = selectedIssue.urgencyScore || 50;
          let meterColor = "bg-emerald-500";
          let meterBg = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
          let meterLabel = "Safe / Low Risk";

          if (urgencyScore >= 85) {
            meterColor = "bg-rose-600";
            meterBg = "bg-rose-50 text-rose-700 border-rose-200/60 animate-pulse";
            meterLabel = "CRITICAL LIMIT";
          } else if (urgencyScore >= 70) {
            meterColor = "bg-orange-500";
            meterBg = "bg-orange-50 text-orange-700 border-orange-200/60";
            meterLabel = "HIGH DANGER";
          } else if (urgencyScore >= 50) {
            meterColor = "bg-yellow-500";
            meterBg = "bg-yellow-550 text-yellow-700 border-yellow-200/60";
            meterLabel = "MODERATE RISK";
          } else {
            meterColor = "bg-sky-500";
            meterBg = "bg-sky-50 text-sky-700 border-sky-200/60";
            meterLabel = "LOW HAZARD";
          }

          const getHighlightedUrgency = (urgency: string) => {
            switch (urgency) {
              case "Critical":
                return "bg-rose-600 text-white font-extrabold shadow-[0_0_12px_rgba(225,29,72,0.6)] px-2.5 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider animate-pulse border border-rose-500";
              case "High":
                return "bg-orange-500 text-white font-extrabold shadow-[0_0_10px_rgba(249,115,22,0.5)] px-2.5 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider border border-orange-400";
              case "Medium":
                return "bg-yellow-400 text-slate-950 font-black shadow-[0_0_8px_rgba(251,191,36,0.5)] px-2.5 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider border border-yellow-300";
              default:
                return "bg-blue-500 text-white font-bold shadow-[0_0_6px_rgba(59,130,246,0.3)] px-2.5 py-0.5 rounded-full text-[9.5px] uppercase tracking-wider border border-blue-400";
            }
          };

          return (
            <div id="map-issue-detail-overlay" className="absolute bottom-4 left-4 right-4 md:left-[360px] md:right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-100 p-4 max-w-lg mx-auto flex flex-col sm:flex-row gap-4 transition-all animate-in fade-in slide-in-from-bottom-4">
              <div
                className="w-full sm:w-28 h-28 sm:h-auto rounded-xl object-cover shrink-0 relative overflow-hidden border border-slate-100"
                style={{ backgroundImage: `url(${selectedIssue.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
              >
                <span className="absolute top-2 left-2 bg-black/50 text-white font-mono text-[9px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                  Before
                </span>
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase text-slate-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getCategoryColor(selectedIssue.category) }} />
                      {selectedIssue.category} • {selectedIssue.locality}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedIssue(null);
                        onSelectIssue(null);
                      }}
                      className="text-slate-400 hover:text-slate-600 text-sm font-bold bg-slate-100 hover:bg-slate-200 px-1.5 py-0.2 rounded-full font-mono"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <h4 className="font-display font-black text-slate-800 text-sm">
                      {selectedIssue.title}
                    </h4>
                    <span className={getHighlightedUrgency(selectedIssue.urgency)}>
                      Urgency: {selectedIssue.urgency}
                    </span>
                    {selectedIssue.verificationCount >= 10 ? (
                      <span className="bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider border border-emerald-200 flex items-center gap-1 shadow-xs animate-in fade-in duration-150">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        Verified
                      </span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 font-bold px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider border border-slate-250">
                        Pending Verification
                      </span>
                    )}
                  </div>

                  {/* Option to view about the issue instead of showing the whole theory directly */}
                  <div className="mt-2.5">
                    <button
                      onClick={() => setShowDescription(!showDescription)}
                      className="text-[10px] font-sans font-black text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100/75 px-2.5 py-1 rounded-lg"
                    >
                      {showDescription ? "📖 Hide description" : "📖 About the issue"}
                    </button>
                    {showDescription && (
                      <div className="mt-1.5 p-2 bg-slate-50 border border-slate-150 rounded-lg text-slate-600 text-[10px] font-sans leading-normal animate-in fade-in duration-100">
                        {selectedIssue.description}
                      </div>
                    )}
                  </div>

                  {/* AI Urgency Meter with proper colour coding */}
                  <div className="mt-3 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl p-2.5 border border-slate-100 shadow-3xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-mono font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                        🤖 AI Urgency Meter
                      </span>
                      <span className={`text-[9.5px] font-sans font-black uppercase tracking-wider px-1.5 py-0.2 rounded-md border ${meterBg}`}>
                        {meterLabel} ({urgencyScore}/100)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden relative shadow-inner">
                      <div 
                        className={`h-full transition-all duration-500 ease-out ${meterColor}`} 
                        style={{ width: `${urgencyScore}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-600 font-sans mt-2.5">
                      <strong className="text-[9px] font-mono font-extrabold uppercase tracking-widest text-slate-400 block mb-1 flex items-center gap-1">🔮 AI Future Risk Prediction</strong>
                      <ul className="space-y-1.5 font-semibold text-slate-700">
                        {getAIPredictions(selectedIssue).map((pt, i) => (
                          <li key={i} className="leading-tight flex items-start gap-1">
                            <span className="text-rose-500 shrink-0">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100 shrink-0">
                  <span className="text-[10px] text-slate-400 font-sans">
                    👍 {selectedIssue.verificationCount} verifications
                  </span>

                  {/* Interactive Verification */}
                  <div className="flex items-center gap-1.5">
                    {selectedIssue.verifications.includes(currentUserEmail || "sunflowerr.flowerr25@gmail.com") ? (
                      <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-3 py-1.5 rounded-xl border border-emerald-100 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified
                      </span>
                    ) : selectedIssue.status === "resolved" ? (
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-3 py-1.5 rounded-xl">
                        Resolved! 🎉
                      </span>
                    ) : (
                      <button
                        onClick={() => handleVerifyIssue(selectedIssue.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 transition-all shadow-sm cursor-pointer"
                      >
                        <Heart className="w-3 h-3 fill-white stroke-white" />
                        Verify Report
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* 🌟 RESOLVED ISSUE DIALOGUE BOX (MODAL) */}
      {resolvedIssueToShow && (
        <div id="resolved-issue-dialog-overlay" className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            id="resolved-issue-dialog-content" 
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col relative max-h-[90vh]"
          >
            {/* Elegant Header banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white relative shrink-0">
              <button 
                onClick={() => setResolvedIssueToShow(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-black/15 hover:bg-black/25 text-white/90 hover:text-white transition-all cursor-pointer"
                title="Close dialogue"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono font-black tracking-widest text-emerald-100">
                    Resolution Accomplished!
                  </span>
                  <h3 className="font-sans font-black text-lg leading-tight mt-0.5">
                    Civic Issue Solved
                  </h3>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-5 md:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Title & Location details */}
              <div>
                <span className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase tracking-wide inline-block">
                  {resolvedIssueToShow.category}
                </span>
                <h4 className="font-sans font-extrabold text-slate-800 text-base mt-1.5 leading-snug">
                  {resolvedIssueToShow.title}
                </h4>
                <p className="text-slate-500 text-xs font-medium mt-1">
                  📍 {resolvedIssueToShow.locality}, Varanasi
                </p>
              </div>

              {/* Before/After Visual Comparer (If images are available) */}
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-400 font-mono font-bold uppercase tracking-wider text-center">BEFORE</span>
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img 
                      src={resolvedIssueToShow.imageUrl} 
                      alt="Before cleanup" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
                
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-emerald-600 font-mono font-bold uppercase tracking-wider text-center">RESOLVED 🎉</span>
                  <div className="aspect-video w-full rounded-xl overflow-hidden bg-emerald-50 border border-emerald-200">
                    <img 
                      src={resolvedIssueToShow.afterImageUrl || resolvedIssueToShow.imageUrl} 
                      alt="After cleanup" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>

              {/* Description & AI summary of resolution */}
              <div className="space-y-2.5">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">ISSUE DESCRIPTION:</span>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    {resolvedIssueToShow.description}
                  </p>
                </div>

                <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase tracking-wider block mb-1">MUNICIPAL RESOLUTION LOG:</span>
                  <p className="text-[11px] text-slate-700 font-semibold leading-relaxed">
                    {resolvedIssueToShow.timeline.find(t => t.status === "resolved")?.description || 
                     `The municipal board has successfully corrected the issue and placed precautions.`}
                  </p>
                  {resolvedIssueToShow.resolvedIn && (
                    <span className="text-[9.5px] font-mono text-emerald-600 font-extrabold block mt-2">
                      ⏱️ Resolved in {resolvedIssueToShow.resolvedIn}
                    </span>
                  )}
                </div>
              </div>

              {/* Citizen upvotes and contributions */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100 shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">COMMUNITY HELP</span>
                  <span className="text-xs font-bold text-slate-700 mt-0.5">
                    👍 {resolvedIssueToShow.verificationCount} neighbor validations
                  </span>
                </div>
                <span className="bg-emerald-500 text-white font-mono text-[9px] px-2.5 py-1 rounded-full font-bold uppercase">
                  Verified Active
                </span>
              </div>
            </div>

            {/* Bottom Button Panel */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end">
              <button 
                onClick={() => setResolvedIssueToShow(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white shadow-md transition-all cursor-pointer"
              >
                Close Dialogue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
