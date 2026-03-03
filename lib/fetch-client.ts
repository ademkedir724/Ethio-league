/**
 * Client-side fetch wrapper that attaches the Bearer token automatically.
 * Handles 401 by attempting a token refresh.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem("accessToken");

  const headers = new Headers(options.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Attempt refresh
    const refreshToken = localStorage.getItem("refreshToken");
    if (refreshToken) {
      const refreshRes = await fetch("/api/auth/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        localStorage.setItem("accessToken", data.accessToken);
        headers.set("Authorization", `Bearer ${data.accessToken}`);
        res = await fetch(url, { ...options, headers });
      } else {
        // Refresh failed - clear tokens and redirect
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
  }

  return res;
}

/**
 * SWR fetcher that uses auth tokens.
 */
export const authFetcher = async (url: string) => {
  const res = await fetchWithAuth(url);
  if (!res.ok) {
    const error = new Error("Fetch failed");
    throw error;
  }
  return res.json();
};
