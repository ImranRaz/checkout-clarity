# Checkout Clarity

Review this app idea and let me know what would you change and improve: # Product Requirements Document (PRD)

**Project:** Checkout Forensic Micro-Agent
**Target Executor:** Google Antigravity / Claude / AI Coding Assistants

## 1. Product Overview

**Objective:** Build a sleek, single-purpose SaaS micro-product that autonomously audits the conversion friction of any e-commerce checkout flow. The application must prove agentic orchestration (tool use, multi-step reasoning) and front-end polish, acting as a portfolio piece for a Director-level Product/AI leader.
**Core Narrative:** "Bad conversion isn't just UX, and it isn't just slow APIs. It's the intersection of both. This agent identifies both simultaneously."

---

## 2. Architecture & Tech Stack

* **Framework:** Next.js 14+ (App Router, Server Actions).
* **LLM Orchestration:** Vercel AI SDK (`ai` package) for unified streaming and structured object generation.
* **Model Provider:** `@openrouter/ai-sdk-provider`. This allows seamless switching between `google/gemini-2.5-flash` (extremely fast for Vision tasks), `openai/gpt-4o`, or `anthropic/claude-3.5-sonnet` without changing the core application logic.
* **Browser Engine:** Playwright Core (for local dev/GitHub execution) with an option to route through Browserless.io via API key (for Vercel deployment).
* **State Management:** React Context to handle the real-time Server-Sent Events (SSE) streaming from the Vercel AI SDK.

---

## 3. UI/UX & Design System (The "Enterprise Light Mode")

The application must project the polished, high-trust aesthetic of top-tier fintech and enterprise infrastructure platforms (e.g., Stripe, Vercel Light Mode, ClickUp Light Theme).

* **Theme:** Strict Light Mode default.
* **Backgrounds:** The primary background should be a highly crisp off-white (e.g., `#FAFAFA` or `#F4F4F5`).
* **Accent Color:** A vivid, high-contrast primary action color like Electric Indigo (`#6366F1`) or Stripe Blurple (`#635BFF`). Do not mix multiple primary colors.
* **Typography:** Clean, sans-serif variable fonts (e.g., *Inter*, *Geist*, or *SF Pro*) for standard text. Use a precise monospaced font (e.g., *Geist Mono* or *JetBrains Mono*) for technical outputs, terminal logs, and data metrics.
* **Layout Structure (Bento Grid):** The dashboard utilizes a masonry "Bento Grid". Cards should have crisp, white backgrounds (`bg-white`), incredibly subtle gray borders (`border-slate-200` or `border-zinc-200`), and soft, diffuse drop shadows (`shadow-sm` or `shadow-md` on hover) rather than heavy glassmorphism.
* **Micro-interactions (Framer Motion):**
* Hover states on buttons should introduce a slight negative Y-axis translation (`-translate-y-0.5`) and increased shadow depth.
* The "Thinking UI" terminal should resemble a clean Mac terminal window (light gray header, white background, distinct monospaced font weight).
* The transition from the "Thinking UI" to the Results Dashboard must be seamless, utilizing a staggered fade-in.



---

## 4. Core User Flow

### Phase 1: The Input & History

* **Hero Section:** A massive, minimalist input field with placeholder text: `Enter a specific Product Page URL (e.g., [target.com/p/coffee-maker](https://target.com/p/coffee-maker))...`.
* **Button:** A primary accent-colored "Run Forensic Audit" button with a Sparkle icon.
* **Below the Fold:** A horizontal, scrollable row of "Recent Audits" (mock data for the demo, e.g., "Nike.com - Score: 68").

### Phase 2: The "Thinking UI" (Crucial Trust-Building Step)

When the user submits the URL, the input field morphs into a terminal-like window. The frontend subscribes to a stream emitting the agent's internal monologue in real-time.

