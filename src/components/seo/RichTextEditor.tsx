"use client";

import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Underline,
  Unlink,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minimal?: boolean;
};

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  unordered: boolean;
  ordered: boolean;
  link: boolean;
  block: "p" | "h2" | "h3" | "blockquote";
};

const initialToolbarState: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  unordered: false,
  ordered: false,
  link: false,
  block: "p",
};

const formattingButtons = [
  { icon: Bold, label: "Đậm", command: "bold", stateKey: "bold" },
  { icon: Italic, label: "Nghiêng", command: "italic", stateKey: "italic" },
  { icon: Underline, label: "Gạch chân", command: "underline", stateKey: "underline" },
  { icon: List, label: "Danh sách", command: "insertUnorderedList", stateKey: "unordered" },
  { icon: ListOrdered, label: "Đánh số", command: "insertOrderedList", stateKey: "ordered" },
  { icon: Quote, label: "Trích dẫn", command: "formatBlock", value: "blockquote", stateKey: "block" },
] as const;

function isSelectionInsideEditor(
  selection: Selection | null,
  editor: HTMLDivElement | null
) {
  if (!selection || !editor || selection.rangeCount === 0) return false;
  const anchorNode = selection.anchorNode;
  return !!anchorNode && editor.contains(anchorNode);
}

