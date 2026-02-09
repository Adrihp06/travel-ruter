/**
 * StreamingMessage - Displays a chat message with streaming support
 */

import React, { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

const StreamingMessage = ({ message }) => {
  const contentRef = useRef(null);

  // Auto-scroll when content updates during streaming
  useEffect(() => {
    if (message.isStreaming && contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [message.content, message.isStreaming]);

  const formatContent = (content) => {
    // Simple markdown-like formatting
    // Bold: **text**
    // Code: `code`
    // Code blocks: ```code```

    let formatted = content;

    // Code blocks
    formatted = formatted.replace(
      /```(\w*)\n?([\s\S]*?)```/g,
      '<pre class="code-block"><code>$2</code></pre>'
    );

    // Inline code
    formatted = formatted.replace(
      /`([^`]+)`/g,
      '<code class="inline-code">$1</code>'
    );

    // Bold
    formatted = formatted.replace(
      /\*\*([^*]+)\*\*/g,
      '<strong>$1</strong>'
    );

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br />');

    return DOMPurify.sanitize(formatted);
  };

  const getMessageClass = () => {
    const classes = ['chat-message', `role-${message.role}`];
    if (message.isStreaming) classes.push('streaming');
    return classes.join(' ');
  };

  const getRoleLabel = () => {
    switch (message.role) {
      case 'user':
        return 'You';
      case 'assistant':
        return 'AI';
      case 'system':
        return 'System';
      case 'tool':
        return 'Tool';
      default:
        return message.role;
    }
  };

  const formatTimestamp = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={getMessageClass()} ref={contentRef}>
      <div className="message-header">
        <span className="message-role">{getRoleLabel()}</span>
        <span className="message-time">{formatTimestamp(message.timestamp)}</span>
      </div>

      <div
        className="message-content"
        dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
      />

      {/* Tool calls indicator */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="tool-calls">
          {message.toolCalls.map((tc, idx) => (
            <div key={tc.id || idx} className="tool-call">
              <span className="tool-icon">&#x1F527;</span>
              <span className="tool-name">{tc.name}</span>
              {message.isStreaming && <span className="tool-status">Running...</span>}
            </div>
          ))}
        </div>
      )}

      {/* Streaming indicator */}
      {message.isStreaming && (
        <div className="streaming-indicator">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
      )}
    </div>
  );
};

export default StreamingMessage;
