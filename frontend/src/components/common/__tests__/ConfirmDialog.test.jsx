import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../test/helpers';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    title: 'Delete Item',
    message: 'Are you sure you want to delete this?',
  };

  it('renders nothing when isOpen=false', () => {
    const { container } = renderWithProviders(
      <ConfirmDialog {...defaultProps} isOpen={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title, message, confirm and cancel buttons when isOpen=true', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} />);
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /common\.confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /common\.cancel/i })).toBeInTheDocument();
  });

  it('calls onConfirm on confirm click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /common\.confirm/i }));
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on cancel click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfirmDialog {...defaultProps} />);
    await user.click(screen.getByRole('button', { name: /common\.cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows custom labels via confirmLabel/cancelLabel', () => {
    renderWithProviders(
      <ConfirmDialog {...defaultProps} confirmLabel="Yes, delete" cancelLabel="No, keep" />
    );
    expect(screen.getByRole('button', { name: 'Yes, delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No, keep' })).toBeInTheDocument();
  });

  it('applies danger styling when variant="danger"', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} variant="danger" />);
    const confirmBtn = screen.getByRole('button', { name: /common\.confirm/i });
    expect(confirmBtn.className).toMatch(/red/);
  });

  it('shows loading state when isLoading=true', () => {
    renderWithProviders(<ConfirmDialog {...defaultProps} isLoading={true} />);
    const confirmBtn = screen.getByRole('button', { name: /common\.confirm/i });
    expect(confirmBtn).toBeDisabled();
  });
});
