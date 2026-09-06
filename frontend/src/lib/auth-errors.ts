export function formatAuthError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const message = e.message ?? "";

  if (e.code === "auth/operation-not-allowed") {
    return "Google Sign-In is not enabled. Go to Firebase Console → Authentication → Sign-in method → enable Google.";
  }
  if (e.code === "auth/unauthorized-domain") {
    return "This domain is not authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
  }
  if (message.toLowerCase().includes("requested action is invalid")) {
    return "Google Sign-In is not set up yet. Enable Google in Firebase Console → Authentication → Sign-in method, then try again using http://localhost:5173 (not an IP address).";
  }
  if (e.code === "auth/popup-closed-by-user") {
    return "Sign-in popup was closed. Please try again.";
  }

  return message || "Sign-in failed. Please try again.";
}
