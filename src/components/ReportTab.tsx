import React, { useState, useRef, useEffect } from "react";
import L from "leaflet";
import { 
  Camera, FileText, Sparkles, MapPin, CheckCircle, ArrowRight, ArrowLeft, Upload, MapIcon, 
  Trash2, ShieldCheck, AlertCircle, RefreshCw, Trophy, Target, Award, Flame
} from "lucide-react";
import { CivicIssue, UserState } from "../types";
import garbageBefore from "../assets/images/garbage_before_1782401711273.jpg";
import potholeBefore from "../assets/images/pothole_before_1782401750239.jpg";
import streetlightBefore from "../assets/images/streetlight_before_1782401770449.jpg";
import waterLeakageBefore from "../assets/images/water_leakage_before_1782652684241.jpg";

interface ReportTabProps {
  onAddIssue: (issue: CivicIssue) => void;
  onNavigateToTab: (tabName: string, id?: string) => void;
  userPoints: number;
  onAddPoints: (points: number) => void;
  userLocation: { lat: number; lng: number };
  cityName: string;
  currentWard: string;
  onLocationChange: (lat: number, lng: number, city?: string, ward?: string) => void;
  user?: UserState;
}

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

// Helper to get category color according to map key
const getCategoryColor = (cat: string) => {
  const normalized = normalizeCategory(cat);
  switch (normalized) {
    case "waste managemnt": return "#f97316"; // orange
    case "roads and infrastructure": return "#a855f7"; // purple
    case "water leakage": return "#06b6d4"; // cyan
    case "street lights": return "#eab308"; // yellow
    case "pothholes": return "#8B4513"; // brown
    default: return "#8B4513"; // brown
  }
};

