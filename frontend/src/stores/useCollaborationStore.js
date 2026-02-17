import { create } from 'zustand';
import authFetch from '../utils/authFetch';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const useCollaborationStore = create((set, get) => ({
  members: [],
  pendingInvitations: [],
  onlineUsers: [],
  isLoading: false,
  error: null,

  fetchMembers: async (tripId) => {
    set({ isLoading: true });
    try {
      const resp = await authFetch(`${API_BASE}/trips/${tripId}/members`);
      if (!resp.ok) throw new Error('Failed to fetch members');
      const members = await resp.json();
      set({ members, isLoading: false, error: null });
    } catch (err) {
      set({ isLoading: false, error: err.message });
    }
  },

  inviteMember: async (tripId, email, role = 'viewer') => {
    const resp = await authFetch(`${API_BASE}/trips/${tripId}/members`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
    if (!resp.ok) {
      const errorData = await resp.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to invite member');
    }
    const member = await resp.json();
    set((state) => ({ members: [...state.members, member] }));
    return member;
  },

  acceptInvitation: async (memberId) => {
    const resp = await authFetch(`${API_BASE}/invitations/${memberId}/accept`, {
      method: 'POST',
    });
    if (!resp.ok) throw new Error('Failed to accept invitation');
    const result = await resp.json();
    set((state) => ({
      pendingInvitations: state.pendingInvitations.filter((inv) => inv.id !== memberId),
    }));
    return result;
  },

  rejectInvitation: async (memberId) => {
    const resp = await authFetch(`${API_BASE}/invitations/${memberId}/reject`, {
      method: 'POST',
    });
    if (!resp.ok) throw new Error('Failed to reject invitation');
    const result = await resp.json();
    set((state) => ({
      pendingInvitations: state.pendingInvitations.filter((inv) => inv.id !== memberId),
    }));
    return result;
  },

  fetchPendingInvitations: async () => {
    const resp = await authFetch(`${API_BASE}/invitations/pending`);
    if (!resp.ok) throw new Error('Failed to fetch invitations');
    const invitations = await resp.json();
    set({ pendingInvitations: invitations });
  },

  updateOnlineUsers: (users) => set({ onlineUsers: users }),
}));

export default useCollaborationStore;
