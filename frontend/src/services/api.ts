import axios from 'axios';

// Configuration de l'API
export const API_BASE_URL = 'http://127.0.0.1:8000'; // Force l'URL pour éviter les problèmes de cache

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
  role: string;
  created_at: string;
}

export type Role = 'admin' | 'analyst' | 'viewer';

export interface CreateUserRequest {
  username: string;
  password: string;
  role?: Role;
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
  id: string;
  sourceIdentifier?: string;
  published?: string;
  lastModified?: string;
  vulnStatus?: string;
  descriptions?: Array<{
    lang: string;
    value: string;
  }>;
  metrics?: {
    cvssMetricV31?: Array<{
      source?: string;
      type?: string;
      cvssData: {
        version?: string;
        vectorString?: string;
        baseScore: number;
        baseSeverity: string;
        attackVector?: 'NETWORK' | 'ADJACENT_NETWORK' | 'LOCAL' | 'PHYSICAL';
        attackComplexity?: 'LOW' | 'HIGH';
        privilegesRequired?: 'NONE' | 'LOW' | 'HIGH';
        userInteraction?: 'NONE' | 'REQUIRED';
        scope?: 'UNCHANGED' | 'CHANGED';
        confidentialityImpact?: 'NONE' | 'LOW' | 'HIGH';
        integrityImpact?: 'NONE' | 'LOW' | 'HIGH';
        availabilityImpact?: 'NONE' | 'LOW' | 'HIGH';
      };
      exploitabilityScore?: number;
      impactScore?: number;
    }>;
    cvssMetricV30?: Array<{
      source?: string;
      type?: string;
      cvssData: {
        version?: string;
        vectorString?: string;
        baseScore: number;
        baseSeverity: string;
        attackVector?: 'NETWORK' | 'ADJACENT_NETWORK' | 'LOCAL' | 'PHYSICAL';
        attackComplexity?: 'LOW' | 'HIGH';
        privilegesRequired?: 'NONE' | 'LOW' | 'HIGH';
        userInteraction?: 'NONE' | 'REQUIRED';
        scope?: 'UNCHANGED' | 'CHANGED';
        confidentialityImpact?: 'NONE' | 'LOW' | 'HIGH';
        integrityImpact?: 'NONE' | 'LOW' | 'HIGH';
        availabilityImpact?: 'NONE' | 'LOW' | 'HIGH';
      };
      exploitabilityScore?: number;
      impactScore?: number;
    }>;
    cvssMetricV2?: Array<{
      cvssData: {
        baseScore: number;
      };
    }>;
  };
  weaknesses?: any[];
  weaknesses_enriched?: Array<{
    source?: string;
    type?: string;
    cweId?: string;
    cweName?: string | null;
  }>;
  configurations?: any[];
  references?: Array<{
    url: string;
    source?: string;
  }>;
  // Legacy fields for backward compatibility
  description?: string;
  score?: number;
  severity?: string;
  published_date?: string;
  last_modified_date?: string;
}

export interface CPE {
  criteria: string;
  matchCriteriaId: string;
  vulnerable: boolean;
  part?: string;
  vendor?: string;
  product?: string;
  version?: string;
  versionStartIncluding?: string;
  versionEndIncluding?: string;
  versionStartExcluding?: string;
  versionEndExcluding?: string;
}

export interface VulnerabilityCollection {
  total: number;
  vulnerabilities: Vulnerability[];
  total_by_severity?: { [key: string]: number };
}

export interface InventoryVulnerability {
  cve_id: string;
  description: string;
  score: number;
  url?: string;
}

export interface Inventory {
  _id: string;
  host_id: string;
  software_name: string;
  version: string;
  install_date?: string;
  vulnerabilities: InventoryVulnerability[];
  created_at: string;
}

