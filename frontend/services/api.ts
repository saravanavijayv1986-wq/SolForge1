import { withRetry, handleError, parseError } from '../utils/error-handling';
import { API_CONFIG } from '../config';

class ApiService {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;

  constructor() {
    this.baseUrl = ''; // Encore.ts handles the base URL
    this.timeout = API_CONFIG.timeout;
    this.retries = API_CONFIG.retries;
    this.retryDelay = API_CONFIG.retryDelay;
  }

  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await withRetry(async () => {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const error = new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
          (error as any).status = res.status;
          (error as any).statusCode = res.status;
          throw error;
        }

        return res;
      }, this.retries, this.retryDelay);

      const data = await response.json();
      return data as T;
    } catch (error) {
      throw parseError(error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<T> {
    const searchParams = params ? new URLSearchParams(params).toString() : '';
    const fullUrl = searchParams ? `${url}?${searchParams}` : url;
    
    return this.makeRequest<T>(fullUrl, {
      method: 'GET',
    });
  }

  async post<T>(url: string, data?: any): Promise<T> {
    return this.makeRequest<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(url: string, data?: any): Promise<T> {
    return this.makeRequest<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(url: string): Promise<T> {
    return this.makeRequest<T>(url, {
      method: 'DELETE',
    });
  }

  // Health check
  async checkHealth(): Promise<any> {
    try {
      return await this.get(API_CONFIG.endpoints.health);
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  // Get metrics
  async getMetrics(): Promise<any> {
    try {
      return await this.get(API_CONFIG.endpoints.metrics);
    } catch (error) {
      console.error('Metrics fetch failed:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
export default apiService;
