/**
 * Safely extracts a human-readable string from any error object, Axios error, or server response.
 * Completely prevents React Minified Error #31 (Objects are not valid as a React child).
 */
export function formatErrorMessage(err, fallback = 'An unexpected error occurred') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;

  const data = err.response?.data;
  if (typeof data === 'string') {
    // If server returned HTML (e.g. 404/502 page), return a friendly message
    if (data.trim().startsWith('<')) {
      return `${fallback} (Status: ${err.response?.status || 'Network Error'})`;
    }
    return data;
  }

  if (data?.error) {
    if (typeof data.error === 'string') return data.error;
    if (typeof data.error?.message === 'string') return data.error.message;
    if (typeof data.error === 'object') {
      try {
        return JSON.stringify(data.error);
      } catch (e) {}
    }
  }

  if (data?.message && typeof data.message === 'string') {
    return data.message;
  }

  if (err.message && typeof err.message === 'string') {
    return err.message;
  }

  if (typeof data === 'object') {
    try {
      return JSON.stringify(data);
    } catch (e) {}
  }

  return fallback;
}
