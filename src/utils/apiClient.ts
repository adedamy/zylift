// Centralized authenticated API fetch helper for Zylift Campus Transit

export type UserRoleType = 'rider' | 'driver' | 'admin';

export function getStoredToken(role: UserRoleType = 'rider'): string | null {
  if (role === 'driver') return localStorage.getItem('zylift_driver_token');
  if (role === 'admin') return localStorage.getItem('zylift_admin_token');
  return localStorage.getItem('zylift_rider_token');
}

export function setStoredToken(role: UserRoleType, token: string): void {
  if (role === 'driver') localStorage.setItem('zylift_driver_token', token);
  else if (role === 'admin') localStorage.setItem('zylift_admin_token', token);
  else localStorage.setItem('zylift_rider_token', token);
}

export function clearStoredToken(role: UserRoleType): void {
  if (role === 'driver') localStorage.removeItem('zylift_driver_token');
  else if (role === 'admin') localStorage.removeItem('zylift_admin_token');
  else localStorage.removeItem('zylift_rider_token');
}

export function getAuthHeaders(role: UserRoleType = 'rider'): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getStoredToken(role);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function authFetch(
  url: string,
  options: RequestInit = {},
  role: UserRoleType = 'rider'
): Promise<Response> {
  const authHeaders = getAuthHeaders(role);
  const headers = {
    ...authHeaders,
    ...((options.headers as Record<string, string>) || {}),
  };
  return fetch(url, {
    ...options,
    headers,
  });
}