export interface SoftwareSummary {
  software_name: string;
  total_installations: number;
  unique_versions: number;
  latest_version: string;
  hosts_count: number;
  vulnerability_count: number;
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

// Workflow Types
export type WorkflowStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';
export type ConnectorType = 'EMAIL' | 'THEHIVE' | 'SERVICENOW' | 'JIRA';
export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
export type RuleOperator = 'equals' | 'not_equals' | 'greater_than' | 'greater_than_or_equal' | 
                          'less_than' | 'less_than_or_equal' | 'contains' | 'not_contains' | 'in' | 'not_in';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value: string | number | string[];
}

export interface EmailAction {
  connector_id: number;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
}

export interface TheHiveAction {
  connector_id: number;
  title: string;
  description: string;
  severity?: number;
  tlp?: number;
  tags?: string[];
}

export interface ServiceNowAction {
  connector_id: number;
  short_description: string;
  description: string;
  priority?: number;
  category?: string;
  assignment_group?: string;
}

export interface JiraAction {
  connector_id: number;
  title?: string;
  project_key?: string;
  issue_type: string; // e.g., Task, Bug, Story
}

export interface WorkflowAction {
  type: string;
  config: EmailAction | TheHiveAction | ServiceNowAction | JiraAction;
}

export interface Workflow {
  id: number;
  name: string;
  description?: string;
  status: WorkflowStatus;
  rules: RuleCondition[];
  rule_logic: string;
  actions: WorkflowAction[];
  enabled: boolean;
  trigger_on_ingest: boolean;
  trigger_on_schedule: boolean;
  schedule_cron?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by?: string;
}

export interface WorkflowCreate {
  name: string;
  description?: string;
  status?: WorkflowStatus;
  rules: RuleCondition[];
  rule_logic?: string;
  actions: WorkflowAction[];
  enabled?: boolean;
  trigger_on_ingest?: boolean;
  trigger_on_schedule?: boolean;
  schedule_cron?: string;
}

export interface WorkflowExecution {
  id: number;
  workflow_id: number;
  trigger_type: string;
  vulnerability_id?: string;
  status: ExecutionStatus;
  started_at: string;
  completed_at?: string;
  rules_matched: boolean;
  actions_executed: number;
  actions_failed: number;
  execution_log?: any;
  error_message?: string;
  idempotency_key?: string;
}

export interface ConnectorConfig {
  id: number;
  name: string;
  connector_type: ConnectorType;
  config: any;
  enabled: boolean;
  last_tested_at?: string;
  test_status?: string;
  test_message?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ConnectorConfigCreate {
  name: string;
  connector_type: ConnectorType;
  config: any;
  enabled?: boolean;
}

export interface WorkflowTestRequest {
  vulnerability_id: string;
}

export interface WorkflowTestResult {
  rules_matched: boolean;
  matched_rules: any[];
  actions_to_execute: any[];
}

// Auth API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
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

