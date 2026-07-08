export async function apiFetch(endpoint, options = {}) {
    const baseUrl = "http://localhost:3000";
    const token = localStorage.getItem("token");

    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
    };

    const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            credentials: 'include', 
            headers
        });

        if (response.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/register')) {
            logger.info("Access token expired, attempting background token refresh.");
            
            const refreshUrl = `${baseUrl}/api/auth/refresh`;
            const refreshResponse = await fetch(refreshUrl, {
                method: 'POST',
                credentials: 'include' 
            });

            if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                localStorage.setItem("token", refreshData.token); // Save new short-lived token

                headers["Authorization"] = `Bearer ${refreshData.token}`;

                const retryResponse = await fetch(url, {
                    ...options,
                    credentials: 'include',
                    headers
                });

                if (!retryResponse.ok) {
                    const errorText = await retryResponse.text();
                    throw new Error(`Retry failed status: ${retryResponse.status} ${errorText}`);
                }

                return await parseResponse(retryResponse);
            } else {
                localStorage.removeItem("token");
                window.location.href = "index.html"; 
                throw new Error("Session expired. Please log in again.");
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Response status: ${response.status} ${errorText}`);
        }

        return await parseResponse(response);
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}

async function parseResponse(res) {
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        return await res.json();
    }
    return await res.text();
}
