# Nexus Research Mode

Research Mode turns the Nexus AI chat window into a deep-research engine. Instead of a back-and-forth conversation, you give it a topic and it autonomously runs multiple AI calls to produce a comprehensive, structured research report — then opens it as a new document tab ready to read, edit, and save.

---

## Table of Contents

- [Nexus Research Mode](#nexus-research-mode)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
  - [How It Works](#how-it-works)
    - [Phase 1 — Topic Analysis](#phase-1--topic-analysis)
    - [Phase 2 — Main Research Report](#phase-2--main-research-report)
    - [Phase 3 — Deep Dive Expansion](#phase-3--deep-dive-expansion)
    - [Phase 4 — Filename Generation](#phase-4--filename-generation)
  - [Progress Stepper UI](#progress-stepper-ui)
  - [The Output Document](#the-output-document)
    - [Report Structure](#report-structure)
  - [Canceling a Research Request](#canceling-a-research-request)
  - [Supported Providers](#supported-providers)

---

## Getting Started

1. Open the Nexus panel (`Ctrl+Shift+A` or click the Nexus icon in the toolbar)
2. Select **Research** from the mode dropdown at the top of the panel
3. The send button turns blue and shows a telescope icon, and the input placeholder changes to *"Enter a research topic..."*
4. Type your topic — be as specific or as broad as you like — and press **Enter**

That's it. Nexus takes over from there. You don't need to ask follow-up questions or guide the process — it runs all phases automatically.

---

## How It Works

Research mode makes **up to 6 sequential AI calls** behind the scenes, split across four phases. Each phase feeds into the next.

### Phase 1 — Topic Analysis

Before writing a single word of research, Nexus makes a quick preliminary call to analyze your topic and infer:

- **Target audience** — who this report is for (e.g., *"mid-level engineers building AI apps"*)
- **Relevant fields** — the disciplines involved (e.g., *technology, databases, software engineering*)
- **Focus areas** — the key angles worth exploring
- **Deep dive topics** — 4–6 specific technical concepts to expand on in depth later

This inference shapes everything that follows — the tone, depth, and structure of the report are all tailored to what was inferred. If inference fails for any reason, sensible defaults kick in automatically so the research continues uninterrupted.

### Phase 2 — Main Research Report

The inferred metadata from Phase 1 is injected into a detailed research prompt. The AI is asked to produce a full structured report covering:

- Executive summary
- Historical evolution and context
- Current state of the landscape
- Key debates, trade-offs, and risks
- Engineering and implementation guide with code examples
- Future projections
- Actionable recommendations
- Sources and confidence ratings

### Phase 3 — Deep Dive Expansion

After the main report is written, Nexus automatically makes additional calls to expand the technical deep dive topics inferred in Phase 1:

- Deep dive topics are processed in **batches of 2** per call
- Up to **3 deepening calls** run (covering up to 6 topics)
- Each call adds exhaustive coverage: internals, production-ready code examples, common pitfalls, best practices, and the latest updates for that topic
- If no deep dive topics were inferred, this phase is skipped entirely

**Graceful degradation:** if any deepening call fails, the base report plus any successful batches are still used. A single failed batch never kills the whole research run.

The base report and all deepening results are concatenated with a `---` separator into a single final document.

### Phase 4 — Filename Generation

Once the content is fully assembled, a final lightweight call generates a descriptive filename for the new tab. The AI returns a short Title Case name (max 50 characters, no extension) which is sanitized and used as the tab name.

**Fallback:** if naming fails, the tab is named `Research - <topic snippet>.md`.

---

## Progress Stepper UI

While research is running, the Nexus panel replaces the normal message area with a **vertical progress stepper** showing all four phases in real time:

```
● Analyzing Topic                    ✓ 2.1s
  "Identifying key research angles..."
  ┌──────────────────────────────────┐
  │ Audience: mid-level engineers    │
  │ Fields: React, TypeScript        │
  │ Topics: useEffect, useMemo ...   │
  └──────────────────────────────────┘

◉ Compiling Research Report          ⟳ active
  "Synthesizing findings..."

○ Expanding Depth (0/3)              pending

○ Generating Filename                pending
```

Each phase has three visual states:

| Indicator | Meaning |
| --------- | ------- |
| Grey dot | Not yet started |
| Pulsing blue dot | Currently running — shows a typewriter-animated status message with a blinking cursor |
| Green checkmark | Complete — shows how long the phase took (e.g., *"2.1s"*) |

Once Phase 1 completes, a **metadata card** appears beneath it showing the inferred audience, fields (as chips), and deep dive topics (as blue chips) so you can see what the AI decided to focus on.

The Expanding Depth phase shows a live progress counter — *(1/3)*, *(2/3)*, *(3/3)* — as each batch finishes.

---

## The Output Document

When all phases complete, the report opens automatically as a **new tab** in the editor:

- Opens in **preview mode** so you can read it immediately
- The tab name is the AI-generated descriptive title (e.g., `React Server Components Deep Dive.md`)
- The file is **virtual** — it exists in memory but is not saved to disk yet
- Save it with `Ctrl+S` or **File → Save As** to write it to disk

### Report Structure

Every research report follows the same standardized format:

1. **Executive Summary** — 4–6 bullet point takeaways
2. **Historical Evolution** — timeline of key milestones
3. **Current State** — landscape overview, major players, metrics
4. **Key Debates & Risks** — trade-offs and controversies
5. **Engineering & Implementation Guide** — code examples, architecture patterns, tooling, and dedicated subsections for each inferred deep dive topic
6. **Future Horizons** — projections through 2026–2030
7. **Actionable Playbook** — concrete experiments and recommendations
8. **Sources & Rigor** — references and a confidence matrix
9. **Extended Technical Deep Dive** *(appended)* — exhaustive per-topic coverage from the deepening calls, with production-ready code, pitfalls, and comparative analysis

---

## The Prompt Chain

Below are the exact prompt templates sent to the AI for each phase. Placeholder tokens (`{TOPIC}`, `{AUDIENCE}`, etc.) are replaced with the inferred values before the call is made.

---

### Phase 1 Prompt — Topic Analysis

Sent as a single user message. The same topic string is used for both `{TOPIC}` and `{USER_INTENT}`. `{DEPTH_LABEL}` is one of `Beginner`, `Practitioner`, or `Expert`.

```
Analyze this research topic and respond with JSON only. No other text.

Topic: "{TOPIC}"
User Intent: "{USER_INTENT}"
Target depth level: {DEPTH_LABEL}

Tailor the audience and deep dive topics to the depth level:
- Beginner: audience is newcomers; suggest foundational and conceptual topics
- Practitioner: audience is working engineers; suggest practical patterns and common challenges
- Expert: audience is senior engineers or architects; suggest internals, edge cases, and production concerns

{
  "audience": "<inferred target audience for {DEPTH_LABEL} level, e.g. 'mid-level software engineers building AI apps'>",
  "fields": ["<field1>", "<field2>", "<field3>"],
  "focusAreas": "<2-3 key angles to explore at {DEPTH_LABEL} level, comma separated>",
  "deepDiveTopics": ["<list 4-6 technical concepts suited to {DEPTH_LABEL} level>"]
}
```

**Fallback defaults** (used if the response can't be parsed):

```json
{
  "audience": "general practitioners and engineers",
  "fields": ["technology", "science"],
  "focusAreas": "broad overview with practical insights",
  "deepDiveTopics": []
}
```

---

### Phase 2 Prompt — Main Research Report

Sent as a single user message. `{FIELDS}`, `{AUDIENCE}`, `{FOCUS_AREAS}`, and `{DEEP_DIVE_TOPICS}` are filled in from the Phase 1 inference result (or the fallback defaults). `{DEPTH_LABEL}` and `{DEPTH_INSTRUCTIONS}` are injected from the selected depth level (see below).

```
You are an elite, multidisciplinary research strategist and synthesizer, with expertise across {FIELDS}. Your mission: Deliver the deepest, most balanced, and actionable research report on the topic: "{TOPIC}".

**Audience depth level: {DEPTH_LABEL}**
{DEPTH_INSTRUCTIONS}

**Core Principles (Follow Strictly):**
- **Depth First**: Go beyond surface-level. Uncover historical roots, current realities, key players/innovators, data/evidence, debates, biases, blind spots, and forward-looking implications.
- **Technical Mastery**: For any engineering, coding, or implementation aspects, provide concrete, executable insights. Include architectures, code snippets (in relevant languages like Python, JavaScript, Rust), pseudocode, step-by-step guides, tools/libraries, real-world case studies, and validation methods. Explain "how to do it" with clarity appropriate for the depth level above.
- **Truth-Seeking**: Synthesize from diverse, credible perspectives. Cross-verify claims. Highlight contradictions, uncertainties, and evolving consensus. Prioritize primary sources over summaries.
- **Strategic Value**: Tailor insights for {AUDIENCE}. Connect dots to risks, opportunities, and decisions.
- **Capability Optimization**: Assess your tools and knowledge (e.g., web search, page browsing, code execution, real-time feeds). Use them iteratively to gather fresh, specific data. If limited, simulate depth via reasoned extrapolation from known facts.

**Focus Areas**: {FOCUS_AREAS}
**Deep Dive Topics**: {DEEP_DIVE_TOPICS}

**Step-by-Step Research Protocol (Execute Internally Before Output):**
1. **Scope & Brainstorm**: Define 5-7 core angles (e.g., tech, policy, economics, engineering). Generate targeted queries for any search/browse tools.
2. **Gather Evidence**:
   - Run 4-6 broad-to-specific searches (e.g., "{TOPIC} 2024-2026 site:edu OR site:gov OR site:org OR site:github.com").
   - Dive into 6-10 key sources: Extract stats, quotes, methodologies, counterpoints, and technical artifacts (e.g., code repos, arXiv implementations).
   - Check real-time signals: Recent discussions, expert takes, breaking news, open-source updates.
   - **Technical Deep Dive**: Identify engineering patterns, code examples, and blueprints. Browse GitHub repos, papers, or docs for implementations. Use code tools to test/validate snippets if possible. **Prioritize deep analysis of {DEEP_DIVE_TOPICS} with internals, pitfalls, latest updates, and reactive behaviors.**
3. **Synthesize & Critique**: Map patterns, resolve conflicts, rate source reliability (e.g., peer-reviewed = high). Quantify confidence (High/Med/Low) for claims, especially technical ones.
4. **Forecast & Apply**: Project 1-5 year scenarios. Derive 4-6 actionable insights, including implementation roadmaps.

**Output Format (Markdown, Scannable, 1500-3500 Words):**
- **Opening section (250 words)**: Use a compelling, topic-specific heading (NOT "Executive Summary" — instead derive a heading from the topic, e.g., "The State of Quantum Computing in 2026" or "Why Dark Energy Changes Everything"). Include 4-6 bullet takeaways + "Why this matters NOW for {AUDIENCE}".
- **Historical Evolution**: Timeline of milestones, paradigm shifts.
- **Current State**: Landscape, leaders, metrics, adoption stats.
- **Key Debates & Risks**: Pros/cons, stakeholder views, controversies.
- **Engineering & Implementation Guide**:
  - Core architectures and system designs (with diagrams described in text).
  - Dedicated subsections for {DEEP_DIVE_TOPICS} — provide internals, mechanics, lifecycle details, dependency management, async patterns, common pitfalls, and code examples for each (complexity scaled to the depth level). Use the topic name directly as the subsection heading (e.g., "### useEffect" not "### Deep Dive: useEffect").
  - Step-by-step "how-to" implementations, including code examples (e.g., full functions, setup scripts) with inline explanations.
  - Recommended tools, libraries, frameworks, and deployment strategies.
  - Common pitfalls, optimizations, and debugging tips.
  - Real-world case studies or reproducible examples.
- **Future Horizons**: Scenarios, wildcards, 2026-2030 projections.
- **Actionable Playbook**: Recommendations, experiments, watchlists, open questions.
- **Sources & Rigor**: Top 10-15 references (links where possible), methodology notes, confidence matrix, gaps/limitations.

Be objective yet engaging. If data is thin, admit it and hypothesize based on patterns. Start directly with the summary.
```

**`{DEPTH_INSTRUCTIONS}` values by level:**

| Level | Injected text |
|---|---|
| Beginner | `Write for someone new to this topic. Prioritize clear explanations over jargon. Define technical terms when introduced. Use simple, well-commented code examples. Focus on "what it is" and "why it matters" before "how it works". Avoid assuming prior knowledge.` |
| Practitioner | `Write for someone who actively works with this technology. Focus on practical patterns, real-world usage, and working code. Include common pitfalls and how to avoid them. Assume familiarity with fundamentals but explain non-obvious behaviors.` |
| Expert | `Write for a deep technical expert. Prioritize internals, implementation trade-offs, edge cases, and production-scale concerns. Include advanced code patterns, performance considerations, and architectural decisions. Skip introductory explanations.` |

---

### Phase 3 Prompt — Deep Dive Expansion

One prompt is sent per batch of 2 topics. `{BATCH_TOPICS}` is replaced with the comma-separated topic names for that batch (e.g., `useEffect, useMemo`). `{DEPTH_LABEL}` and `{DEPTH_INSTRUCTIONS}` are injected the same way as in Phase 2.

```
You previously wrote a research report on "{TOPIC}". The report is good but needs more depth in specific areas.

**Audience depth level: {DEPTH_LABEL}**
{DEPTH_INSTRUCTIONS}

Please write an **addendum** that provides an exhaustive deep dive into these specific topics: {BATCH_TOPICS}

For each topic, provide:
1. **Detailed explanation** with internals, mechanics, and how it works under the hood (scaled to depth level)
2. **Code examples** with inline comments explaining each step (complexity scaled to depth level)
3. **Common pitfalls and edge cases** with solutions
4. **Best practices and anti-patterns** with before/after comparisons
5. **2025-2026 updates** — latest changes, deprecations, or new approaches

Format as markdown that can be appended directly to the original report. Use ## headings for each topic. Target 800-1500 words.
```

Each deepening response is appended to the final document separated by `---`. Up to 3 batches run, covering up to 6 total topics.

---

### Phase 4 Prompt — Filename Generation

Sent as a single user message. The response is stripped of quotes, extensions, and invalid filename characters, then truncated to 60 characters.

```
Generate a short, descriptive filename for a research report about: "{TOPIC}"

Rules:
- Return ONLY the filename, nothing else
- No file extension
- Max 50 characters
- Use Title Case with spaces (e.g. "React Hooks Deep Dive")
- Be specific and descriptive
```

**Fallback:** if the response is empty or the call fails, the filename becomes `Research - <first 40 chars of topic>....md`.

---

## Canceling a Research Request

Click the **Cancel** button at any point during research. All in-flight API calls across every phase are aborted immediately. Whatever content had been generated up to that point is discarded.

---

## Supported Providers

| Provider | Supported |
| -------- | --------- |
| Claude (Anthropic) | Yes |
| OpenAI | Yes |
| Google Gemini | Yes |
| xAI (Grok) | Yes |

Research mode is supported by all four providers. The depth level selector applies equally regardless of which provider is active.
