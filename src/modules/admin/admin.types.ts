/**
 * KAAGAZSEVA - Admin Module Types
 * Aligned to DashboardService output and locked schema
 */

/* =====================================================
   DASHBOARD STATS
   Matches DashboardService.getFounderOverview()
===================================================== */

export interface DashboardStats {
  users: {
    totalCitizens: number;
    totalAgents:   number;
    totalAdmins:   number;
    newToday:      number;
  };

  applications: {
    total:          number;
    draft:          number;
    pendingPayment: number;
    paid:           number;
    assigning:      number;
    assigned:       number;
    accepted:       number;
    inProgress:     number;
    docsCollected:  number;
    submitted:      number;
    govtProcessing: number;
    completed:      number;
    confirmed:      number;
    closed:         number;
    disputed:       number;
    refundPending:  number;
    refunded:       number;
    cancelled:      number;
    rejected:       number;
  };

  financials: {
    totalRevenue:         number;
    totalTransactions:    number;
    totalWalletBalance:   number;
    revenueGrowthPercent: number;
    refundAnalytics:      RefundAnalytics;
  };

  revenueTrend: RevenueTrend[];
  topAgents:    AgentLeaderboardEntry[];
  lastUpdated:  string;
}

/* =====================================================
   REVENUE TREND
   Matches AdminRepository.getDailyRevenueTrend()
===================================================== */

export interface RevenueTrend {
  date:    string; // YYYY-MM-DD
  revenue: number; // in Rupees
}

/* =====================================================
   REFUND ANALYTICS
   Matches AdminRepository.getRefundAnalytics()
===================================================== */

export interface RefundAnalytics {
  revenueLast30Days:  number;
  refundsLast30Days:  number;
  refundRatioPercent: number;
  riskLevel:          'LOW' | 'MEDIUM' | 'HIGH';
}

/* =====================================================
   REVENUE GROWTH
   Matches AdminRepository.getRevenueGrowth()
===================================================== */

export interface RevenueGrowth {
  currentPeriodRevenue:  number;
  previousPeriodRevenue: number;
  growthPercent:         number;
}

/* =====================================================
   AGENT LEADERBOARD
   Matches AdminRepository.getAgentLeaderboard()
===================================================== */

export interface AgentLeaderboardEntry {
  agentId:               string | null;
  agentName:             string;
  email:                 string;
  completedApplications: number;
}

/* =====================================================
   ADMIN APPLICATION LIST ITEM
   Matches DashboardService.getApplications()
===================================================== */

export interface AdminApplicationItem {
  id:              string;
  referenceNumber: string;
  status:          string;
  totalAmount:     number;
  createdAt:       string;
  customer:        { name: string | null; email: string | null };
  agent:           { name: string | null; email: string | null } | null;
  service:         { name: string };
}

/* =====================================================
   ADMIN AGENT LIST ITEM
   Matches DashboardService.getAgents()
===================================================== */

export interface AdminAgentItem {
  id:    string;
  name:  string | null;
  email: string | null;
  agentProfile: {
    kycStatus:       string;
    isAvailable:     boolean;
    serviceRadiusKm: number;
  } | null;
  agentMetrics: {
    rating:         number;
    completedCases: number;
    activeCases:    number;
  } | null;
}

/* =====================================================
   QUERY PARAMS
===================================================== */

export interface AdminApplicationsQuery {
  status?: string;
  page:    number;
  limit:   number;
}

export interface AdminAgentsQuery {
  page:       number;
  limit:      number;
  kycStatus?: string;
}

export interface RevenueAnalyticsQuery {
  period: '7d' | '30d' | '90d' | '1y';
}