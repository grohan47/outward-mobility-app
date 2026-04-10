export async function apiGet(path) {
    // Frontend helper -> API: GET {path}
    // Common GET error handling lives in this wrapper.
    const response = await fetch(path);
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `GET ${path} failed: ${response.status}`);
    }
    return response.json();
}

export async function apiPost(path, payload) {
    // Frontend helper -> API: POST {path}
    // Common POST serialization is done with JSON.stringify(payload) below.
    const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `POST ${path} failed: ${response.status}`);
    }
    return response.json();
}