function detectBlockType(
  editor: HTMLDivElement,
  selection: Selection | null
): ToolbarState["block"] {
  if (!selection || selection.rangeCount === 0) return "p";
  let node: Node | null = selection.anchorNode;

  while (node && node !== editor) {
    if (node instanceof HTMLElement) {
      const tagName = node.tagName.toLowerCase();
      if (tagName === "h2" || tagName === "h3" || tagName === "blockquote") {
        return tagName;
      }
    }
    node = node.parentNode;
  }

  return "p";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung tại đây...",
  minimal = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [toolbarState, setToolbarState] = useState<ToolbarState>(initialToolbarState);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  const blockButtons = useMemo(
    () => [
      { label: "Đoạn", value: "p" as const },
      { label: "H2", value: "h2" as const },
      { label: "H3", value: "h3" as const },
    ],
    []
  );

  function syncValue() {
    onChange(editorRef.current?.innerHTML || "");
  }

  function saveSelection() {
    const selection = window.getSelection();
    if (!isSelectionInsideEditor(selection, editorRef.current)) return;
    selectionRef.current = selection?.getRangeAt(0).cloneRange() || null;
  }

  function restoreSelection() {
    const selection = window.getSelection();
    if (!selection || !selectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  }

  function updateToolbarState() {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !isSelectionInsideEditor(selection, editor)) {
      return;
    }

    setToolbarState({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      unordered: document.queryCommandState("insertUnorderedList"),
      ordered: document.queryCommandState("insertOrderedList"),
      link: document.queryCommandState("createLink"),
      block: detectBlockType(editor, selection),
    });
  }

  useEffect(() => {
    function handleSelectionChange() {
      updateToolbarState();
      saveSelection();
    }

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, []);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, commandValue);
    syncValue();
    updateToolbarState();
    saveSelection();
  }

  function handleToolbarMouseDown(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  function handleInsertLink() {
    saveSelection();
    const url = window.prompt("Nhập đường dẫn muốn gắn:");
    if (!url?.trim()) return;

    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || "";
    const linkText = window.prompt(
      "Nhập nội dung hiển thị cho link:",
      selectedText
    );

    if (!linkText?.trim()) return;

    runCommand(
      "insertHTML",
      `<a href="${escapeAttribute(url.trim())}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        linkText.trim()
      )}</a>`
    );
  }

  function handleRemoveLink() {
    runCommand("unlink");
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[28px] border border-[#e8e1d5] bg-[#fdfbf7]",
        minimal && "rounded-none border-0 bg-transparent"
      )}
    >
      <div
        className={cn(
          "sticky top-0 z-[2] flex flex-wrap items-center gap-2 border-b border-[#ece5da] bg-white/92 px-3 py-3 backdrop-blur",
          minimal && "rounded-2xl border border-[#ece5da] px-3 py-3 shadow-sm"
        )}
      >
        <div className="inline-flex rounded-full bg-[#f5f1ea] p-1">
          {blockButtons.map((button) => (
            <button
              key={button.value}
              type="button"
              onMouseDown={handleToolbarMouseDown}
              onClick={() => runCommand("formatBlock", button.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                toolbarState.block === button.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              {button.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-[#e5ddd1]" />

        {formattingButtons.map((button) => {
          const isActive =
            button.stateKey === "block"
              ? toolbarState.block === "blockquote"
              : toolbarState[button.stateKey];

          return (
            <button
              key={button.label}
              type="button"
              onMouseDown={handleToolbarMouseDown}
              onClick={() => runCommand(button.command, button.value)}
              className={cn(
                "inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold transition",
                isActive
                  ? "bg-[#eff6ff] text-[#1d4ed8]"
                  : "text-slate-600 hover:bg-[#f5f1ea] hover:text-slate-900"
              )}
            >
              <button.icon className="h-3.5 w-3.5" />
              {button.label}
            </button>
          );
        })}

        <div className="h-6 w-px bg-[#e5ddd1]" />

        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={handleInsertLink}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold transition",
            toolbarState.link
              ? "bg-[#eff6ff] text-[#1d4ed8]"
              : "text-slate-600 hover:bg-[#f5f1ea] hover:text-slate-900"
          )}
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Gắn link
        </button>

        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={handleRemoveLink}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-slate-600 transition hover:bg-[#f5f1ea] hover:text-slate-900"
        >
          <Unlink className="h-3.5 w-3.5" />
          Bỏ link
        </button>

        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={() => runCommand("undo")}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-slate-600 transition hover:bg-[#f5f1ea] hover:text-slate-900"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Lùi
        </button>

        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={() => runCommand("redo")}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-slate-600 transition hover:bg-[#f5f1ea] hover:text-slate-900"
        >
          <Redo2 className="h-3.5 w-3.5" />
          Tới
        </button>

        <button
          type="button"
          onMouseDown={handleToolbarMouseDown}
          onClick={() => runCommand("removeFormat")}
          className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold text-slate-600 transition hover:bg-[#f5f1ea] hover:text-slate-900"
        >
          <RemoveFormatting className="h-3.5 w-3.5" />
          Xóa định dạng
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onFocus={() => {
          updateToolbarState();
          saveSelection();
        }}
        onKeyUp={() => {
          syncValue();
          updateToolbarState();
          saveSelection();
        }}
        onMouseUp={() => {
          updateToolbarState();
          saveSelection();
        }}
        onInput={(event) => {
          onChange(event.currentTarget.innerHTML);
          updateToolbarState();
          saveSelection();
        }}
        className={cn(
          "min-h-[280px] px-5 py-5 text-[17px] leading-8 text-slate-800 focus:outline-none",
          minimal && "min-h-[220px] px-0 pb-0 pt-5 text-[18px] leading-9"
        )}
        data-placeholder={placeholder}
      />

      <div
        className={cn(
          "border-t border-[#ece5da] px-5 py-3 text-xs text-slate-400",
          minimal && "border-0 px-0 pt-3"
        )}
      >
        Có thể dùng phím tắt quen thuộc như `Ctrl+B`, `Ctrl+I`, `Ctrl+U`.
      </div>

      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        [contenteditable] h2 {
          margin: 0 0 1rem;
          color: #0f172a;
          font-size: 2rem;
          line-height: 1.2;
          font-weight: 800;
        }
        [contenteditable] h3 {
          margin: 0 0 1rem;
          color: #1d4ed8;
          font-size: 1.45rem;
          line-height: 1.3;
          font-weight: 800;
        }
        [contenteditable] p {
          margin: 0 0 1rem;
        }
        [contenteditable] ul,
        [contenteditable] ol {
          margin: 0 0 1rem;
          padding-left: 1.4rem;
          list-style-position: outside;
        }
        [contenteditable] ul {
          list-style-type: disc;
        }
        [contenteditable] ol {
          list-style-type: decimal;
        }
        [contenteditable] li {
          margin-bottom: 0.45rem;
        }
        [contenteditable] blockquote {
          margin: 0 0 1rem;
          border-left: 3px solid #2563eb;
          padding-left: 1rem;
          color: #475569;
          font-style: italic;
        }
        [contenteditable] a {
          color: #2563eb;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
