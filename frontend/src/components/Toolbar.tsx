import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";

type ToolbarProps = {
  editor: Editor | null;
};

type ToolButton = {
  label: string;
  active: () => boolean;
  command: () => void;
};

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

  const buttons: ToolButton[] = editor
    ? [
        {
          label: "Bold",
          active: () => editor.isActive("bold"),
          command: () => editor.chain().focus().toggleBold().run(),
        },
        {
          label: "Italic",
          active: () => editor.isActive("italic"),
          command: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          label: "Underline",
          active: () => editor.isActive("underline"),
          command: () => editor.chain().focus().toggleUnderline().run(),
        },
        {
          label: "H1",
          active: () => editor.isActive("heading", { level: 1 }),
          command: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          label: "H2",
          active: () => editor.isActive("heading", { level: 2 }),
          command: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          label: "H3",
          active: () => editor.isActive("heading", { level: 3 }),
          command: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          label: "Bullets",
          active: () => editor.isActive("bulletList"),
          command: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          label: "Numbers",
          active: () => editor.isActive("orderedList"),
          command: () => editor.chain().focus().toggleOrderedList().run(),
        },
      ]
    : [];

  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200 px-3 py-2">
      {buttons.map((button) => {
        const active = button.active();
        return (
          <button
            key={button.label}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={button.command}
            aria-pressed={active}
            className={
              active
                ? "rounded-md bg-slate-900 px-2.5 py-1 text-sm font-medium text-white"
                : "rounded-md px-2.5 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
            }
          >
            {button.label}
          </button>
        );
      })}
    </div>
  );
}
