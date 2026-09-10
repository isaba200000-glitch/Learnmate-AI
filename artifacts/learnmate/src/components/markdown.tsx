import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Lightweight, dependency-free markdown renderer for AI-generated content.
// Supports: headings, bullet/numbered lists, **bold**, `inline code`,
// fenced code blocks, GFM tables, blockquotes, horizontal rules, and emoji.
// Optimized for premium chat UI: tight spacing, primary-tinted bullets,
// monospaced code, zebra-striped tables.

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // bold, italic, inline code, autolink
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|https?:\/\/\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<Fragment key={`${keyPrefix}-t${i}`}>{text.slice(lastIndex, match.index)}</Fragment>);
      i++;
    }
    const token = match[0];
    if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i}`}
          className="rounded bg-primary/15 text-primary px-1.5 py-0.5 font-mono text-[0.85em] border border-primary/20"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("*")) {
      nodes.push(<em key={`${keyPrefix}-i${i}`} className="italic text-foreground/90">{token.slice(1, -1)}</em>);
    } else {
      nodes.push(
        <a
          key={`${keyPrefix}-l${i}`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {token}
        </a>,
      );
    }
    i++;
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-t${i}`}>{text.slice(lastIndex)}</Fragment>);
  }
  return nodes;
}

function renderTable(lines: string[], key: number): ReactNode {
  // Simple GFM table: | h1 | h2 |, |---|, | a | b |
  const splitRow = (row: string) =>
    row.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  const header = splitRow(lines[0]);
  const body: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    body.push(splitRow(lines[i]));
  }

  return (
    <div key={key} className="my-4 overflow-x-auto rounded-lg border border-border/60 bg-card/40">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border/60 bg-primary/10">
            {header.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-semibold text-foreground text-xs uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr
              key={ri}
              className={cn(
                "border-b border-border/30 last:border-0",
                ri % 2 === 1 && "bg-muted/30",
              )}
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 align-top text-foreground/90">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function extractOutline(content: string): { level: number; text: string }[] {
  const lines = content.split("\n");
  const headings: { level: number; text: string }[] = [];
  for (const line of lines) {
    const m = /^(#{2,3})\s+(.*)$/.exec(line.trim());
    if (m) headings.push({ level: m[1].length, text: m[2] });
  }
  return headings;
}

export function Markdown({ content, className }: { content: string; className?: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;
  let tableRows: string[] | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const current = list;
    const items = current.items.map((it, idx) => (
      <li key={idx} className="leading-relaxed">{renderInline(it, `li${key}-${idx}`)}</li>
    ));
    blocks.push(
      current.ordered ? (
        <ol key={key++} className="my-2.5 ml-5 list-decimal space-y-1 marker:text-primary marker:font-semibold">{items}</ol>
      ) : (
        <ul key={key++} className="my-2.5 ml-5 list-disc space-y-1 marker:text-primary">{items}</ul>
      ),
    );
    list = null;
  };

  const flushCode = () => {
    if (code === null) return;
    blocks.push(
      <pre key={key++} className="my-3 overflow-x-auto rounded-lg bg-slate-950/80 border border-white/10 p-3 text-sm">
        <code className="font-mono text-slate-100 leading-relaxed">{code.join("\n")}</code>
      </pre>,
    );
    code = null;
  };

  const flushTable = () => {
    if (!tableRows || tableRows.length < 2) {
      tableRows = null;
      return;
    }
    blocks.push(renderTable(tableRows, key++));
    tableRows = null;
  };

  for (const raw of lines) {
    if (raw.trim().startsWith("```")) {
      if (code === null) {
        flushList();
        flushTable();
        code = [];
      } else {
        flushCode();
      }
      continue;
    }
    if (code !== null) {
      code.push(raw);
      continue;
    }

    const trimmed = raw.trim();
    if (trimmed === "") {
      flushList();
      flushTable();
      continue;
    }

    // GFM table — header row, separator, then body rows.
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const nextIdx = lines.indexOf(raw) + 1;
      const nextLine = (lines[nextIdx] ?? "").trim();
      const isTable = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(nextLine);
      if (isTable) {
        if (!tableRows) {
          flushList();
          tableRows = [raw];
        } else {
          tableRows.push(raw);
        }
        continue;
      }
    }
    if (tableRows) {
      flushTable();
    }

    // Horizontal rule
    if (/^([-*_])\1{2,}$/.test(trimmed)) {
      flushList();
      blocks.push(<hr key={key++} className="my-4 border-border/40" />);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushList();
      const level = heading[1].length;
      const cls =
        level <= 1
          ? "mb-2 mt-3 text-2xl font-bold tracking-tight"
          : level === 2
            ? "mb-2 mt-4 text-lg font-bold tracking-tight border-b border-border/30 pb-1.5"
            : "mb-1.5 mt-3 text-base font-semibold text-primary";
      blocks.push(
        <p key={key++} className={cls}>
          {renderInline(heading[2], `h${key}`)}
        </p>,
      );
      continue;
    }

    // Blockquote
    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushList();
      blocks.push(
        <blockquote
          key={key++}
          className="my-3 border-l-4 border-primary/60 bg-primary/5 pl-3 pr-2 py-1.5 italic text-muted-foreground rounded-r"
        >
          {renderInline(quote[1], `q${key}`)}
        </blockquote>,
      );
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
      continue;
    }

    const numbered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (numbered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
      continue;
    }

    flushList();
    blocks.push(
      <p key={key++} className="my-2 leading-relaxed">
        {renderInline(trimmed, `p${key}`)}
      </p>,
    );
  }
  flushList();
  flushTable();
  flushCode();

  return (
    <div className={cn("text-[14.5px] text-foreground/95 w-full max-w-full break-words [overflow-wrap:anywhere] leading-relaxed", className)}>
      {blocks}
    </div>
  );
}
