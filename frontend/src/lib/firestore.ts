import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { stripUndefined } from "./sanitize";

export interface Interaction {
  id: string;
  title: string;
  preview: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  archivedAt: Date | null;
  status: "draft" | "archived";
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getDb() {
  if (!db) throw new Error("Firestore not initialized. Check frontend/.env");
  return db;
}

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as Timestamp).toDate === "function"
  ) {
    return (value as Timestamp).toDate();
  }
  if (typeof value === "object" && "seconds" in value) {
    const ts = value as { seconds: number; nanoseconds?: number };
    return new Date(ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1_000_000);
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function interactionsRef(userId: string) {
  return collection(getDb(), "users", userId, "interactions");
}

export function messagesRef(userId: string, interactionId: string) {
  return collection(getDb(), "users", userId, "interactions", interactionId, "messages");
}

export async function createInteractionWithId(
  userId: string,
  interactionId: string,
  title: string,
  preview: string,
  archived = false
): Promise<string> {
  await setDoc(
    doc(getDb(), "users", userId, "interactions", interactionId),
    stripUndefined({
      title: title.slice(0, 120),
      preview: preview.slice(0, 200),
      status: archived ? "archived" : "draft",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(archived ? { archivedAt: serverTimestamp() } : {}),
    })
  );
  return interactionId;
}

export async function saveSessionMessages(
  userId: string,
  interactionId: string,
  messages: ChatMessage[],
  startIndex = 0
): Promise<number> {
  const unsaved = messages.slice(startIndex);
  if (unsaved.length === 0) return startIndex;

  const db = getDb();
  const batch = writeBatch(db);
  const col = messagesRef(userId, interactionId);

  for (const msg of unsaved) {
    const ref = doc(col);
    batch.set(
      ref,
      stripUndefined({
        role: msg.role,
        content: msg.content,
        createdAt: serverTimestamp(),
      })
    );
  }

  await batch.commit();
  return startIndex + unsaved.length;
}

export async function createInteraction(
  userId: string,
  title: string,
  preview: string
): Promise<string> {
  const ref = await addDoc(
    interactionsRef(userId),
    stripUndefined({
      title: title.slice(0, 120),
      preview: preview.slice(0, 200),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  return ref.id;
}

export async function saveMessage(
  userId: string,
  interactionId: string,
  role: "user" | "assistant",
  content: string
): Promise<string> {
  const ref = await addDoc(
    messagesRef(userId, interactionId),
    stripUndefined({ role, content, createdAt: serverTimestamp() })
  );
  return ref.id;
}

export async function listArchives(userId: string): Promise<Interaction[]> {
  const q = query(interactionsRef(userId), orderBy("archivedAt", "desc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: (data.title as string) ?? "Untitled reflection",
        preview: (data.preview as string) ?? "",
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
        archivedAt: toDate(data.archivedAt),
        status: (data.status as Interaction["status"]) ?? "archived",
      };
    })
    .filter((item) => item.status === "archived" || item.archivedAt);
}

export async function listInteractions(userId: string): Promise<Interaction[]> {
  return listArchives(userId);
}

export async function listMessages(
  userId: string,
  interactionId: string
): Promise<StoredMessage[]> {
  const q = query(messagesRef(userId, interactionId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      role: data.role as "user" | "assistant",
      content: data.content as string,
      createdAt: toDate(data.createdAt),
    };
  });
}

export async function markInteractionArchived(
  userId: string,
  interactionId: string,
  preview: string
): Promise<void> {
  await updateDoc(
    doc(getDb(), "users", userId, "interactions", interactionId),
    stripUndefined({
      status: "archived",
      archivedAt: serverTimestamp(),
      preview: preview.slice(0, 200),
      updatedAt: serverTimestamp(),
    })
  );
}

export async function updateInteractionPreview(
  userId: string,
  interactionId: string,
  preview: string
): Promise<void> {
  await updateDoc(
    doc(getDb(), "users", userId, "interactions", interactionId),
    stripUndefined({
      preview: preview.slice(0, 200),
      updatedAt: serverTimestamp(),
    })
  );
}
