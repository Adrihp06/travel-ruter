# Move MCP Access into AI Settings as "Claude Code" Tab

**Date:** 2026-03-02

## Goal

Consolidate the standalone MCP Access page into the AI Settings page as a new "Claude Code" tab, removing the separate page and sidebar entry.

## Changes

### 1. New component: `ClaudeCodeSection.jsx`

Extract MCP token generation from `MCPAccessPage.jsx` into `frontend/src/components/AI/ClaudeCodeSection.jsx`. Contains:

- "How it works" explanation
- Token generation (expiry selector + generate button)
- Token display with copy button
- Claude Code terminal command (with copy)
- Claude Desktop JSON config (with copy)
- Available tools grid

### 2. Add tab to `AISettingsPage.jsx`

Add third tab: `{ id: 'claude-code', label: 'Claude Code', icon: Terminal }` alongside existing "Assistant" and "Agent Customization" tabs.

### 3. Remove standalone page

- Delete `frontend/src/pages/MCPAccessPage.jsx`
- Remove `/mcp-access` route from `App.jsx`
- Remove "MCP Access" sidebar entry from `Sidebar.jsx`

## Files

| File | Action |
|------|--------|
| `frontend/src/components/AI/ClaudeCodeSection.jsx` | Create |
| `frontend/src/pages/AISettingsPage.jsx` | Edit (add tab) |
| `frontend/src/pages/MCPAccessPage.jsx` | Delete |
| `frontend/src/App.jsx` | Edit (remove route) |
| `frontend/src/components/Layout/Sidebar.jsx` | Edit (remove nav item) |

## Backend

No changes. `POST /api/v1/mcp-access/token` stays as-is.
