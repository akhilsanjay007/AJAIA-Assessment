function renderInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (!(node instanceof HTMLElement)) {
    return "";
  }
  const tag = node.tagName.toLowerCase();
  if (tag === "br") {
    return "  \n";
  }
  const inner = Array.from(node.childNodes).map(renderInline).join("");
  if (tag === "strong" || tag === "b") {
    return inner.trim() ? `**${inner}**` : "";
  }
  if (tag === "em" || tag === "i") {
    return inner.trim() ? `*${inner}*` : "";
  }
  if (tag === "u") {
    return inner.trim() ? `<u>${inner}</u>` : "";
  }
  return inner;
}

function renderList(list: HTMLElement, ordered: boolean, depth = 0): string {
  const items = Array.from(list.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.tagName.toLowerCase() === "li",
  );
  return items
    .map((item, index) => renderListItem(item, ordered, index, depth))
    .filter((line) => line.length > 0)
    .join("\n");
}

function renderListItem(item: HTMLElement, ordered: boolean, index: number, depth: number): string {
  const indent = "  ".repeat(depth);
  const marker = ordered ? `${index + 1}. ` : "- ";
  const lines: string[] = [];
  const inlineParts: string[] = [];

  function flushInline() {
    const text = inlineParts.join("").replace(/[ \t]+\n/g, "\n").trim();
    inlineParts.length = 0;
    if (!text) {
      return;
    }
    if (lines.length === 0) {
      lines.push(`${indent}${marker}${text}`);
      return;
    }
    lines.push(`${indent}${" ".repeat(marker.length)}${text}`);
  }

  for (const child of Array.from(item.childNodes)) {
    if (child instanceof HTMLElement) {
      const tag = child.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        flushInline();
        if (lines.length === 0) {
          lines.push(`${indent}${marker}`.trimEnd());
        }
        const nested = renderList(child, tag === "ol", depth + 1);
        if (nested) {
          lines.push(nested);
        }
        continue;
      }
      if (tag === "p") {
        inlineParts.push(renderInline(child));
        flushInline();
        continue;
      }
    }
    inlineParts.push(renderInline(child));
  }
  flushInline();
  if (lines.length === 0) {
    return `${indent}${marker}`.trimEnd();
  }
  return lines.join("\n");
}

function renderBlocks(parent: Node): string {
  const blocks: string[] = [];
  for (const child of Array.from(parent.childNodes)) {
    if (!(child instanceof HTMLElement)) {
      continue;
    }
    const tag = child.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      blocks.push(`${"#".repeat(Number(tag[1]))} ${renderInline(child).trim()}`);
    } else if (tag === "ul") {
      blocks.push(renderList(child, false));
    } else if (tag === "ol") {
      blocks.push(renderList(child, true));
    } else if (tag === "p") {
      blocks.push(renderInline(child).trim());
    } else {
      const nested = renderBlocks(child);
      blocks.push(nested || renderInline(child).trim());
    }
  }
  return blocks.filter((block) => block.length > 0).join("\n\n");
}

export function htmlToMarkdown(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const markdown = renderBlocks(parsed.body).trim();
  return markdown ? `${markdown}\n` : "";
}

export function markdownFilename(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\.+$/, "");
  const base = (cleaned || "Untitled").slice(0, 80);
  return `${base}.md`;
}

export function downloadMarkdown(title: string, html: string): void {
  const blob = new Blob([htmlToMarkdown(html)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = markdownFilename(title);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
