export function formatFirestoreError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = e.code ?? "";
  const message = e.message ?? "Unknown Firestore error";

  if (code === "permission-denied") {
    return "Permission denied saving to Firestore. Deploy security rules: firebase deploy --only firestore:rules";
  }
  if (code === "unavailable" || code === "failed-precondition") {
    return "Firestore is not available. Create a Firestore database in Firebase Console → Build → Firestore.";
  }
  if (message.includes("index")) {
    return "Firestore index required. Check the browser console for a link to create it.";
  }

  return message;
}
