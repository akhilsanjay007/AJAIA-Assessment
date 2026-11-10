import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

type ToolbarProps = {
  editor: Editor | null;
};

type ToolButton = {
  label: string;
  display: string;
  displayClass: string;
  active: () => boolean;
  command: () => void;
};

const buttonClass = (active: boolean) =>
  [
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] text-slate-700 transition-colors",
    "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30",
    active ? "bg-blue-100 text-blue-900 hover:bg-blue-100" : "",
  ].join(" ");

export function Toolbar({ editor }: ToolbarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const refresh = () => setTick((value) => value + 1);
    editor.on("transaction", refresh);
    return () => {
      editor.off("transaction", refresh);
    };
  }, [editor]);

  const groups: ToolButton[][] = editor
    ? [
        [
          {
            label: "Bold",
            display: "B",
            displayClass: "font-bold",
            active: () => editor.isActive("bold"),
            command: () => editor.chain().focus().toggleBold().run(),
          },
          {
            label: "Italic",
            display: "I",
            displayClass: "font-serif text-[15px] italic",
            active: () => editor.isActive("italic"),
            command: () => editor.chain().focus().toggleItalic().run(),
          },
          {
            label: "Underline",
            display: "U",
            displayClass: "underline underline-offset-2",
            active: () => editor.isActive("underline"),
            command: () => editor.chain().focus().toggleUnderline().run(),
          },
        ],
        [
          {
            label: "H1",
            display: "H1",
            displayClass: "text-[11px] font-semibold tracking-wide",
            active: () => editor.isActive("heading", { level: 1 }),
            command: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          },
          {
            label: "H2",
            display: "H2",
            displayClass: "text-[11px] font-semibold tracking-wide",
            active: () => editor.isActive("heading", { level: 2 }),
            command: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          },
          {
            label: "H3",
            display: "H3",
            displayClass: "text-[11px] font-semibold tracking-wide",
            active: () => editor.isActive("heading", { level: 3 }),
            command: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          },
        ],
        [
          {
            label: "Bullets",
            display: "•",
            displayClass: "text-base leading-none",
            active: () => editor.isActive("bulletList"),
            command: () => editor.chain().focus().toggleBulletList().run(),
          },
          {
            label: "Numbers",
            display: "1.",
            displayClass: "text-[12px] font-semibold",
            active: () => editor.isActive("orderedList"),
            command: () => editor.chain().focus().toggleOrderedList().run(),
          },
        ],
      ]
    : [];

  return (
    <div className="mt-6 flex flex-wrap items-center gap-1 border-b border-slate-200 px-6 py-1.5 sm:px-14">
      {groups.map((group, index) => (
        <div key={group[0]?.label ?? index} className="flex items-center">
          {index > 0 ? <span className="mx-1.5 h-4 w-px bg-slate-200" aria-hidden="true" /> : null}
          <div className="flex items-center gap-0.5">
            {group.map((button) => {
              const active = button.active();
              return (
                <button
                  key={button.label}
                  type="button"
                  title={button.label}
                  aria-label={button.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={button.command}
                  aria-pressed={active}
                  className={buttonClass(active)}
                >
                  <span className={button.displayClass}>{button.display}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
