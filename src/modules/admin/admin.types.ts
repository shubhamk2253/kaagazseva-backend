/**
 * KAAGAZSEVA - Admin Module Types
 */

export interface DashboardStats {
  users: {
    totalCitizens: number;
    totalAgents: number;
    totalAdmins: number;
    newToday: number;
    activeUsers: number;
  };

  applications: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    rejected: number;
    reUploadRequested: number;
  };

  financials: {
    totalRevenue: number;
    totalTransactions: number;
    totalWalletBalance: number;
    topUpsToday: number;
    revenueToday: number;
  };
}

export interface RevenueTrend {
  date: string;
  revenue: number;
  transactions: number;
}