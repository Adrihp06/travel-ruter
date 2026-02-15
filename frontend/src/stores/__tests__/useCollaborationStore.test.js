import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useCollaborationStore from '../useCollaborationStore';
import useAuthStore from '../useAuthStore';

vi.mock('../useAuthStore', () => ({
  default: { getState: () => ({ getToken: () => 'test-token' }) },
}));

describe('useCollaborationStore', () => {
  beforeEach(() => {
    useCollaborationStore.setState({ members: [], pendingInvitations: [], onlineUsers: [], isLoading: false, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetch trip members', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1, role: 'owner' }]) })
    );
    await useCollaborationStore.getState().fetchMembers(1);
    expect(useCollaborationStore.getState().members).toHaveLength(1);
  });

  it('invite member', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 2, role: 'editor', status: 'pending' }) })
    );
    const member = await useCollaborationStore.getState().inviteMember(1, 'test@test.com', 'editor');
    expect(member.role).toBe('editor');
  });

  it('accept invitation', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'accepted' }) })
    );
    const result = await useCollaborationStore.getState().acceptInvitation(1);
    expect(result.status).toBe('accepted');
  });

  it('reject invitation', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ status: 'rejected' }) })
    );
    const result = await useCollaborationStore.getState().rejectInvitation(1);
    expect(result.status).toBe('rejected');
  });

  it('websocket presence updates online members', () => {
    useCollaborationStore.getState().updateOnlineUsers([1, 2, 3]);
    expect(useCollaborationStore.getState().onlineUsers).toEqual([1, 2, 3]);
  });
});
