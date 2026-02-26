import React, { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
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
  Redo,
} from 'lucide-react';
import ArrowBackUpIcon from '@/components/icons/arrow-back-up-icon';

// Configure DOMPurify to allow safe HTML elements for rich text editing
const sanitizeConfig = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'span', 'div'],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'form', 'input', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

const ToolbarButton = ({ onClick, active, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`
      p-1.5 rounded transition-colors
      ${active
        ? 'bg-amber-100 dark:bg-amber-900/30 text-[#D97706] dark:text-amber-400'
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
  const { t } = useTranslation();
  const editorRef = useRef(null);
  const isInternalChange = useRef(false);

  // Initialize editor content with sanitized HTML
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      const sanitizedValue = value ? DOMPurify.sanitize(value, sanitizeConfig) : '';
      if (editorRef.current.innerHTML !== sanitizedValue) {
        editorRef.current.innerHTML = sanitizedValue;
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
    const url = prompt(t('journal.richText.enterUrl'));
    if (url) {
      execCommand('createLink', url);
    }
  };

  const insertImage = () => {
    const url = prompt(t('journal.richText.enterImageUrl'));
    if (url) {
      execCommand('insertImage', url);
    }
  };

  const handlePaste = useCallback(() => {}, []);

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
        <ToolbarButton onClick={formatBold} title={t('journal.richText.bold')} disabled={disabled}>
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatItalic} title={t('journal.richText.italic')} disabled={disabled}>
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatUnderline} title={t('journal.richText.underline')} disabled={disabled}>
          <Underline className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={formatH1} title={t('journal.richText.heading1')} disabled={disabled}>
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatH2} title={t('journal.richText.heading2')} disabled={disabled}>
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={formatUnorderedList} title={t('journal.richText.bulletList')} disabled={disabled}>
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatOrderedList} title={t('journal.richText.numberedList')} disabled={disabled}>
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatQuote} title={t('journal.richText.quote')} disabled={disabled}>
          <Quote className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={insertLink} title={t('journal.richText.insertLink')} disabled={disabled}>
          <Link className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={insertImage} title={t('journal.richText.insertImage')} disabled={disabled}>
          <Image className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton onClick={formatUndo} title={t('journal.richText.undo')} disabled={disabled}>
          <ArrowBackUpIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={formatRedo} title={t('journal.richText.redo')} disabled={disabled}>
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
          [&_a]:text-[#D97706] [&_a]:underline
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
