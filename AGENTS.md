# AGENTS.md

Guidelines for coding agents contributing to this GitHub Pages repo.

The goal: write **pragmatic, readable code** that works well in a **static site** context, without overengineering.

---

## 1. General Principles

- Prefer **simple, static solutions** that work with GitHub Pages:
  - Plain HTML/CSS/JS
  - Light use of CDN-hosted libraries
  - No heavy build systems unless explicitly requested
- Assume the author is a **strong programmer** but only “OK” with JavaScript and frontend tooling.
- Code should be **easy to read and reason about**:
  - Clear structure
  - Minimal magic
  - Good naming

---

## 2. Architecture & Structure

- Keep the overall structure **minimal but sane**:
  - A small number of HTML files
  - Optional `main.js` / `style.css` or similar for separation of concerns
- Avoid unnecessary layers or abstractions.
- If you think a **larger refactor** or new structure is needed:
  - Write a short **proposal** (what/why/how)
  - **Wait for explicit approval** before proceeding

---

## 3. Coding Style

### 3.1 JavaScript

- Use **modern but straightforward** JS:
  - `const` / `let`, arrow functions where appropriate
  - Avoid clever one-liners and obscure patterns
- Prefer **explicit, descriptive names**:
  - `updateLayout()`, `renderGraph()`, `setupInteractions()`
- Keep functions **small and focused**.
- Only introduce helpers/abstractions once they clearly reduce repetition or complexity.

### 3.2 HTML & CSS

- Keep markup **semantic and simple** where possible.
- Use CSS for styling; avoid inline styles except for tiny, self-explanatory cases.
- Don’t overuse CSS frameworks; only add dependencies when they clearly improve productivity or clarity.

---

## 4. Readability & Comments

- Code should be understandable by someone who:
  - Knows programming well
  - Isn’t deeply familiar with JS or browser quirks
- Comment **why**, not **what**:
  - Explain non-obvious logic
  - Explain design decisions or constraints (e.g. GitHub Pages limitations)
- Don’t comment trivial operations or obvious code.

---

## 5. Communication Style

The agent’s written communication (PR descriptions, explanations, answers) should be:

- **Concise but crystal clear**.
- Focused on:
  - What changed
  - Why it changed
  - How to use/test it
- Direct and honest:
  - If a proposed idea is a bad trade-off, say so clearly and briefly.
    - Example: “This would add a lot of complexity for little benefit. I recommend X instead because Y.”
  - If requirements are unclear or contradictory, point it out and ask targeted questions.

When unsure:

- If you truly **cannot proceed safely**, ask for clarification.
- Otherwise, make a **reasonable, explicit assumption** and move forward, noting it in comments or the PR:
  - “Assumption: for now, we only support a single page using this component.”

---

## 6. Limiting Scope & Complexity

- Always aim to **minimize the amount of code added**:
  - Prefer small, focused changes.
  - Avoid adding large dependencies unless clearly needed.
- If you notice that solving a problem “properly” requires a significant redesign:
  - Stop, prepare a short **design note**:
    - Current state
    - Proposed approach
    - Pros/cons
  - Ask for authorisation before implementing.

---

## 7. PR / Change Documentation

Each meaningful change should include:

1. **Summary**
   - 2–5 bullet points of what was done.
2. **Why**
   - Short explanation of the design choice.
3. **How to use / test**
   - Simple steps to verify the change (e.g. “Open `index.html` in a browser, click X, expect Y”).

Example:

> **Summary**
> - Extracted common layout JS into `main.js`.
> - Added basic navigation styling and hover states.
>
> **Why**
> - Reduces duplication across pages and makes layout behavior easier to maintain.
>
> **How to test**
> - Open `index.html` on GitHub Pages.
> - Check that navigation links highlight on hover and that layout still behaves as before.

---

If in doubt: **keep it simple, explicit, and readable.** The code will be read and maintained, not just executed.
