import type { CoursePreset, LectureSession } from "../types";

export const downloadTextFile = (name: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const sessionToMarkdown = (session: LectureSession, course: CoursePreset) => `# ${course.code}: ${course.title}

- 课堂时间：${new Date(session.createdAt).toLocaleString()}
- 教授：${course.professor}
- 院系：${course.department}

## 术语库

${session.glossary.map((term) => `- **${term.term}**：${term.chinese} — ${term.definitionZh}`).join("\n") || "暂无"}

## 课堂转录

${session.transcripts.map((item) => `### ${item.timestamp}\n\n${item.textEn}\n\n> ${item.chineseSummary || ""}`).join("\n\n") || "暂无"}

## 阶段小结

${session.progressiveSummaries.map((item) => `### ${item.timeRange} ${item.title}\n\n${item.bulletPoints.map((point) => `- ${point}`).join("\n")}\n\n${item.quickCatchUp}`).join("\n\n") || "暂无"}

## 救生圈

${session.rescueRecords.map((item) => `### ${item.timestamp}\n\n原文：${item.snippetText}\n\n解释：${item.plainChineseExplanation}\n\n句子拆解：${item.sentenceDeconstruction}\n\n建议提问：${item.suggestedQuestion}`).join("\n\n") || "暂无"}

## 康奈尔笔记

${session.cornellNotes ? `${session.cornellNotes.chineseSummary}\n\n${session.cornellNotes.detailedNotesMarkdown}` : "暂无"}
`;

export const parseImportedSession = (value: unknown): LectureSession => {
  if (!value || typeof value !== "object") throw new Error("JSON 文件内容无效。");
  const session = value as Partial<LectureSession>;
  if (!session.id || !session.courseId || !session.createdAt) throw new Error("JSON 缺少课堂会话字段。");
  return {
    id: String(session.id),
    courseId: String(session.courseId),
    createdAt: String(session.createdAt),
    updatedAt: new Date().toISOString(),
    glossary: Array.isArray(session.glossary) ? session.glossary : [],
    transcripts: Array.isArray(session.transcripts) ? session.transcripts : [],
    progressiveSummaries: Array.isArray(session.progressiveSummaries) ? session.progressiveSummaries : [],
    rescueRecords: Array.isArray(session.rescueRecords) ? session.rescueRecords : [],
    cornellNotes: session.cornellNotes || null,
  };
};
