---
description: How to document progress, roles, and tutorials at the end of a work phase.
---

This workflow defines the standard operating procedure for documenting the hackathon's progress at the end of every completed phase.

## Model Switching Policy

> **⚠️ IMPORTANT: To save tokens, use the right model for the right job.**
>
> - **Planning / Architecture / Debugging**: Use an advanced model (e.g., Claude Opus, Gemini Pro Thinking). Switch BEFORE starting a planning phase.
> - **Implementation / Code Writing / File Editing**: Use a fast model (e.g., Gemini Flash, Claude Sonnet). Switch AFTER the plan is approved and BEFORE writing code.
>
> **Prompt the user to switch models** at these transition points:
> 1. At the START of a new phase → "Switch to an advanced model for planning."
> 2. AFTER the plan is approved → "Switch to a fast model for implementation."
> 3. When hitting a bug that requires deep reasoning → "Switch to an advanced model for debugging."

---

## Documentation Checklist

When a phase completes, you must update the following four tracking documents:

1. **`log.md`**:
   - Append a new section under the header `## Completed in [Phase Name]`.
   - For every major task accomplished, create a bullet point.
   - For each bullet point, strictly include:
     - **What I did**: High-level summary of the task.
     - **How I did it**: Technical explanation (files created, libraries used).
     - **What it's for**: The business value or architectural purpose of the task.
   - Update the "Context for Teammates (Next Actions)" section.

2. **`phase.md`**:
   - Update the overarching project plan if any timelines, architecture decisions, or sidequests were successfully altered during the phase.

3. **`tutorial_phase[number].md`**:
   - Write a step-by-step "ChatGPT-style" tutorial for the code that was just written.
   - Explain the core concepts (e.g., SQLite ingestion, LangChain text chunking, Next.js routing) as if you are teaching an absolute beginner how to implement what you just built.
   - Provide minimal, clean code snippets of the actual implementation.

4. **`work_distribution.md`**:
   - Review the roles assigned to "Winston", "Sujoy", and "Kiko".
   - If the previous phase shifted the responsibilities or uncovered new tasks, ensure this document is updated so each AI agent acting on behalf of these members receives the correct context.

**// turbo-all**
```bash
git add log.md phase.md tutorial_phase*.md work_distribution.md
git commit -m "chore: execute document_progress workflow for current phase"
git push origin main
```
