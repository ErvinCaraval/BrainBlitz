/**
 * Admin API Service
 * All admin operations go through the backend API, never direct database access
 */

class AdminService {
  constructor() {
    const apiUrl = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    this.baseUrl = apiUrl.replace('/api', '');
  }

  async getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  // Questions Management
  async getAllQuestions() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/questions`, { headers });
      if (!response.ok) throw new Error(`Failed to fetch questions: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching questions:', error);
      throw error;
    }
  }

  async createQuestion(question) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/questions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(question)
      });
      if (!response.ok) throw new Error(`Failed to create question: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }

  async updateQuestion(id, question) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/questions/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(question)
      });
      if (!response.ok) throw new Error(`Failed to update question: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  }

  async deleteQuestion(id) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/questions/${id}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) throw new Error(`Failed to delete question: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error deleting question:', error);
      throw error;
    }
  }

  // Accessibility Stats
  async getAccessibilityStats() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/admin/accessibility-stats`, { headers });
      if (!response.ok) throw new Error(`Failed to fetch accessibility stats: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching accessibility stats:', error);
      return {};
    }
  }

  // Accessibility Settings
  async getAccessibilitySettings() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/admin/accessibility-settings`, { headers });
      if (!response.ok) throw new Error(`Failed to fetch accessibility settings: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching accessibility settings:', error);
      return {};
    }
  }

  async updateAccessibilitySettings(settings) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/admin/accessibility-settings`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(settings)
      });
      if (!response.ok) throw new Error(`Failed to update accessibility settings: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error updating accessibility settings:', error);
      throw error;
    }
  }

  // Users Data
  async getUsersWithVoiceMode() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/api/admin/voice-mode-users`, { headers });
      if (!response.ok) throw new Error(`Failed to fetch voice mode users: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching voice mode users:', error);
      return [];
    }
  }

  // Accessibility Report
  async getAccessibilityReport(startDate, endDate) {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`${this.baseUrl}/api/admin/accessibility-report?${params}`, { headers });
      if (!response.ok) throw new Error(`Failed to fetch accessibility report: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching accessibility report:', error);
      return {};
    }
  }
}

export default new AdminService();
