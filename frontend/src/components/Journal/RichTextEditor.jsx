import React, { useRef, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Link,
  Image,
  Undo,
  Redo,
} from 'lucide-react';

const ToolbarButton = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-1.5 rounded transition-colors
      ${active
        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    {children}
  </button>
);

const Divider = () => (
  <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />
);

const RichTextEditor = ({
  value = '',
  onChange,
  placeholder = 'Write your note...',
  className = '',
  minHeight = '200px',
  disabled = false,
}) => {
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  // Handle input changes
  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange?.(editorRef.current.innerHTML);
    }
  }, [onChange]);

  // Execute document command
  const execCommand = useCallback((command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  }, [handleInput]);

  // Format commands
  const formatBold = () => execCommand('bold');
  const formatItalic = () => execCommand('italic');
  const formatUnderline = () => execCommand('underline');
  const formatUnorderedList = () => execCommand('insertUnorderedList');
  const formatOrderedList = () => execCommand('insertOrderedList');
  const formatQuote = () => execCommand('formatBlock', 'blockquote');
  const formatH1 = () => execCommand('formatBlock', 'h1');
  const formatH2 = () => execCommand('formatBlock', 'h2');
  const formatUndo = () => execCommand('undo');
  const formatRedo = () => execCommand('redo');

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      execCommand('insertImage', url);
    }
  };

  // Handle paste to strip formatting (optional)
  const handlePaste = useCallback((e) => {
    // Allow rich text paste by default
    // Uncomment below for plain text only:
    // e.preventDefault();
    // const text = e.clipboardData.getData('text/plain');
    // document.execCommand('insertText', false, text);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          formatBold();
          break;
        case 'i':
          e.preventDefault();
          formatItalic();
          break;
        case 'u':
          e.preventDefault();
          formatUnderline();
          break;
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            formatRedo();
          } else {
            formatUndo();
          }
          break;
        default:
          break;
      }
    }
  }, []);

  return (
    <div className={`border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <ToolbarButton onClick={formatBold} title="Bold (Ctrl+B)" disabled={disabled}>
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatItalic} title="Italic (Ctrl+I)" disabled={disabled}>
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatUnderline} title="Underline (Ctrl+U)" disabled={disabled}>
          <Underline className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={formatH1} title="Heading 1" disabled={disabled}>
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatH2} title="Heading 2" disabled={disabled}>
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={formatUnorderedList} title="Bullet List" disabled={disabled}>
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatOrderedList} title="Numbered List" disabled={disabled}>
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatQuote} title="Quote" disabled={disabled}>
          <Quote className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={insertLink} title="Insert Link" disabled={disabled}>
          <Link className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertImage} title="Insert Image URL" disabled={disabled}>
          <Image className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={formatUndo} title="Undo (Ctrl+Z)" disabled={disabled}>
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatRedo} title="Redo (Ctrl+Shift+Z)" disabled={disabled}>
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        className={`
          p-4 outline-none overflow-y-auto
          bg-white dark:bg-gray-900
          text-gray-900 dark:text-gray-100
          ${disabled ? 'cursor-not-allowed opacity-60' : ''}
          prose prose-sm dark:prose-invert max-w-none
          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2
          [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2
          [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic
          [&_ul]:list-disc [&_ul]:ml-4
          [&_ol]:list-decimal [&_ol]:ml-4
          [&_a]:text-indigo-600 [&_a]:underline
          [&_img]:max-w-full [&_img]:rounded-lg
          empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:dark:text-gray-500
        `}
        style={{ minHeight }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
    </div>
  );
};

export default RichTextEditor;
