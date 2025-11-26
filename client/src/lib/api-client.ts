/**
 * API Client with automatic JWT token injection
 */

const TOKEN_KEY = "auth_token";

export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Add Authorization header if token exists
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If unauthorized, clear token and redirect to login
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("auth_user");
    window.location.href = "/login";
  }

  return response;
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiRequest(url);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
}

export async function apiPost<T>(url: string, data: any): Promise<T> {
  const response = await apiRequest(url, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API request failed: ${response.statusText}`);
  }
  return response.json();
}

export async function apiPatch<T>(url: string, data: any): Promise<T> {
  const response = await apiRequest(url, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  return response.json();
}

export async function apiDelete(url: string): Promise<void> {
  const response = await apiRequest(url, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
}