* `[System] Initializing Headless Agent...`
* `[Playwright] Navigating to target Product URL...`
* `[Vision AI] Scanning DOM for 'Add to Cart' coordinates...`
* `[Playwright] Action: Clicked (x: 450, y: 820). Moving to Checkout...`
* `[Playwright] Extracting network payload and console logs... Found 2 errors.`
* `[Playwright] Capturing full-viewport snapshot...`
* `[Vision AI] Running UX / Accessibility CRO analysis...`

### Phase 3: The Dashboard (Bento Grid Results)

The terminal fades out, and the Bento Grid dashboard staggers in.

* **Left Column (Large Tile):** The captured full-page screenshot. Uses a custom scrollbar to view the whole page. CSS absolute positioning is used to place glowing red "Pins" (numbered 1, 2, 3) directly on the image, corresponding to the friction points.
* **Top Right (Medium Tile):** The **Technical Health Card**. Displays Time to Interactive (TTI), total payload size, and a list of console errors (e.g., "Blocked Resource: tracking.js").
* **Bottom Right (Medium Tile):** The **UX / CRO Insights Card**. A numbered list mapping to the pins on the image. (e.g., "1. Contrast ratio on 'Continue as Guest' fails WCAG standards.")

---

## 5. Agentic Workflow Details (The Engine)

The backend agent must execute the following sequential tool calls without breaking the loop:

1. **`Tool_Navigate_And_Snapshot`:** Opens Playwright, loads the user-provided Product URL, waits for network idle, and takes a viewport screenshot.
2. **`Tool_Locate_Cart_Button`:** Sends the screenshot to the Vision LLM with the prompt: *"You are an automation script. Identify the primary 'Add to Cart' button. Return ONLY the approximate X, Y coordinates in JSON."*
3. **`Tool_Advance_To_Checkout`:** Playwright clicks the provided coordinates, waits for the subsequent page load (the cart or initial checkout step), and extracts `window.performance.timing` metrics and console logs.
4. **`Tool_Final_Audit`:** Playwright takes the final, full-page screenshot of the checkout screen.
5. **`Tool_Synthesize`:** Passes the final screenshot and technical logs to the Vision LLM (e.g., Gemini via OpenRouter) to generate the final dashboard JSON.

---

## 6. Strict Data Schema (JSON Output)

To ensure the Next.js frontend renders reliably, the final LLM call must output strict JSON matching this interface using the Vercel AI SDK:

```typescript
interface ForensicAuditReport {
  overall_score: number; // 0-100
  screenshot_url: string; // Path to the temporarily saved image
  technical_metrics: {
    time_to_interactive_ms: number;
    console_errors: string[];
    network_bottlenecks: string[];
  };
  ux_friction_points: Array<{
    id: number;
    x_coordinate_percentage: number; // For placing the pin on the UI relative to the image
    y_coordinate_percentage: number;
    severity: "High" | "Medium" | "Low";
    title: string;
    description: string;
  }>;
}

```

---

## 7. Implementation Directives for the AI Assistant

1. **Vercel AI SDK Integration:** Utilize the `generateObject` or `streamObject` functions from the `ai` package to enforce the `ForensicAuditReport` JSON schema.
2. **Provider Setup:** Configure the AI SDK to use the OpenRouter provider. Example implementation pattern:
```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Configurable model routing
const model = openrouter('google/gemini-2.5-flash'); 

```


3. **Mock First, Connect Later:** Build the UI using a hardcoded `ForensicAuditReport` JSON object first. Ensure the Bento Grid, light mode styling, and Tailwind shadows perfectly match the enterprise standard before attempting to hook up Playwright or the LLM endpoints.
4. **Playwright Configuration:** Create a separate utility file (`lib/playwright-agent.ts`) that can toggle between a local browser instance and a WebSocket connection to Browserless.io via environment variables (`NEXT_PUBLIC_USE_BROWSERLESS`).

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4abd7517-d555-471c-9133-3f63dd37e68d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
