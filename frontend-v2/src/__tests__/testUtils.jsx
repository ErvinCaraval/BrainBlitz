import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../AuthContext';
import { VoiceProvider } from '../VoiceContext';
import './mocks'; // Import mocks

// Custom render function that includes all providers
export const renderWithProviders = (
  ui,
  {
    initialEntries = ['/'],
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <VoiceProvider>
          {children}
        </VoiceProvider>
      </AuthProvider>
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Re-export everything
export * from '@testing-library/react';
export { renderWithProviders as render };
