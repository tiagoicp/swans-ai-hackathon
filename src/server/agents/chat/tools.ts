import { createQuickActionTools } from "agents/browser/ai";
import { scheduleSchema } from "agents/schedule";
import { tool } from "ai";
import { z } from "zod";
import { CLIENT_TOOL_TIMEZONE } from "@shared";
import type { ChatAgent } from "./agent";

// ── Stateless tools ───────────────────────────────────────────────────
// These need nothing from the agent, so they are built once per isolate.

// Server-side tool: runs automatically on the server
const getWeather = tool({
  description: "Get the current weather for a city",
  inputSchema: z.object({
    city: z.string().describe("City name")
  }),
  execute: async ({ city }) => {
    // Replace with a real weather API in production
    const conditions = ["sunny", "cloudy", "rainy", "snowy"];
    const temp = Math.floor(Math.random() * 30) + 5;
    return {
      city,
      temperature: temp,
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      unit: "celsius"
    };
  }
});

// Client-side tool: no execute function — the browser handles it
const getUserTimezone = tool({
  description:
    "Get the user's timezone from their browser. Use this when you need to know the user's local time.",
  inputSchema: z.object({})
});

// Approval tool: requires user confirmation before executing
const calculate = tool({
  description:
    "Perform a math calculation with two numbers. Requires user approval for large numbers.",
  inputSchema: z.object({
    a: z.number().describe("First number"),
    b: z.number().describe("Second number"),
    operator: z.enum(["+", "-", "*", "/", "%"]).describe("Arithmetic operator")
  }),
  needsApproval: async ({ a, b }) => Math.abs(a) > 1000 || Math.abs(b) > 1000,
  execute: async ({ a, b, operator }) => {
    const ops: Record<string, (x: number, y: number) => number> = {
      "+": (x, y) => x + y,
      "-": (x, y) => x - y,
      "*": (x, y) => x * y,
      "/": (x, y) => x / y,
      "%": (x, y) => x % y
    };
    if ((operator === "/" || operator === "%") && b === 0) {
      return {
        error: operator === "/" ? "Division by zero" : "Modulo by zero"
      };
    }
    return {
      expression: `${a} ${operator} ${b}`,
      result: ops[operator](a, b)
    };
  }
});

// ── Tool set ──────────────────────────────────────────────────────────

/**
 * Builds the agent's tools. The scheduling tools need the agent instance for
 * its schedule storage, and the browser tools need the BROWSER binding — which
 * lives on the agent's protected `env`, so it is passed in explicitly. The whole
 * set is produced per call.
 */
export function createTools(agent: ChatAgent, env: Env) {
  return {
    getWeather,
    [CLIENT_TOOL_TIMEZONE]: getUserTimezone,
    calculate,

    // Browser Rendering Quick Actions: browser_markdown, browser_extract,
    // browser_links, browser_scrape (the default 4-tool set).
    ...createQuickActionTools({ browser: env.BROWSER }),

    scheduleTask: tool({
      description:
        "Schedule a task to be executed at a later time. Use this when the user asks to be reminded or wants something done later.",
      inputSchema: scheduleSchema,
      execute: async ({ when, description }) => {
        if (when.type === "no-schedule") {
          return "Not a valid schedule input";
        }
        const input =
          when.type === "scheduled"
            ? when.date
            : when.type === "delayed"
              ? when.delayInSeconds
              : when.type === "cron"
                ? when.cron
                : null;
        if (!input) return "Invalid schedule type";
        try {
          await agent.schedule(input, "executeTask", description, {
            idempotent: true
          });
          return `Task scheduled: "${description}" (${when.type}: ${input})`;
        } catch (error) {
          return `Error scheduling task: ${error}`;
        }
      }
    }),

    getScheduledTasks: tool({
      description: "List all tasks that have been scheduled",
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = await agent.listSchedules();
        return tasks.length > 0 ? tasks : "No scheduled tasks found.";
      }
    }),

    cancelScheduledTask: tool({
      description: "Cancel a scheduled task by its ID",
      inputSchema: z.object({
        taskId: z.string().describe("The ID of the task to cancel")
      }),
      execute: async ({ taskId }) => {
        try {
          await agent.cancelSchedule(taskId);
          return `Task ${taskId} cancelled.`;
        } catch (error) {
          return `Error cancelling task: ${error}`;
        }
      }
    })
  };
}