  register: async (userData: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post<User>('/api/v1/users/', userData);
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

// Workflows
export const workflowAPI = {
  getAll: async (params?: { status?: WorkflowStatus; enabled?: boolean; skip?: number; limit?: number }): Promise<Workflow[]> => {
    const searchParams = new URLSearchParams();
    
    if (params?.status) {
      searchParams.append('status', params.status);
    }
    if (params?.enabled !== undefined) {
      searchParams.append('enabled', params.enabled.toString());
    }
    if (params?.skip !== undefined) {
      searchParams.append('skip', params.skip.toString());
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    
    const response = await apiClient.get(`/api/v1/workflows/?${searchParams}`);
    return response.data;
  },

  getById: async (workflowId: number): Promise<Workflow> => {
    const response = await apiClient.get(`/api/v1/workflows/${workflowId}`);
    return response.data;
  },

  create: async (workflow: WorkflowCreate): Promise<Workflow> => {
    const response = await apiClient.post('/api/v1/workflows/', workflow);
    return response.data;
  },

  update: async (workflowId: number, workflow: Partial<WorkflowCreate>): Promise<Workflow> => {
    const response = await apiClient.put(`/api/v1/workflows/${workflowId}`, workflow);
    return response.data;
  },

  delete: async (workflowId: number): Promise<void> => {
    await apiClient.delete(`/api/v1/workflows/${workflowId}`);
  },

  test: async (workflowId: number, testRequest: WorkflowTestRequest): Promise<WorkflowTestResult> => {
    const response = await apiClient.post(`/api/v1/workflows/${workflowId}/test`, testRequest);
    return response.data;
  },

  testWithCustomData: async (workflowId: number, testData: any): Promise<any> => {
    const response = await apiClient.post(`/api/v1/workflows/${workflowId}/test-custom`, testData);
    return response.data;
  },

  execute: async (workflowId: number, testRequest: WorkflowTestRequest): Promise<any> => {
    const response = await apiClient.post(`/api/v1/workflows/${workflowId}/execute`, testRequest);
    return response.data;
  },

  getExecutions: async (workflowId: number, params?: { status?: ExecutionStatus; skip?: number; limit?: number }): Promise<WorkflowExecution[]> => {
    const searchParams = new URLSearchParams();
    
    if (params?.status) {
      searchParams.append('status', params.status);
    }
    if (params?.skip !== undefined) {
      searchParams.append('skip', params.skip.toString());
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    
    const response = await apiClient.get(`/api/v1/workflows/${workflowId}/executions?${searchParams}`);
    return response.data;
  },

  getAllExecutions: async (params?: { workflow_id?: number; vulnerability_id?: string; status?: ExecutionStatus; skip?: number; limit?: number }): Promise<WorkflowExecution[]> => {
    const searchParams = new URLSearchParams();
    
    if (params?.workflow_id) {
      searchParams.append('workflow_id', params.workflow_id.toString());
    }
    if (params?.vulnerability_id) {
      searchParams.append('vulnerability_id', params.vulnerability_id);
    }
    if (params?.status) {
      searchParams.append('status', params.status);
    }
    if (params?.skip !== undefined) {
      searchParams.append('skip', params.skip.toString());
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    
    const response = await apiClient.get(`/api/v1/workflows/executions/?${searchParams}`);
    return response.data;
  },

  getExecutionDetails: async (executionId: number): Promise<any> => {
    const response = await apiClient.get(`/api/v1/workflows/executions/${executionId}`);
    return response.data;
  },

  getStats: async (): Promise<any> => {
    const response = await apiClient.get('/api/v1/workflows/stats/');
    return response.data;
  },
};
// Users API
export const usersAPI = {
  list: async (params?: { skip?: number; limit?: number }): Promise<User[]> => {
    const searchParams = new URLSearchParams();
    if (params?.skip !== undefined) searchParams.append('skip', params.skip.toString());
    if (params?.limit !== undefined) searchParams.append('limit', params.limit.toString());
    const url = searchParams.toString() ? `/api/v1/users/?${searchParams}` : '/api/v1/users/';
    const response = await apiClient.get<User[]>(url);
    return response.data;
  },

  create: async (payload: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post<User>('/api/v1/users/', payload);
    return response.data;
  },

  updateRole: async (username: string, role: Role): Promise<User> => {
    const response = await apiClient.put<User>(`/api/v1/users/${encodeURIComponent(username)}/role`, { role });
    return response.data;
  },

  delete: async (username: string): Promise<void> => {
    await apiClient.delete(`/api/v1/users/${encodeURIComponent(username)}`);
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
  getAll: async (params?: { search?: string; skip?: number; limit?: number; severity?: string; published?: string }): Promise<VulnerabilityCollection> => {
    const searchParams = new URLSearchParams();
    
    if (params?.search) {
      searchParams.append('search', params.search);
    }
    if (params?.skip !== undefined) {
      searchParams.append('skip', params.skip.toString());
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    if (params?.severity) {
      searchParams.append('severity', params.severity);
    }
    if (params?.published) {
      searchParams.append('published', params.published);
    }
    
    const response = await apiClient.get(`/api/v1/vulnerabilities/?${searchParams}`);
    return response.data;
  },

  getById: async (cveId: string): Promise<Vulnerability> => {
    const response = await apiClient.get(`/api/v1/vulnerabilities/${cveId}`);
    return response.data;
  },
  create: async (payload: Partial<Vulnerability> & { id: string }): Promise<Vulnerability> => {
    // Payload must follow VulnerabilityCreate on backend
    const response = await apiClient.post(`/api/v1/vulnerabilities/`, payload);
    return response.data;
  },
};

// Connectors
export const connectorAPI = {
  getAll: async (params?: { connector_type?: ConnectorType; enabled?: boolean; skip?: number; limit?: number }): Promise<ConnectorConfig[]> => {
    const searchParams = new URLSearchParams();
    
    if (params?.connector_type) {
      searchParams.append('connector_type', params.connector_type);
    }
    if (params?.enabled !== undefined) {
      searchParams.append('enabled', params.enabled.toString());
    }
    if (params?.skip !== undefined) {
      searchParams.append('skip', params.skip.toString());
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }
    
    const response = await apiClient.get(`/api/v1/connectors/?${searchParams}`);
    return response.data;
  },

  getById: async (connectorId: number): Promise<ConnectorConfig> => {
    const response = await apiClient.get(`/api/v1/connectors/${connectorId}`);
    return response.data;
  },

  create: async (connector: ConnectorConfigCreate): Promise<ConnectorConfig> => {
    const response = await apiClient.post('/api/v1/connectors/', connector);
    return response.data;
  },

  update: async (connectorId: number, connector: Partial<ConnectorConfigCreate>): Promise<ConnectorConfig> => {
    const response = await apiClient.put(`/api/v1/connectors/${connectorId}`, connector);
    return response.data;
  },

  delete: async (connectorId: number): Promise<void> => {
    await apiClient.delete(`/api/v1/connectors/${connectorId}`);
  },

  test: async (connectorId: number): Promise<any> => {
    const response = await apiClient.post(`/api/v1/connectors/${connectorId}/test`);
    return response.data;
  },

  getTypes: async (): Promise<{ supported_types: ConnectorType[] }> => {
    const response = await apiClient.get('/api/v1/connectors/types/');
    return response.data;
  },
};

// Inventory
export const inventoryAPI = {
  getAll: async (host_id?: string, skip = 0, limit = 100): Promise<Inventory[]> => {
    const params = new URLSearchParams({
      skip: skip.toString(),
      limit: limit.toString(),
    });
    if (host_id) {
      params.append('host_id', host_id);
    }
    
    const response = await apiClient.get(`/api/v1/inventories/?${params}`);
    return response.data;
  },

  getCount: async (host_id?: string): Promise<number> => {
    const params = new URLSearchParams();
    if (host_id) {
      params.append('host_id', host_id);
    }
    const url = params.toString()
      ? `/api/v1/inventories/count?${params}`
      : '/api/v1/inventories/count';
    const response = await apiClient.get<{ count: number }>(url);
    return response.data.count;
  },

  getHostVulns: async (host_id: string): Promise<Array<{ _id: string; software_name: string; version: string; cves: string[] }>> => {
    const params = new URLSearchParams({ host_id });
    const response = await apiClient.get(`/api/v1/inventories/host-vulns?${params}`);
    return response.data;
  },

  getSoftwareSummary: async (): Promise<SoftwareSummary[]> => {
    const response = await apiClient.get('/api/v1/inventory/software-summary');
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

// OpenSearch generic DSL query
export const opensearchAPI = {
  query: async (index: string, query: any): Promise<any> => {
    const response = await apiClient.post(`/api/v1/opensearch/query?index=${encodeURIComponent(index)}`, query);
    return response.data;
  },
};

// Fonction utilitaire pour vérifier si l'utilisateur est connecté
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('access_token');
};