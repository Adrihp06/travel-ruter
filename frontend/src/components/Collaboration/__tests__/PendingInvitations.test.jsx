import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/helpers';
import PendingInvitations from '../PendingInvitations';
import useCollaborationStore from '../../../stores/useCollaborationStore';

vi.mock('../../../stores/useCollaborationStore');

const mockInvitation = {
  id: 1,
  trip_name: 'Japan Trip',
  invited_by_name: 'Alice',
  role: 'editor',
};

describe('PendingInvitations', () => {
  let acceptInvitation;
  let rejectInvitation;
  let fetchPendingInvitations;

  beforeEach(() => {
    acceptInvitation = vi.fn().mockResolvedValue({});
    rejectInvitation = vi.fn().mockResolvedValue({});
    fetchPendingInvitations = vi.fn().mockResolvedValue();

    useCollaborationStore.mockReturnValue({
      pendingInvitations: [mockInvitation],
      fetchPendingInvitations,
      acceptInvitation,
      rejectInvitation,
    });
  });

  it('shows success toast on accept', async () => {
    const user = userEvent.setup();
    const onAccepted = vi.fn().mockResolvedValue();
    renderWithProviders(<PendingInvitations onAccepted={onAccepted} />);

    await user.click(screen.getByRole('button', { name: /collaboration\.accept/i }));

    await waitFor(() => {
      expect(acceptInvitation).toHaveBeenCalledWith(1);
    });
    // Toast appears in DOM as role="alert"
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows success toast on decline', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PendingInvitations />);

    await user.click(screen.getByRole('button', { name: /collaboration\.decline/i }));

    await waitFor(() => {
      expect(rejectInvitation).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows error toast on failed accept', async () => {
    acceptInvitation.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    renderWithProviders(<PendingInvitations />);

    await user.click(screen.getByRole('button', { name: /collaboration\.accept/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // Phase 3 i18n tests
  it('renders i18n keys for headings and buttons', () => {
    renderWithProviders(<PendingInvitations />);
    expect(screen.getByText('collaboration.pendingInvitations')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collaboration\.accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /collaboration\.decline/i })).toBeInTheDocument();
  });

  it('renders i18n key for invited-by text', () => {
    renderWithProviders(<PendingInvitations />);
    expect(screen.getByText(/collaboration\.invitedBy/)).toBeInTheDocument();
  });
});
