export interface GlossaryTerm {
  id: string;
  term: string;
  chinese: string;
  phonetic?: string;
  definitionEn: string;
  definitionZh: string;
  category?: string;
  exampleEn?: string;
  highlighted?: boolean;
}

export interface TranscriptChunk {
  id: string;
  timestamp: string; // e.g. "04:12"
  seconds: number;
  textEn: string;
  chineseSummary?: string;
  difficulty?: number; // 1-5
  contextBridge?: string;
  detectedTerms?: {
    term: string;
    chinese: string;
    definitionZh: string;
  }[];
  flaggedForRescue?: boolean;
}

export interface ProgressiveSummary {
  id: string;
  minuteBlock: number; // e.g. 1 for 0-5m, 2 for 5-10m
  timeRange: string; // "00:00 - 05:00"
  title: string;
  bulletPoints: string[];
  keyConcepts: string[];
  quickCatchUp: string;
}

export interface RescueRecord {
  id: string;
  timestamp: string;
  snippetText: string;
  plainChineseExplanation: string;
  sentenceDeconstruction: string;
  suggestedQuestion: string;
  analogy?: string;
  keyVocab: {
    term: string;
    chinese: string;
    explanation?: string;
  }[];
}

export interface CornellNotes {
  chineseSummary: string;
  cueQuestions: {
    questionEn: string;
    questionZh: string;
    answerZh: string;
  }[];
  detailedNotesMarkdown: string;
  flashcards: {
    front: string;
    back: string;
  }[];
  quiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explanationZh: string;
  }[];
}

export interface CoursePreset {
  id: string;
  code: string;
  title: string;
  professor: string;
  department: string;
  initialSyllabus: string;
  initialGlossary: GlossaryTerm[];
  simulatedAudioScript: {
    seconds: number;
    timestamp: string;
    textEn: string;
    chineseSummary: string;
    difficulty: number;
    detectedTerms: {
      term: string;
      chinese: string;
      definitionZh: string;
    }[];
  }[];
}
