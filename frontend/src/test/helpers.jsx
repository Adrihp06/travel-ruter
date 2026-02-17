import React from 'react';
import { render } from '@testing-library/react';
import { ToastProvider } from '../components/common/Toast';

export function renderWithProviders(ui) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}
