export async function apiRequest(url, options = {}) {
  const hasJsonBody = options.body && !(options.body instanceof FormData);
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    const error = new Error(
      typeof detail === 'string'
        ? detail
        : detail?.message || body.error || `Request failed (${response.status})`,
    );
    error.status = response.status;
    error.details = detail;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}
