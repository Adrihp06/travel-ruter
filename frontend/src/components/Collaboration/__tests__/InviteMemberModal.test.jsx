import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/helpers';
import InviteMemberModal from '../InviteMemberModal';
import useCollaborationStore from '../../../stores/useCollaborationStore';

vi.mock('../../../stores/useCollaborationStore');

describe('InviteMemberModal', () => {
  let inviteMember;

  beforeEach(() => {
    inviteMember = vi.fn().mockResolvedValue({});
    useCollaborationStore.mockReturnValue(inviteMember);
    // The component uses selector: useCollaborationStore((s) => s.inviteMember)
    useCollaborationStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector({ inviteMember });
      }
      return { inviteMember };
    });
  });

  it('shows success toast after invite', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<InviteMemberModal tripId={1} isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('collaboration.emailPlaceholder'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /collaboration\.invite/i }));

    await waitFor(() => {
      expect(inviteMember).toHaveBeenCalledWith(1, 'test@example.com', 'viewer');
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error toast on invite failure', async () => {
    inviteMember.mockRejectedValue(new Error('Already a member'));
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<InviteMemberModal tripId={1} isOpen={true} onClose={onClose} />);

    await user.type(screen.getByPlaceholderText('collaboration.emailPlaceholder'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /collaboration\.invite/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
