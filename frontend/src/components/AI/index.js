/**
 * AI Components - Export all AI-related components
 */

// Main chat component (includes button + slideover)
export { default as AIChat } from './AIChat';

// Individual components
export { default as AIChatButton } from './AIChatButton';
export { default as AIChatSlideover } from './AIChatSlideover';
export { default as AISettingsSection } from './AISettingsSection';
export { default as AgentCustomizationSection } from './AgentCustomizationSection';
export { default as TripSelector } from './TripSelector';
export { default as ToolCallDisplay } from './ToolCallDisplay';

// UI Enhancement components
export { default as ThinkingIndicator } from './ThinkingIndicator';
export { default as ConnectionStatus } from './ConnectionStatus';
export { default as WelcomeAnimation } from './WelcomeAnimation';

// Original components (for standalone use)
export { default as ChatPanel } from './ChatPanel';
export { default as ModelSelector } from './ModelSelector';
export { default as StreamingMessage } from './StreamingMessage';