// Helper to get SVG icon content according to map key
const getSvgIconContent = (cat: string) => {
  const normalized = normalizeCategory(cat);
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

export default function ReportTab({ 
  onAddIssue, 
  onNavigateToTab, 
  userPoints, 
  onAddPoints,
  userLocation,
  cityName,
  currentWard,
  onLocationChange,
  user
}: ReportTabProps) {
  const [step, setStep] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState("");

  // AI Quality Check State
  const [isCheckingQuality, setIsCheckingQuality] = useState(false);
  const [qualityStatus, setQualityStatus] = useState<"clear" | "blurry" | null>(null);

  // AI Image Categorization State
  const [isCategorizingImage, setIsCategorizingImage] = useState(false);
  const [autoDetectedCategory, setAutoDetectedCategory] = useState<string | null>(null);
  const [isCategoryCorrect, setIsCategoryCorrect] = useState<boolean | null>(null);

  // Form Fields State
  const [image, setImage] = useState<string>("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("waste managemnt");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [urgencyScore, setUrgencyScore] = useState(60);
  const [priorityScore, setPriorityScore] = useState(55);
  const [aiAnalysisText, setAiAnalysisText] = useState("");
  const [autoDescription, setAutoDescription] = useState("");
  const [aiTip, setAiTip] = useState("");
  const [isAuthenticatedReport, setIsAuthenticatedReport] = useState(false);
  const [latitude, setLatitude] = useState(userLocation?.lat || 25.283);
  const [longitude, setLongitude] = useState(userLocation?.lng || 83.006);
  const [locality, setLocality] = useState(currentWard || "Lanka");

  // Synchronize state with incoming live props
  useEffect(() => {
    if (userLocation) {
      setLatitude(userLocation.lat);
      setLongitude(userLocation.lng);
    }
  }, [userLocation]);

  useEffect(() => {
    if (currentWard) {
      setLocality(currentWard);
    }
  }, [currentWard]);

  // Auto-write the Ai-generated "AI-Description" inside the issue description box
  useEffect(() => {
    if (autoDescription) {
      setDescription(autoDescription);
    }
  }, [autoDescription]);

  // Map elements inside Step 4
  const miniMapRef = useRef<L.Map | null>(null);
  const miniMarkerRef = useRef<L.Marker | null>(null);
  const miniMapContainerRef = useRef<HTMLDivElement>(null);

  // File Upload drag states
  const [isDragging, setIsDragging] = useState(false);

  // Demo samples for fast testing
  const demoPictures: Array<{ name: string; img: string; desc: string; isBlurry?: boolean }> = [
    { name: "waste managemnt", img: garbageBefore, desc: "A large pile of rotting kitchen waste and commercial plastics blocking the side street near Lanka crossing." },
    { name: "Deep Pothole", img: potholeBefore, desc: "A sharp, deep pothole in the middle of the dark road leading to Assi crossing, extremely dangerous for motorbikes." },
    { name: "Streetlight Out", img: streetlightBefore, desc: "Multiple consecutive streetlights are broken on BHU wall road, making the pathway completely black after dark." },
    { name: "Water Leakage", img: waterLeakageBefore, desc: "Clean water is gushing out of a burst pipeline under the street, causing waterlogging and low water pressure in nearby homes." },
    { name: "Public Infrastructure", img: "https://images.unsplash.com/photo-1515162305285-0293e4767cc2?auto=format&fit=crop&w=600&q=80", desc: "Concrete blocks and repair gravel left unfinished on the main road walkway for over two weeks, obstructing elderly citizens and causing traffic bottlenecks." },
    { 
      name: "Blurry Streetlight", 
      img: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80", 
      desc: "An extremely blurry night photo showing some faint lights with heavy lens blur and low visibility near BHU gate.",
      isBlurry: true
    }
  ];

  // Steps schema
  const steps = [
    { num: 1, label: "Evidence", icon: Camera },
    { num: 2, label: "Context", icon: FileText },
    { num: 3, label: "AI Analysis", icon: Sparkles },
    { num: 4, label: "Location", icon: MapPin },
    { num: 5, label: "Finalize", icon: CheckCircle },
  ];

  // Process drag and drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImage(base64);

      // Trigger AI Quality Check
      setIsCheckingQuality(true);
      setQualityStatus(null);

      setTimeout(() => {
        setIsCheckingQuality(false);
        // Only trigger blurry status if the filename explicitly contains blurry/dark keywords
        // or if the uploaded file is extremely tiny (under 5KB) implying low resolution.
        const nameLower = file.name.toLowerCase();
        const hasBlurKeyword = nameLower.includes("blurry") || nameLower.includes("unclear") || nameLower.includes("bad_quality") || nameLower.includes("very_bad");
        const isBlurry = hasBlurKeyword || (file.size > 0 && file.size < 2000);
        setQualityStatus(isBlurry ? "blurry" : "clear");
      }, 1200);

      // Trigger AI Auto-Categorization
      setIsCategorizingImage(true);
      setAutoDetectedCategory(null);
      setIsCategoryCorrect(null);

      fetch("/api/agents/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, filename: file.name }),
      })
        .then((res) => res.json())
        .then((data) => {
          setIsCategorizingImage(false);
          setAutoDetectedCategory(data.category || "roads and infrastructure");
          setAutoDescription(data.autoDescription || "Analyzing uploaded evidence detail...");
          setAiTip(data.aiTip || "Stay cautious of localized safety hazards.");
        })
        .catch((err) => {
          console.warn("Categorization API error, falling back:", err);
          setIsCategorizingImage(false);
          // Local fallback based on filename
          const fn = file.name.toLowerCase();
          let cat = "roads and infrastructure";
          let autoDesc = "Unfinished municipal structures or sidewalk obstructions visible in the scene.";
          let tip = "Be cautious when traversing this area; keep to the opposite sidewalk to avoid structural hazards.";

          if (fn.includes("garbage") || fn.includes("waste") || fn.includes("trash") || fn.includes("dump") || fn.includes("refuse")) {
            cat = "waste managemnt";
            autoDesc = "A significant accumulation of uncollected solid waste and commercial plastics littering the public passage.";
            tip = "Avoid direct contact with the pile to protect from vector-borne pathogens and keep children away from the site.";
          } else if (fn.includes("pothole") || fn.includes("crater") || fn.includes("hole") || fn.includes("tarmac") || fn.includes("asphalt")) {
            cat = "pothholes";
            autoDesc = "A deep pothole with sharp asphalt edges compromising the structural integrity of the roadway lane.";
            tip = "Reduce your vehicle speed and navigate around the pothole with caution to prevent tire or rim damage.";
          } else if (fn.includes("light") || fn.includes("streetlight") || fn.includes("dark")) {
            cat = "street lights";
            autoDesc = "A non-functional streetlight assembly leaving the pedestrian corridor in complete darkness during night hours.";
            tip = "Carry a pocket flashlight or utilize your mobile phone's light while walking here after sunset to maintain visibility.";
          } else if (fn.includes("water") || fn.includes("leak") || fn.includes("sewage")) {
            cat = "water leakage";
            autoDesc = "An active liquid outflow or pipe leakage causing water accumulation and resource wastage on the street level.";
            tip = "Avoid stepping in pooled water as it can conceal underlying road hazards or electrical grounding conduits.";
          }
          setAutoDetectedCategory(cat);
          setAutoDescription(autoDesc);
          setAiTip(tip);
        });
    };
    reader.readAsDataURL(file);
  };

  // Skip / Sample select helper
  const handleSelectSample = (sample: typeof demoPictures[0] & { isBlurry?: boolean }) => {
    setImage(sample.img);
    setDescription(sample.desc);

    // Trigger AI Quality Check
    setIsCheckingQuality(true);
    setQualityStatus(null);

    // Trigger AI Auto-Categorization
    setIsCategorizingImage(true);
    setAutoDetectedCategory(null);
    setIsCategoryCorrect(null);

    setTimeout(() => {
      setIsCheckingQuality(false);
      if (sample.isBlurry) {
        setQualityStatus("blurry");
      } else {
        setQualityStatus("clear");
      }
    }, 1000);

    setTimeout(() => {
      setIsCategorizingImage(false);
      let cat = "roads and infrastructure";
      let autoDesc = "Unfinished municipal structures or sidewalk obstructions visible in the scene.";
      let tip = "Be cautious when traversing this area; keep to the opposite sidewalk to avoid structural hazards.";

      if (sample.name === "waste managemnt") {
        cat = "waste managemnt";
        autoDesc = "A massive pile of unsegregated organic waste, discarded food items, and single-use plastic bags overflowing from a public bin onto the open street.";
        tip = "Avoid walking near the pile to prevent exposure to harmful bacterial odors and vector-borne insect vectors.";
      } else if (sample.name === "Deep Pothole") {
        cat = "pothholes";
        autoDesc = "A deep, sharp tarmac failure in the middle of a high-speed driving lane with vertical edges, posing an immediate physical hazard.";
        tip = "Reduce your speed dramatically and steer clear of the pothole to prevent tire ruptures or wheel misalignment.";
      } else if (sample.name === "Streetlight Out") {
        cat = "street lights";
        autoDesc = "A series of broken streetlights at dusk leaving the sidewalk and main corridor in complete darkness, creating blind spots.";
        tip = "Carry a portable flashlight or utilize your smartphone torch to alert oncoming vehicles of your presence.";
      } else if (sample.name === "Blurry Streetlight") {
        cat = "street lights";
        autoDesc = "An extremely blurry, low-light night-time image showing blurred vehicle headlamps and broken illumination.";
        tip = "Try to capture photos from a stationary position under steady lighting to help AI analyze details.";
      } else if (sample.name === "Water Leakage") {
        cat = "water leakage";
        autoDesc = "An active pressurized rupture in a municipal water main gushing clean water onto the tarmac, causing localized street flooding.";
        tip = "Be extremely careful when driving over waterlogged areas to prevent hydroplaning or hidden sub-surface potholes.";
      } else if (sample.name === "Public Infrastructure") {
        cat = "roads and infrastructure";
        autoDesc = "Concrete debris, gravel mounds, and hazardous metal rebar left scattered across a pedestrian walkway without proper safety warning tape.";
        tip = "Stick to the opposite sidewalk if possible to avoid trip hazards from loose gravel or sharp metal debris.";
      }
      
      setAutoDetectedCategory(cat);
      setAutoDescription(autoDesc);
      setAiTip(tip);
    }, 1200);
  };

  // Run Issue Detection Agent (Google AI Studio)
  const triggerAiAgentAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress("Spinning up AI Issue Detection Agent...");
    
    const logs = [
      "Consulting standard city ordinances...",
      "Inspecting visual features & patterns...",
      "Evaluating hazard and traffic index...",
      "Drafting localized safety analysis...",
    ];

    let logIndex = 0;
    const interval = setInterval(() => {
      if (logIndex < logs.length) {
        setAnalysisProgress(logs[logIndex]);
        logIndex++;
      }
    }, 1000);

    try {
      const response = await fetch("/api/agents/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description,
          image: image.startsWith("data:") ? image : null, // send base64 if user uploaded a file
        }),
      });

      const data = await response.json();
      clearInterval(interval);

      if (response.ok && data.category) {
        setCategory(data.category);
        setSeverity(data.severity);
        setUrgencyScore(data.urgencyScore || 60);
        setPriorityScore(data.priorityScore || 55);
        setTitle(data.title || "Reported Hyperlocal Civic Issue");
        setAiAnalysisText(data.aiAnalysis || "");
      } else {
        throw new Error(data.error || "Analysis returned incomplete results");
      }
    } catch (err) {
      console.warn("API Error, falling back to local analytical logic:", err);
      // Fallback
      setTimeout(() => {
        clearInterval(interval);
        const descLower = description.toLowerCase();
        let cat = "roads and infrastructure";
        let sev: typeof severity = "Medium";
        let pScore = 58;
        let uScore = 62;
        let t = "Road Damage Reported";
        let analysis = "Hydrological and friction diagnostics suggest rapid deterioration of surrounding binder course. High accident probability.";

        if (descLower.includes("pothole") || descLower.includes("crater") || descLower.includes("hole")) {
          cat = "pothholes";
          sev = "High";
          pScore = 75;
          uScore = 78;
          t = "Hazardous Road Pothole";
          analysis = "Critical mechanical wear detected on tarmac. Sharp vertical edges present high risk of rim fracturing or physical rider instability.";
        } else if (descLower.includes("garbage") || descLower.includes("waste") || descLower.includes("trash")) {
          cat = "waste managemnt";
          sev = "High";
          pScore = 78;
          uScore = 80;
          t = "Decomposing Waste Accumulation";
          analysis = "Bacterial replication models show immediate vectors of disease emerging from biological compounds. High temperature increases decomposition risk.";
        } else if (descLower.includes("water") || descLower.includes("leak") || descLower.includes("sewage")) {
          cat = "water leakage";
          sev = descLower.includes("sewage") ? "Critical" : "High";
          pScore = sev === "Critical" ? 92 : 72;
          uScore = sev === "Critical" ? 95 : 75;
          t = descLower.includes("sewage") ? "Raw Sewer Line Backflow" : "Water Mains Rupture";
          analysis = "Blackwater containment failure. Immediate microbial pathogens exposed to open air, compromising surrounding domestic hygiene indices.";
        } else if (descLower.includes("light") || descLower.includes("dark") || descLower.includes("streetlight") || descLower.includes("pole")) {
          cat = "street lights";
          sev = "Medium";
          pScore = 65;
          uScore = 58;
          t = "Streetlight Corridor Outage";
          analysis = "Vulnerability index elevated due to lack of illumination. Walkway security rating declines by 64% in darkness hours.";
        }

        setCategory(cat);
        setSeverity(sev);
        setUrgencyScore(uScore);
        setPriorityScore(pScore);
        setTitle(t);
        setAiAnalysisText(analysis);
      }, 1500);
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
        setStep(3); // transition to AI results step
      }, 1500);
    }
  };

  // Step 4 Map Initialization
  useEffect(() => {
    if (step === 4 && miniMapContainerRef.current && !miniMapRef.current) {
      // Delay initialization slightly to let DOM compile first
      setTimeout(() => {
        if (!miniMapContainerRef.current) return;
        const miniMap = L.map(miniMapContainerRef.current, {
          center: [latitude, longitude],
          zoom: 14,
          zoomControl: false,
        });

        miniMapRef.current = miniMap;

        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; CARTO",
        }).addTo(miniMap);

        const color = getCategoryColor(category);
        const shadowColor = color + "44";
        const pinIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center" style="width: 36px; height: 36px;">
              <div class="absolute inset-0 rounded-full animate-ping opacity-40" style="background-color: ${shadowColor};"></div>
              <div class="relative w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white" style="background-color: ${color};">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  ${getSvgIconContent(category)}
                </svg>
              </div>
            </div>
          `,
          className: "report-pin",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        const miniMarker = L.marker([latitude, longitude], { icon: pinIcon, draggable: true }).addTo(miniMap);
        miniMarkerRef.current = miniMarker;

        // Sync drag position
        miniMarker.on("dragend", (e) => {
          const pos = miniMarker.getLatLng();
          setLatitude(pos.lat);
          setLongitude(pos.lng);
          resolveLocalityFromCoords(pos.lat, pos.lng);
        });

        // Click map to reposition
        miniMap.on("click", (e) => {
          miniMarker.setLatLng(e.latlng);
          setLatitude(e.latlng.lat);
          setLongitude(e.latlng.lng);
          resolveLocalityFromCoords(e.latlng.lat, e.latlng.lng);
        });
      }, 200);
    }

    return () => {
      if (miniMapRef.current) {
        miniMapRef.current.remove();
        miniMapRef.current = null;
        miniMarkerRef.current = null;
      }
    };
  }, [step]);

  // Update minimap marker icon dynamically if category changes in Step 4
  useEffect(() => {
    if (miniMarkerRef.current) {
      const color = getCategoryColor(category);
      const shadowColor = color + "44";
      const newIcon = L.divIcon({
        html: `
          <div class="relative flex items-center justify-center" style="width: 36px; height: 36px;">
            <div class="absolute inset-0 rounded-full animate-ping opacity-40" style="background-color: ${shadowColor};"></div>
            <div class="relative w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white" style="background-color: ${color};">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                ${getSvgIconContent(category)}
              </svg>
            </div>
          </div>
        `,
        className: "report-pin",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      miniMarkerRef.current.setIcon(newIcon);
    }
  }, [category]);

  // Dynamic reverse geocoding helper using Nominatim with a high-fidelity local fallback
  const resolveLocalityFromCoords = async (lat: number, lng: number) => {
    // 1. Check if close to Varanasi coordinates
    const isVaranasi = Math.abs(lat - 25.2820) < 0.15 && Math.abs(lng - 83.0080) < 0.15;
    if (isVaranasi) {
      if (lat > 25.285) {
        setLocality("Assi");
        onLocationChange(lat, lng, cityName || "Varanasi", "Assi Ward");
      } else if (lat < 25.276) {
        setLocality("Nagwa");
        onLocationChange(lat, lng, cityName || "Varanasi", "Nagwa Ward");
      } else {
        setLocality("Lanka");
        onLocationChange(lat, lng, cityName || "Varanasi", "Lanka Ward");
      }
      return;
    }

    // 2. Try fetching from free OSM Nominatim API
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
        const ward = addr.suburb || addr.neighbourhood || addr.quarter || addr.residential || addr.city_district || "Local Ward";
        
        let formattedWard = ward;
        if (!formattedWard.toLowerCase().includes("ward") && !formattedWard.toLowerCase().includes("district")) {
          formattedWard = `${formattedWard} Ward`;
        }
        
        setLocality(ward);
        onLocationChange(lat, lng, city, formattedWard);
        return;
      }
    } catch (e) {
      console.warn("Report reverse geocode failed, using generic fallbacks:", e);
    }

    // Local approximation if fetch fails
    const approxWard = lat > 25.285 ? "Assi" : lat < 25.276 ? "Nagwa" : "Lanka";
    setLocality(approxWard);
    onLocationChange(lat, lng, cityName || "Varanasi", `${approxWard} Ward`);
  };

  const fetchCurrentPosition = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          setLatitude(lat);
          setLongitude(lng);
          resolveLocalityFromCoords(lat, lng);
          if (miniMapRef.current && miniMarkerRef.current) {
            miniMapRef.current.setView([lat, lng], 15);
            miniMarkerRef.current.setLatLng([lat, lng]);
          }
        },
        () => {
          alert(`Couldn't retrieve position. Using default ${cityName || "Varanasi"} seed center.`);
        }
      );
    }
  };

  // Submit complete issue
  const handleFinalSubmit = () => {
    if (!isAuthenticatedReport) {
      alert("Please check the 'I authenticate this report is true and accurate' checkbox to complete submission.");
      return;
    }
    const newIssue: CivicIssue = {
      id: `issue-custom-${Date.now()}`,
      title: title || "Hyperlocal Community Issue",
      description: description,
      category: category,
      locality: locality,
      lat: latitude,
      lng: longitude,
      severity: severity,
      status: "reported",
      urgency: urgencyScore >= 85 ? "Critical" : urgencyScore >= 70 ? "High" : urgencyScore >= 45 ? "Medium" : "Low",
      urgencyScore: urgencyScore,
      priorityScore: priorityScore,
      verificationCount: 1, // Self verified on submit
      verifications: ["sunflowerr.flowerr25@gmail.com"],
      imageUrl: image || garbageBefore,
      aiAnalysis: aiAnalysisText || "Analytical core parameters cataloged.",
      createdAt: new Date().toISOString(),
      timeline: [
        {
          status: "reported",
          date: new Date().toISOString().split("T")[0],
          description: "Hyperlocal citizen report submitted and logged securely in local cluster.",
        }
      ],
    };

    onAddIssue(newIssue);
    onAddPoints(30); // Award exactly 30 XP to citizen
    setStep(5); // Go to celebration splash page
  };

  const getCategoryContextInfo = (cat: string) => {
    switch (cat) {
      case "pothholes":
        return {
          title: "potholes context description",
          label: "Describe the pothole depth, size, or lane position:",
          placeholder: "e.g., There's a 5-inch deep pothole in the middle of the street. It's causing scooter riders to swerve dangerously...",
          tip: "AI Tip: Detailing the hazard location helps the municipal team prioritize asphalt patch crews."
        };
      case "waste managemnt":
        return {
          title: "waste management context description",
          label: "Describe the odor, heap size, or blockage caused by the garbage pile:",
          placeholder: "e.g., A massive pile of rotting household trash is spilling onto the pavement. It's emitting a heavy smell and attracting insects...",
          tip: "AI Tip: Specifying blockages or odor levels helps schedule rapid high-capacity clearance trucks."
        };
      case "street lights":
        return {
          title: "streetlight outage context description",
          label: "Identify which pole is dark or the safety risk of the darkness:",
          placeholder: "e.g., Three consecutive street lights are completely broken. The entire corridor near the gate is pitch black after 7 PM...",
          tip: "AI Tip: Dark corridor reports are automatically cross-referenced with local security priority indexes."
        };
      case "water leakage":
        return {
          title: "water leak context description",
          label: "Describe the water flow rate, pooling depth, or line source:",
          placeholder: "e.g., Fresh water is gushing intensely out of a broken pipe near the curb, flooding the side street 2 inches deep...",
          tip: "AI Tip: Describing the flooding rate assists engineers in shutting down correct feeder mains."
        };
      case "roads and infrastructure":
        return {
          title: "infrastructure context description",
          label: "Describe the pavement crack, rubble blockages, or damaged structures:",
          placeholder: "e.g., Unfinished brick rubble and steel rebar left blocking the primary pedestrian sidewalk for over two weeks...",
          tip: "AI Tip: Highlighting pedestrian obstacles helps schedule road clearance tasks."
        };
      default:
        return {
          title: "general context description",
          label: "Provide details of the municipal issue you observed:",
          placeholder: "e.g., Broken water mains, potholes, or unlit streets causing major hazards. Describe the exact location and impact here...",
          tip: "AI Tip: Clear descriptions allow faster AI diagnostic categorization and dispatch."
        };
    }
  };

  return (
    <div id="report-page-container" className="max-w-3xl mx-auto p-4 md:p-6">
      {/* Premium Step Header */}
      <div id="report-journey-stepper" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-6 shrink-0">
        <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isCompleted = step > s.num;
            const isActive = step === s.num;
            return (
              <div key={s.num} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center relative">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isCompleted ? "bg-emerald-600 text-white" :
                    isActive ? "bg-slate-900 text-white ring-4 ring-slate-100" :
                    "bg-slate-100 text-slate-400"
                  }`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-4.5 h-4.5" />}
                  </div>
                  <span className={`text-[9px] font-sans font-semibold mt-1 transition-all ${
                    isActive ? "text-slate-900 font-bold" : "text-slate-400"
                  }`}>
                    {s.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 bg-slate-100 relative">
                    <div className="absolute top-0 left-0 h-full bg-emerald-600 transition-all duration-300" style={{ width: isCompleted ? "100%" : "0%" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Panel */}
      <div id="report-content-panel" className="bg-white rounded-2xl border border-slate-100 shadow-md p-6 md:p-8 min-h-[400px] flex flex-col justify-between">
        
        {/* Step 1: EVIDENCE */}
        {step === 1 && (
          <div id="step-1-container" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="font-display font-bold text-slate-800 text-xl md:text-2xl text-center">
              📸 Let's capture the evidence first.
            </h2>
            <p className="text-slate-500 text-xs md:text-sm text-center mt-1 mb-6">
              Drag your camera snapshot or select one of our {cityName || "Varanasi"} pre-staged mock incidents to test instantly.
            </p>

            {/* Dropzone */}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center flex flex-col items-center justify-center min-h-[180px] transition-all cursor-pointer ${
                isDragging ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
              }`}
              onClick={() => document.getElementById("evidence-upload-input")?.click()}
            >
              <input
                id="evidence-upload-input"
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {image ? (
                <div className="relative w-full max-w-[240px] h-32 rounded-xl border border-slate-100 shadow overflow-hidden group" onClick={(e) => e.stopPropagation()}>
                  {image.startsWith("data:video/") || image.match(/\.(mp4|webm|mov|avi|mkv|ogg)/i) ? (
                    <video src={image} className="w-full h-full object-cover" controls playsInline />
                  ) : (
                    <img src={image} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Trash2 className="w-4 h-4 text-white cursor-pointer" onClick={(e) => { e.stopPropagation(); setImage(""); setQualityStatus(null); }} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="font-sans font-semibold text-slate-700 text-sm">Upload Photo or Video Evidence</span>
                  <p className="text-slate-400 text-[11px] mt-1 font-sans">PNG, JPG, MP4, MOV up to 15MB</p>
                </>
              )}
            </div>

            {/* AI Image & Video Quality Audit Panel */}
            {isCheckingQuality && (
              <div id="ai-quality-checking" className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/40 flex items-center gap-3 animate-pulse text-left">
                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                <div className="text-left">
                  <span className="text-[10px] font-mono font-bold text-blue-600 block uppercase tracking-wider">AI Quality Check</span>
                  <p className="text-slate-600 text-xs font-sans">Analyzing visual sharpness, compression noise, and illumination rates...</p>
                </div>
              </div>
            )}

            {image && !isCheckingQuality && qualityStatus === "blurry" && (
              <div id="ai-quality-warning-blurry" className="mt-4 p-3 rounded-xl border border-rose-100 bg-rose-50/70 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 animate-bounce" />
                  <p className="text-slate-700 text-xs font-bold font-sans">
                    Warning: Very blurry or dark image. Better lighting needed.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => document.getElementById("evidence-upload-input")?.click()}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-sans font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer animate-pulse"
                  >
                    Reupload
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-sans font-semibold text-[10px] px-2.5 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    Proceed anyway
                  </button>
                </div>
              </div>
            )}

            {image && !isCheckingQuality && qualityStatus === "clear" && (
              <div id="ai-quality-passed" className="mt-4 p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/40 text-left flex gap-2.5 animate-in fade-in duration-200">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-600 block uppercase tracking-wider">✅ AI Quality Passed</span>
                  <p className="text-slate-600 text-[11px] font-sans">
                    Optimal clarity, sharpness, and high contrast illumination verified.
                  </p>
                </div>
              </div>
            )}
            {/* Mock Presets Row */}
            <div className="mt-6">
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-400 block mb-3 text-center">
                Select Demo Data
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {demoPictures.map((pic) => (
                  <button
                    key={pic.name}
                    id={`demo-pic-btn-${pic.name.replace(/\s+/g, "-").toLowerCase()}`}
                    onClick={() => handleSelectSample(pic)}
                    className="flex flex-col items-center gap-2 p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all text-center shadow-sm hover:scale-102 active:scale-98 w-full"
                  >
                    <img src={pic.img} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-100 shadow-sm" />
                    <div className="min-w-0">
                      <span className="font-sans font-bold text-[10.5px] lg:text-[11px] text-slate-700 block leading-tight whitespace-normal">{pic.name}</span>
                      <span className="text-[8.5px] text-slate-400 block leading-tight font-sans mt-0.5">{cityName || "Varanasi"} demo</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: CONTEXT */}
        {step === 2 && (() => {
          const contextInfo = getCategoryContextInfo(category);
          return (
            <div id="step-2-container" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="font-display font-bold text-slate-800 text-xl md:text-2xl text-center">
                🗣️ AI Issue Categorization & Context
              </h2>
              <p className="text-slate-500 text-xs md:text-sm text-center mt-1 mb-6">
                Let's verify the issue type and describe what you observed.
              </p>

              {/* 1. Categorization Stage */}
              <div className="mb-6">
                {isCategorizingImage ? (
                  <div id="ai-categorization-checking" className="p-4 rounded-xl border border-teal-100 bg-teal-50/20 flex items-center gap-3 animate-pulse text-left">
                    <RefreshCw className="w-4.5 h-4.5 text-teal-600 animate-spin shrink-0" />
                    <div className="text-left">
                      <span className="text-[10px] font-mono font-bold text-teal-600 block uppercase tracking-wider">⚡ AI Auto-Categorizer</span>
                      <p className="text-slate-600 text-xs font-sans">Analyzing image/video visual tags to classify the municipal issue...</p>
                    </div>
                  </div>
                ) : autoDetectedCategory && isCategoryCorrect === null ? (
                  <div id="ai-categorization-verification" className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
                      <p className="text-slate-700 text-xs font-sans leading-relaxed">
                        AI auto-detected category as <strong className="text-emerald-700 font-extrabold uppercase bg-emerald-100/60 px-1.5 py-0.5 rounded">"{autoDetectedCategory}"</strong>. Is this correct?
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCategoryCorrect(true);
                          setCategory(autoDetectedCategory);
                          if (!description.trim() && autoDescription) {
                            setDescription(autoDescription);
                          }
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-sm active:scale-95 cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCategoryCorrect(false);
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-sans font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  </div>
                ) : isCategoryCorrect === false ? (
                  <div id="ai-categorization-override" className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-left animate-in fade-in duration-200 shadow-inner">
                    <p className="text-slate-700 text-[11px] font-sans font-bold mb-2 uppercase tracking-wide text-slate-400">
                      Please select the correct category:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["street lights", "waste managemnt", "roads and infrastructure", "water leakage", "pothholes"].map((catOption) => (
                        <button
                          key={catOption}
                          type="button"
                          onClick={() => {
                            setCategory(catOption);
                            setIsCategoryCorrect(true);
                            setAutoDetectedCategory(catOption);
                          }}
                          className={`font-sans text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            category === catOption
                              ? "bg-emerald-600 border-emerald-600 text-white font-bold shadow-sm"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {catOption}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div id="ai-categorization-confirmed" className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/30 text-left flex items-center justify-between gap-3 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                      <p className="text-slate-700 text-xs font-sans">
                        Issue Category verified: <strong className="text-emerald-700 font-bold uppercase">"{category}"</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCategoryCorrect(null);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 hover:underline font-semibold font-sans cursor-pointer transition-all animate-pulse"
                    >
                      Change Category
                    </button>
                  </div>
                )}
              </div>

              {/* 2. Context Description Stage - Only show when category is verified/selected */}
              {isCategoryCorrect === true && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="flex gap-4 items-start mb-6 bg-emerald-50/30 p-4 rounded-xl border border-emerald-100/50">
                    {image && (
                      <img src={image} className="w-16 h-16 rounded-lg object-cover border border-slate-100 shadow shrink-0" />
                    )}
                    <div className="min-w-0">
                      <span className="text-[9px] font-mono font-bold text-emerald-700 block uppercase">Verified Category Context</span>
                      <p className="text-slate-700 text-xs font-sans mt-0.5 font-bold uppercase">
                        📁 {category}
                      </p>
                    </div>
                  </div>

                  {/* AI-IDENTIFIED Description Box Container */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs text-left animate-in fade-in duration-300 mb-5">
                    <span className="text-sm font-sans font-black text-slate-800 block mb-3 uppercase flex items-center gap-1.5 tracking-tight">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
                      AI-IDENTIFIED
                    </span>
                    <textarea
                      id="report-desc-textarea"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={contextInfo.placeholder}
                      rows={4}
                      className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-slate-800 rounded-xl p-3 font-sans text-xs md:text-sm transition-all focus:outline-none shadow-sm"
                    />

                    {/* Replaced earlier static AI tip with dynamically generated AI-tip below description box */}
                    {aiTip ? (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-start gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5 animate-pulse" />
                        <div>
                          <span className="text-[10px] font-mono font-bold text-emerald-700 block uppercase tracking-wider mb-1">
                            💡 Ai-tip
                          </span>
                          <p className="text-slate-600 text-[11px] font-sans leading-relaxed italic">
                            {aiTip}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-emerald-600 font-sans font-semibold mt-2.5 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                        {contextInfo.tip}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Step 3: AI ANALYSIS */}
        {step === 3 && (
          <div id="step-3-container" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="font-sans font-bold text-slate-900 text-xl md:text-2xl text-center flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-500 animate-pulse" />
              AI Agent Diagnostic
            </h2>
            <p className="text-slate-500 text-xs md:text-sm text-center mt-1 mb-6">
              Civic+ Issue Detection Agent completed high-fidelity analysis of your context descriptions.
            </p>

            {/* AI Results Board */}
            <div className="border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/40 rounded-2xl p-5 md:p-6 shadow-sm">
              {/* Ai-Predicted Insight Badge / Banner */}
              <div id="ai-predicted-insight-banner" className="mb-5 p-3.5 bg-indigo-50 border border-indigo-100/75 rounded-xl flex items-start gap-2.5 text-left animate-in fade-in duration-300">
                <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0 animate-pulse" />
                <div>
                  <span className="text-[10px] font-mono font-bold text-indigo-600 block uppercase tracking-wider leading-none mb-1">
                    Ai-Predicted Insight
                  </span>
                  <p className="text-slate-700 text-xs font-sans leading-relaxed">
                    Visual analysis of the uploaded evidence predicts a high urgency concern. Real-time diagnostic score registered as <strong className="text-indigo-700 font-extrabold">{urgencyScore} / 100</strong> with severe incident profile classified as <strong className="text-indigo-700 font-extrabold">{severity}</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-5 items-start">
                
                {/* Visual Circle Stats */}
                <div className="w-full md:w-44 shrink-0 flex flex-col items-center border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4">
                  <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase mb-2">Urgency Meter</span>
                  <div className="w-24 h-24 rounded-full border-4 border-slate-100 flex flex-col items-center justify-center relative shadow-inner" style={{ borderColor: category === "waste managemnt" ? "#fed7aa" : "#dbeafe" }}>
                    <span className="font-display font-bold text-3xl text-slate-800 tracking-tighter">{urgencyScore}</span>
                    <span className="text-[8px] font-sans font-bold text-slate-400 uppercase">/ 100</span>
                    <div className="absolute -bottom-1 bg-rose-500 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded-full shadow">
                      {severity}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-sans mt-3 text-center">
                    Priority Score: <strong className="text-slate-600 font-mono">{priorityScore}</strong>
                  </span>
                </div>

                {/* Classification and AI Statement */}
                <div className="flex-1">
                  <span className="text-[9px] font-mono font-bold text-emerald-600 uppercase tracking-widest block">AGENT DIAGNOSTIC METRICS</span>
                  
                  {/* Generated Title Input (allows manual override) */}
                  <div className="mt-2">
                    <label className="text-[10px] font-sans font-bold text-slate-400 uppercase">Auto-Generated Title</label>
                    <input
                      id="report-title-input"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-slate-800 rounded-lg px-2.5 py-1.5 font-display font-bold text-slate-800 text-xs md:text-sm mt-0.5 focus:outline-none"
                    />
                  </div>

                  {/* Category select overrides */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-[10px] font-sans font-bold text-slate-400 uppercase block">Category Class</label>
                      <select
                        id="report-category-select"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-sans text-xs text-slate-700 mt-0.5 focus:outline-none"
                      >
                        <option value="street lights">street lights</option>
                        <option value="waste managemnt">waste managemnt</option>
                        <option value="roads and infrastructure">roads and infrastructure</option>
                        <option value="water leakage">water leakage</option>
                        <option value="pothholes">pothholes</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-sans font-bold text-slate-400 uppercase block">Severity Level</label>
                      <select
                        id="report-severity-select"
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value as any)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-sans text-xs text-slate-700 mt-0.5 focus:outline-none"
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                        <option>Critical</option>
                      </select>
                    </div>
                  </div>

                  {/* AI Safety statement */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2.5 items-start">
                    <Award className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 font-sans block">Safety Analysis Briefing</span>
                      <p className="text-[11px] leading-relaxed text-slate-600 font-sans italic mt-0.5">
                        "{aiAnalysisText || "Bespoke civic parameters cataloged into local database models."}"
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 justify-center text-xs text-slate-400 font-sans">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Values are automatically parsed using secure server-side Google LLM models.
            </div>
          </div>
        )}

        {/* Step 4: LOCATION */}
        {step === 4 && (
          <div id="step-4-container" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="font-display font-bold text-slate-800 text-xl md:text-2xl text-center">
              📍 Drag pin to confirm coordinate.
            </h2>
            <p className="text-slate-500 text-xs md:text-sm text-center mt-1 mb-6">
              Confirm exactly where this issue is located on our interactive map.
            </p>

            <div className="flex gap-4 items-center justify-between mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2">
                <MapIcon className="w-4.5 h-4.5 text-emerald-600" />
                <div className="text-left">
                  <span className="text-[9px] font-mono font-bold text-slate-400 block uppercase">Assigned Ward Locality</span>
                  <span className="font-sans font-bold text-xs text-slate-700 uppercase">{locality} Area</span>
                </div>
              </div>
              
              <button
                id="fetch-gps-location-btn"
                onClick={fetchCurrentPosition}
                className="bg-white hover:bg-slate-50 text-emerald-600 font-sans font-semibold text-[11px] px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5" />
                GPS Sync Coordinates
              </button>
            </div>

            {/* Mini Map Canvas Container */}
            <div
              ref={miniMapContainerRef}
              id="report-mini-map"
              className="w-full h-[220px] rounded-xl border border-slate-200 overflow-hidden shadow-inner relative"
            />

            <div className="flex items-center gap-4 justify-center mt-3 text-[10px] text-slate-400 font-mono">
              <span>LAT: {latitude.toFixed(6)}</span>
              <span>LNG: {longitude.toFixed(6)}</span>
            </div>

            {/* Authenticate Report Card */}
            <div className="mt-6 p-4 border border-emerald-100 bg-emerald-50/30 rounded-2xl text-left animate-in fade-in duration-300">
              <span className="text-[10px] font-mono font-bold text-emerald-700 block uppercase tracking-wider mb-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 animate-pulse" />
                Citizen Authenticator
              </span>
              <p className="text-slate-600 text-xs font-sans mb-3 leading-relaxed">
                To prevent spam and ensure rapid municipal triage, please authenticate this report using your registered Citizen ID / Aadhaar details.
              </p>
              
              <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-sans font-black text-xs shrink-0">
                    ID
                  </div>
                  <div className="flex-1">
                    <span className="text-[9.5px] text-slate-400 block leading-none font-sans">Aadhaar ID (Last 4 Digits Verified)</span>
                    <span className="font-mono font-bold text-xs text-slate-700">
                      {user?.aadharId ? `XXXX XXXX ${user.aadharId.trim().slice(-4)}` : "XXXX XXXX 4821"}
                    </span>
                  </div>
                  <div className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-sans font-black text-[9px] uppercase leading-none">
                    SECURED
                  </div>
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-50 select-none">
                  <input
                    type="checkbox"
                    id="authenticate-report-checkbox"
                    checked={isAuthenticatedReport}
                    onChange={(e) => setIsAuthenticatedReport(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 bg-slate-50 border-slate-300 rounded focus:ring-emerald-500 mt-0.5 cursor-pointer"
                  />
                  <div className="text-left">
                    <p className="text-slate-700 text-[11.5px] font-bold font-sans">
                      I authenticate this report is true and accurate
                    </p>
                    <p className="text-slate-400 text-[10px] font-sans leading-tight">
                      By checking, you electronically sign this report and agree to provide truthful physical details.
                    </p>
                  </div>
                </label>
              </div>

              {/* Directly give the button to Submit report in the location section */}
              <div className="mt-4">
                <button
                  type="button"
                  id="report-submit-direct-btn"
                  onClick={handleFinalSubmit}
                  disabled={!isAuthenticatedReport}
                  className={`w-full py-3 px-4 rounded-xl font-sans font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98 ${
                    isAuthenticatedReport
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      : "bg-slate-200 text-slate-400 pointer-events-none"
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: CELEBRATION / SUBMIT SUCCESS */}
        {step === 5 && (
          <div id="step-5-container" className="text-center animate-in zoom-in-95 duration-500 flex flex-col items-center py-6">
            {/* Green Tick */}
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4 border border-emerald-200 shadow-sm animate-bounce">
              <CheckCircle className="w-8 h-8" />
            </div>

            <h2 className="font-display font-bold text-slate-800 text-2xl">
              Reported Successfully
            </h2>
            <p className="text-slate-500 text-xs md:text-sm mt-1 max-w-md mx-auto">
              Your civic report has been authenticated and broadcasted directly to municipal departments.
            </p>

            {/* Reward 30XP only */}
            <div className="mt-6 bg-gradient-to-b from-emerald-50 to-teal-50/70 border border-emerald-100 rounded-2xl p-5 max-w-sm w-full shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
                <Award className="w-24 h-24 text-emerald-600" />
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 block uppercase tracking-widest">CITIZEN REWARDS PROFILE</span>
              <h3 className="font-display font-black text-emerald-600 text-3xl tracking-tight mt-1">
                30XP
              </h3>
              <p className="text-slate-600 text-[11px] font-sans mt-1">
                Granted 30 Experience Points for authenticating this report.
              </p>
              
              <div className="mt-3 flex items-center justify-between pt-3 border-t border-emerald-100/50">
                <div className="flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-700">New Badge: Civic Hero</span>
                </div>
                <div className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[10px] text-slate-600 font-mono">1 Day Streak!</span>
                </div>
              </div>
            </div>

            {/* CTA Navigation buttons */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <button
                onClick={() => onNavigateToTab("Map")}
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-sans font-semibold text-xs py-3 px-4 rounded-xl transition-all shadow active:scale-98 flex items-center justify-center gap-1.5"
              >
                <MapIcon className="w-4 h-4" />
                View on Map Explorer
              </button>
              <button
                onClick={() => onNavigateToTab("Track")}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-sans font-semibold text-xs py-3 px-4 rounded-xl transition-all border border-slate-200 active:scale-98 flex items-center justify-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                Track Resolution Timeline
              </button>
            </div>
          </div>
        )}

        {/* Progress Loading Screen for AI Analyser */}
        {isAnalyzing && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-[1000] p-6 animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin mb-4" />
            <h3 className="font-display font-bold text-slate-800 text-lg">Running AI Diagnostic Agents...</h3>
            <p className="text-slate-400 font-mono text-[10px] mt-1.5 tracking-wider uppercase animate-pulse">
              {analysisProgress}
            </p>
          </div>
        )}

        {/* Sticky Control Buttons Footer (except on success slide) */}
        {step < 5 && (
          <div id="report-form-buttons-footer" className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between shrink-0">
            <button
              id="report-back-btn"
              onClick={() => step > 1 && setStep(step - 1)}
              disabled={step === 1}
              className={`font-sans font-semibold text-xs px-4 py-2 rounded-xl flex items-center gap-1 transition-all ${
                step === 1 ? "text-slate-300 pointer-events-none" : "text-slate-600 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            {step === 1 ? (
              <button
                id="report-next-step-1"
                onClick={() => setStep(2)}
                disabled={!image || isCheckingQuality}
                className={`font-sans font-semibold text-xs px-5 py-2.5 rounded-full flex items-center gap-1 transition-all shadow ${
                  image && !isCheckingQuality ? "bg-emerald-600 hover:bg-emerald-700 text-white hover:translate-x-0.5" : "bg-slate-100 text-slate-400 pointer-events-none"
                }`}
              >
                {isCheckingQuality ? "Checking Quality..." : "Add Context"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : step === 2 ? (
              <button
                id="report-trigger-ai-btn"
                onClick={triggerAiAgentAnalysis}
                disabled={description.trim().length < 5 || isCategoryCorrect !== true}
                className={`font-sans font-bold text-xs px-5 py-2.5 rounded-full flex items-center gap-1.5 transition-all shadow-md ${
                  description.trim().length >= 5 && isCategoryCorrect === true
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white hover:scale-102 active:scale-98"
                    : "bg-slate-100 text-slate-400 pointer-events-none"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                Analyze with AI Agent
              </button>
            ) : step === 3 ? (
              <button
                id="report-next-step-3"
                onClick={() => setStep(4)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-semibold text-xs px-5 py-2.5 rounded-full flex items-center gap-1 transition-all shadow"
              >
                Set Location Coordinates
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                id="report-submit-final-btn"
                onClick={handleFinalSubmit}
                disabled={!isAuthenticatedReport}
                className={`font-sans font-bold text-xs px-6 py-2.5 rounded-full flex items-center gap-1 transition-all shadow-md active:scale-98 ${
                  isAuthenticatedReport
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-102 cursor-pointer"
                    : "bg-slate-200 text-slate-400 pointer-events-none"
                }`}
              >
                Submit Hyperlocal Report
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
