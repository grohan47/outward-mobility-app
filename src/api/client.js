export async function apiGet(path) {
    const response = await fetch(path);
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `GET ${path} failed: ${response.status}`);
    }
    return response.json();
}

export async function apiPost(path, payload) {
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
