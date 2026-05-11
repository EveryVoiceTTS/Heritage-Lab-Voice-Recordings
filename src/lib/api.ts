export interface Speaker {
  id: number;
  pin: string;
  name: string | null;
}

export async function verifyPin(pin: string): Promise<Speaker> {
  const res = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Authentication failed");
  }
  return res.json();
}

export async function fetchProgress(
  speakerId: number,
): Promise<Record<string, number>> {
  const res = await fetch(`/api/progress?speaker_id=${speakerId}`);
  if (!res.ok) throw new Error("Failed to load progress");
  const data = await res.json();
  return data.progress;
}

export async function fetchLatestPrompt(
  speakerId: number,
): Promise<Record<string, string>> {
  const res = await fetch(`/api/progress?speaker_id=${speakerId}`);
  if (!res.ok) throw new Error("Failed to load latestPrompt");
  const data = await res.json();
  return data.latestprompts;
}

export async function saveProgress(
  speakerId: number,
  items: { prompt_id: string; category: string }[],
): Promise<void> {
  const res = await fetch("/api/progress", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speaker_id: speakerId, items }),
  });
  if (!res.ok) throw new Error("Failed to save progress");
}

export interface NoteItem {
  prompt_id: string;
  category: string;
  note: string;
}

export async function saveNotes(
  speakerId: number,
  items: NoteItem[],
): Promise<void> {
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speaker_id: speakerId, items }),
  });
  if (!res.ok) throw new Error("Failed to save notes");
}

export async function setupDatabase(): Promise<void> {
  const res = await fetch("/api/setup", { method: "POST" });
  if (!res.ok) throw new Error("Failed to initialize database");
}
