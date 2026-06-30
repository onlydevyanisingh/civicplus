export interface TimelineEvent {
  status: string;
  date: string;
  description: string;
}

export interface CivicIssue {
  id: string;
  title: string;
  description: string;
  category: string;
  locality: string;
  lat: number;
  lng: number;
  severity: "Low" | "Medium" | "High" | "Critical";
  status: "reported" | "in-progress" | "resolved";
  urgency: "Low" | "Medium" | "High" | "Critical";
  urgencyScore: number;
  priorityScore: number;
  verificationCount: number;
  verifications: string[]; // List of user emails who verified this issue
  imageUrl: string;
  afterImageUrl?: string;
  resolvedIn?: string;
  aiAnalysis?: string;
  createdAt: string;
  timeline: TimelineEvent[];
}

export interface LocalityIntel {
  civicHealthScore: number;
  healthStatus: "Excellent" | "Healthy" | "Needs Attention" | "Critical";
  summary: string;
  dominantIssueType: string;
  communityParticipationRate: number;
  trendDirection: "improving" | "stable" | "declining";
}

export interface RiskPrediction {
  id: string;
  title: string;
  probability: number;
  timeframe: string;
  description: string;
  associatedRiskLevel: "Low" | "Medium" | "High" | "Critical";
}

export interface ActionRecommendation {
  target: "Citizen" | "Municipality";
  title: string;
  steps: string[];
  impact: string;
  difficulty: "Easy" | "Medium" | "Hard";
}

export interface UserState {
  email: string;
  name: string;
  points: number;
  streak: number;
  badges: string[];
  reportedCount: number;
  verifiedCount: number;
  age?: number | string;
  aadharId?: string;
  city?: string;
  country?: string;
  profilePic?: string;
}

export interface CivicNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  issueId?: string;
  type: "in-progress" | "resolved";
}
