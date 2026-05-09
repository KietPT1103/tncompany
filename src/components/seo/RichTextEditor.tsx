"use client";

import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Underline,
} from "lucide-react";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const toolbarButtons = [
  { icon: Bold, label: "Đậm", command: "bold" },
  { icon: Italic, label: "Nghiêng", command: "italic" },
  { icon: Underline, label: "Gạch chân", command: "underline" },
  { icon: List, label: "Danh sách", command: "insertUnorderedList" },
  { icon: ListOrdered, label: "Danh sách số", command: "insertOrderedList" },
  { icon: Quote, label: "Trích dẫn", command: "formatBlock", value: "blockquote" },
  { icon: RemoveFormatting, label: "Xóa định dạng", command: "removeFormat" },
] as const;

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Nhập nội dung tại đây...",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  function runCommand(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  }

  function handleInsertLink() {
    const url = window.prompt("Nhập link muốn gắn:");
    if (!url) return;
    runCommand("createLink", url);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={() => runCommand("formatBlock", "p")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Đoạn
        </button>
        <button
          type="button"
          onClick={() => runCommand("formatBlock", "h2")}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Tiêu đề phụ
        </button>
        {toolbarButtons.map((button) => (
          <button
            key={button.label}
            type="button"
            onClick={() => runCommand(button.command, button.value)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <button.icon className="h-3.5 w-3.5" />
            {button.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleInsertLink}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <LinkIcon className="h-3.5 w-3.5" />
          Gắn link
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        className="min-h-[220px] rounded-b-2xl px-4 py-4 text-sm leading-7 text-slate-800 focus:outline-none"
        data-placeholder={placeholder}
      />
      <style>{`
        [contenteditable][data-placeholder]:empty::before {
          content: attr(data-placeholder);
          color: #94a3b8;
        }
        [contenteditable] h2 {
          font-size: 1.3rem;
          margin: 0 0 0.8rem;
        }
        [contenteditable] p {
          margin: 0 0 1rem;
        }
        [contenteditable] blockquote {
          margin: 0 0 1rem;
          border-left: 3px solid #16a34a;
          padding-left: 1rem;
          color: #475569;
        }
      `}</style>
    </div>
  );
}
