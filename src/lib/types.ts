export type Category = "words" | "sentences" | "questions" | "grammar";

export interface Prompt {
  id: string;
  syllabics: string;
  romanized: string;
  category: Category;
}

export interface Recording {
  id: string;
  promptId: string;
  category: Category;
  speakerName: string;
  blob: Blob;
  timestamp: string;
  text: string;
  filename: string;
}

export interface SessionState {
  category: Category;
  currentIndex: number;
  recordings: Map<string, Recording>;
  skipped: Set<string>;
}
