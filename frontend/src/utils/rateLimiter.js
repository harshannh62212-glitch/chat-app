let lastSentTime = 0;

/**
 * Checks if the user is allowed to send a message based on the 1-second rate limit.
 * Admins are automatically exempt.
 * 
 * @param {boolean} isAdmin - Whether the current user is an admin.
 * @returns {boolean} - True if allowed, false if rate limited.
 */
export function checkRateLimit(isAdmin) {
  if (isAdmin) return true;
  
  const now = Date.now();
  if (now - lastSentTime < 1000) {
    return false;
  }
  
  lastSentTime = now;
  return true;
}
