// Tiny markdown renderer tailored to the syntax our newsletter generator emits:
// headings (#, ##, ###), paragraphs, ordered/unordered lists, **bold**, _italic_,
// horizontal rules, and pipe tables. No external deps.

import React from "react";

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: handle **bold**, then _italic_.
  const re = /(\*\*([^*]+)\*\*|_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) != null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2]) nodes.push(<strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">{m[2]}</strong>);
    else if (m[3]) nodes.push(<em key={`${keyPrefix}-i-${i}`} className="italic">{m[3]}</em>);
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

interface Block {
  type: "h1" | "h2" | "h3" | "p" | "ul" | "hr" | "table";
  text?: string;
  items?: string[];
  rows?: string[][];
  align?: ("left" | "right" | "center")[];
}

function parseAlign(sep: string): "left" | "right" | "center" {
  const s = sep.trim();
  const left = s.startsWith(":");
  const right = s.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  return "left";
}

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") { i++; continue; }
    if (line.startsWith("# ")) { blocks.push({ type: "h1", text: line.slice(2).trim() }); i++; continue; }
    if (line.startsWith("## ")) { blocks.push({ type: "h2", text: line.slice(3).trim() }); i++; continue; }
    if (line.startsWith("### ")) { blocks.push({ type: "h3", text: line.slice(4).trim() }); i++; continue; }
    if (line.trim() === "---") { blocks.push({ type: "hr" }); i++; continue; }
    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2).trim());
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (line.trim().startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|")) {
      const header = splitRow(line);
      const sep = splitRow(lines[i + 1]);
      const align = sep.map(parseAlign);
      i += 2;
      const rows: string[][] = [header];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", rows, align });
      continue;
    }
    // Paragraph — collect contiguous non-blank lines
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== "" && !lines[i].startsWith("#") && !lines[i].startsWith("- ") && !lines[i].trim().startsWith("|") && lines[i].trim() !== "---") {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "p", text: paraLines.join(" ").trim() });
  }
  return blocks;
}

function splitRow(line: string): string[] {
  const t = line.trim();
  const inner = t.startsWith("|") ? t.slice(1) : t;
  const stripped = inner.endsWith("|") ? inner.slice(0, -1) : inner;
  return stripped.split("|").map((c) => c.trim());
}

export default function MarkdownView({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="space-y-3">
      {blocks.map((b, idx) => {
        const k = `b-${idx}`;
        switch (b.type) {
          case "h1":
            return <h1 key={k} className="text-2xl font-bold tracking-tight">{renderInline(b.text ?? "", k)}</h1>;
          case "h2":
            return <h2 key={k} className="text-xl font-semibold tracking-tight mt-6 mb-1">{renderInline(b.text ?? "", k)}</h2>;
          case "h3":
            return <h3 key={k} className="text-base font-semibold mt-4 mb-1">{renderInline(b.text ?? "", k)}</h3>;
          case "hr":
            return <hr key={k} className="border-muted/30 my-4" />;
          case "ul":
            return (
              <ul key={k} className="list-disc pl-5 space-y-1 text-sm leading-relaxed">
                {(b.items ?? []).map((it, j) => (
                  <li key={`${k}-li-${j}`}>{renderInline(it, `${k}-li-${j}`)}</li>
                ))}
              </ul>
            );
          case "table": {
            const rows = b.rows ?? [];
            const [head, ...body] = rows;
            const align = b.align ?? [];
            const alignClass = (i: number) => {
              const a = align[i] ?? "left";
              return a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";
            };
            return (
              <div key={k} className="overflow-x-auto -mx-1">
                <table className="w-full text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-muted/40">
                      {head.map((cell, i) => (
                        <th key={`${k}-th-${i}`} className={`py-2 px-2 font-semibold ${alignClass(i)}`}>
                          {renderInline(cell, `${k}-th-${i}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {body.map((row, r) => (
                      <tr key={`${k}-tr-${r}`} className="border-b border-muted/20">
                        {row.map((cell, c) => (
                          <td key={`${k}-td-${r}-${c}`} className={`py-1.5 px-2 ${alignClass(c)}`}>
                            {renderInline(cell, `${k}-td-${r}-${c}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case "p":
          default:
            return <p key={k} className="text-sm leading-relaxed text-foreground/90">{renderInline(b.text ?? "", k)}</p>;
        }
      })}
    </div>
  );
}
