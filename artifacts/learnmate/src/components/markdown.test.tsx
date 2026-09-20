/**
 * Markdown renderer — AI-content cleanup.
 *
 * This renderer deliberately never uses dangerouslySetInnerHTML, so any raw
 * HTML an AI model slips into its markdown used to be printed on screen as
 * literal text ("Line one<br>Line two", "Rise &amp; shine"). These tests lock
 * in the cleanup and, just as importantly, that fenced code blocks are left
 * untouched.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Markdown } from "./markdown";

afterEach(cleanup);

function renderMd(content: string) {
  render(
    <div data-testid="md">
      <Markdown content={content} />
    </div>,
  );
  return screen.getByTestId("md");
}

describe("Markdown — stray HTML from AI output", () => {
  it("turns <br> variants into real line breaks instead of visible text", () => {
    const el = renderMd("Line one<br>Line two<br/>Line three<br />Line four");
    expect(el.textContent).not.toContain("<br");
    for (const part of ["Line one", "Line two", "Line three", "Line four"]) {
      expect(el.textContent).toContain(part);
    }
  });

  it("strips block and inline tags without eating their text", () => {
    const el = renderMd("<p>Kinetic energy</p><div>is <b>½mv²</b></div>");
    expect(el.textContent).not.toMatch(/<\/?(p|div|b)>/);
    expect(el.textContent).toContain("Kinetic energy");
    expect(el.textContent).toContain("is");
    expect(el.textContent).toContain("½mv²");
  });

  it("renders <b>/<strong> as real bold rather than literal tags", () => {
    renderMd("Remember <b>Newton's third law</b> here");
    expect(screen.getByText("Newton's third law").tagName).toBe("STRONG");
  });

  it("converts <li> items into a list", () => {
    const el = renderMd("<ul><li>Photosynthesis</li><li>Respiration</li></ul>");
    expect(el.textContent).not.toContain("<li>");
    expect(el.querySelectorAll("li").length).toBe(2);
  });
});

describe("Markdown — HTML entities from AI output", () => {
  it("decodes the common named entities", () => {
    const el = renderMd("Rise &amp; shine &mdash; 5 &lt; 10 &gt; 3 &quot;go&quot;");
    expect(el.textContent).toContain("Rise & shine — 5 < 10 > 3 \"go\"");
    expect(el.textContent).not.toContain("&amp;");
    expect(el.textContent).not.toContain("&lt;");
  });

  it("decodes numeric and hex entities", () => {
    const el = renderMd("Caf&#233; &#x2014; 40&#176;C");
    expect(el.textContent).toContain("Café — 40°C");
  });

  it("leaves unknown entities alone rather than mangling them", () => {
    const el = renderMd("Chemical &notarealentity; formula");
    expect(el.textContent).toContain("&notarealentity;");
  });
});

describe("Markdown — code blocks are protected", () => {
  it("keeps HTML inside fenced code exactly as written", () => {
    const el = renderMd("Example:\n\n```html\n<br> and <p>hi</p> &amp; more\n```\n");
    const code = el.querySelector("pre code");
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe("<br> and <p>hi</p> &amp; more");
  });

  it("still cleans prose that surrounds a code block", () => {
    const el = renderMd("Before<br>text\n\n```\n<br>\n```\n\nAfter &amp; done");
    expect(el.querySelector("pre code")?.textContent).toBe("<br>");
    expect(el.textContent).toContain("After & done");
  });
});

describe("Markdown — ordinary markdown still works", () => {
  it("renders headings, bold, inline code and lists", () => {
    const el = renderMd("## Title\n\n- **bold** item\n- `code` item\n");
    expect(screen.getByText("Title").tagName).toMatch(/^H[23]$/);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(el.querySelectorAll("li").length).toBe(2);
  });

  it("does not mistake a less-than comparison for a tag", () => {
    const el = renderMd("If x < 5 and y > 2 then done");
    expect(el.textContent).toContain("If x < 5 and y > 2 then done");
  });
});
