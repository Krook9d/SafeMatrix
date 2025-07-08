import axios from 'axios';

// Configuration de l'API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Instance axios configurée
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter automatiquement le token JWT
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses et les erreurs
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré ou invalide, rediriger vers login
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types TypeScript
export interface User {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface Host {
  _id: string;
  hostname: string;
  ip_address: string;
  os: {
    name: string;
    version: string;
  };
  created_at: string;
  updated_at: string;
}

export interface Software {
  id: string;
  host_id: string;
  name: string;
  version: string;
  vendor?: string;
  discovered_at: string;
  vulnerabilities?: Vulnerability[];
}

export interface Vulnerability {
  cve_id: string;
  description: string;
  cvss_score: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  published_date: string;
  reference_urls: string[];
}

export interface DashboardStats {
  total_hosts: number;
  total_software: number;
  total_vulnerabilities: number;
  critical_vulnerabilities: number;
  hosts_by_os: { [key: string]: number };
  vulnerabilities_by_severity: { [key: string]: number };
  recent_vulnerabilities: Vulnerability[];
}

// Services API

// Authentification
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);
    
    const response = await apiClient.post<LoginResponse>(
      '/api/v1/login/access-token',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/api/v1/users/me/');
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
  },
};

// Hosts
export const hostsAPI = {
  getAll: async (): Promise<Host[]> => {
    const response = await apiClient.get<Host[]>('/api/v1/hosts/');
    return response.data;
  },

  getById: async (hostId: string): Promise<Host> => {
    const response = await apiClient.get<Host>(`/api/v1/hosts/${hostId}`);
    return response.data;
  },

  getInventory: async (hostId: string): Promise<Software[]> => {
    const response = await apiClient.get<Software[]>(`/api/v1/hosts/${hostId}/inventory`);
    return response.data;
  },
};

// Vulnerabilities
export const vulnerabilitiesAPI = {
  search: async (query: string): Promise<Vulnerability[]> => {
    const response = await apiClient.get<Vulnerability[]>(
      `/api/v1/vulnerabilities/search?q=${encodeURIComponent(query)}`
    );
    return response.data;
  },

  getById: async (cveId: string): Promise<Vulnerability> => {
    const response = await apiClient.get<Vulnerability>(`/api/v1/vulnerabilities/${cveId}`);
    return response.data;
  },
};

// Dashboard
export const dashboardAPI = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await apiClient.get<DashboardStats>('/api/v1/dashboard/stats');
    return response.data;
  },
};

// Fonction utilitaire pour vérifier si l'utilisateur est connecté
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('access_token');
}; 