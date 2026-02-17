import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/helpers';
import TripMemberList from '../TripMemberList';
import useCollaborationStore from '../../../stores/useCollaborationStore';
import useAuthStore from '../../../stores/useAuthStore';

vi.mock('../../../stores/useCollaborationStore');
vi.mock('../../../stores/useAuthStore', () => {
  const fn = vi.fn();
  fn.getState = vi.fn(() => ({}));
  return { default: fn };
});

const ownerMember = {
  id: 1,
  user_id: 100,
  user_name: 'Owner',
  user_email: 'owner@test.com',
  role: 'owner',
  status: 'accepted',
};
const editorMember = {
  id: 2,
  user_id: 200,
  user_name: 'Editor',
  user_email: 'editor@test.com',
  role: 'editor',
  status: 'accepted',
};

describe('TripMemberList', () => {
  let removeMember;

  beforeEach(() => {
    removeMember = vi.fn().mockResolvedValue();
    useCollaborationStore.mockReturnValue({
      members: [ownerMember, editorMember],
      isLoading: false,
      fetchMembers: vi.fn(),
      removeMember,
    });
    // useAuthStore uses selector pattern: useAuthStore((s) => s.user)
    useAuthStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({ user: { id: 100 } });
      }
      return { user: { id: 100 } };
    });
  });

  it('shows success toast on member removal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TripMemberList tripId={1} />);

    // Click the remove button (X icon) for the editor
    const removeBtn = screen.getByTitle('collaboration.removeMember');
    await user.click(removeBtn);

    // Phase 4: Confirm dialog appears first
    await waitFor(() => {
      expect(screen.getByText(/collaboration\.confirmRemoveMessage/)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /common\.confirm/i }));

    await waitFor(() => {
      expect(removeMember).toHaveBeenCalledWith(1, 200);
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error toast on failed removal', async () => {
    removeMember.mockRejectedValue(new Error('Forbidden'));
    const user = userEvent.setup();
    renderWithProviders(<TripMemberList tripId={1} />);

    const removeBtn = screen.getByTitle('collaboration.removeMember');
    await user.click(removeBtn);

    // Confirm the dialog
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /common\.confirm/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /common\.confirm/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
