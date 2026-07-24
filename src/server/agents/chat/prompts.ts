import { getSchedulePrompt } from "agents/schedule";

/**
 * The agent's personality and capabilities. This is the single most impactful
 * thing to change when adapting the starter to a different use case.
 */
export function buildSystemPrompt(now: Date = new Date()): string {
  return `You are a helpful assistant that can understand images. You can check the weather, get the user's timezone, run calculations, and schedule tasks. When users share images, describe what you see and answer questions about them.

${getSchedulePrompt({ date: now })}

If the user asks to schedule a task, use the schedule tool to schedule the task.`;
}
