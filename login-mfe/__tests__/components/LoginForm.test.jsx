/**
 * Unit Tests for LoginForm Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginForm from '../../src/components/LoginForm';

describe('LoginForm Component', () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    mockOnLogin.mockClear();
  });

  describe('Rendering', () => {
    it('should render login form with all elements', () => {
      render(<LoginForm onLogin={mockOnLogin} />);

      expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('should render demo credentials section', () => {
      render(<LoginForm onLogin={mockOnLogin} />);

      expect(screen.getByText(/demo credentials/i)).toBeInTheDocument();
      // Use getAllByText since admin/user/guest appear multiple times
      expect(screen.getAllByText(/admin/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/user/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/guest/i).length).toBeGreaterThan(0);
    });

    it('should have empty inputs initially', () => {
      render(<LoginForm onLogin={mockOnLogin} />);

      expect(screen.getByLabelText(/username/i)).toHaveValue('');
      expect(screen.getByLabelText(/password/i)).toHaveValue('');
    });
  });

  describe('User Interactions', () => {
    it('should update username input on change', async () => {
      const user = userEvent.setup();
      render(<LoginForm onLogin={mockOnLogin} />);

      const usernameInput = screen.getByLabelText(/username/i);
      await user.type(usernameInput, 'testuser');

      expect(usernameInput).toHaveValue('testuser');
    });

    it('should update password input on change', async () => {
      const user = userEvent.setup();
      render(<LoginForm onLogin={mockOnLogin} />);

      const passwordInput = screen.getByLabelText(/password/i);
      await user.type(passwordInput, 'testpass');

      expect(passwordInput).toHaveValue('testpass');
    });

    it('should have password input type as password', () => {
      render(<LoginForm onLogin={mockOnLogin} />);

      const passwordInput = screen.getByLabelText(/password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });
  });

  describe('Form Submission', () => {
    it('should show loading state when submitting', async () => {
      const user = userEvent.setup();
      render(<LoginForm onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/username/i), 'admin');
      await user.type(screen.getByLabelText(/password/i), 'admin123');
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitButton);

      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should call onLogin with user data for valid credentials', async () => {
      const user = userEvent.setup();
      render(<LoginForm onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/username/i), 'admin');
      await user.type(screen.getByLabelText(/password/i), 'admin123');
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'admin',
            name: 'Administrator',
            role: 'admin',
          })
        );
      }, { timeout: 2000 });
    });

    it('should call onLogin for user credentials', async () => {
      const user = userEvent.setup();
      render(<LoginForm onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/username/i), 'user');
      await user.type(screen.getByLabelText(/password/i), 'user123');
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'user',
            name: 'John Doe',
            role: 'user',
          })
        );
      }, { timeout: 2000 });
    });

    it('should show error message for invalid credentials', async () => {
      const user = userEvent.setup();
      render(<LoginForm onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/username/i), 'wronguser');
      await user.type(screen.getByLabelText(/password/i), 'wrongpass');
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument();
      }, { timeout: 2000 });

      expect(mockOnLogin).not.toHaveBeenCalled();
    });

    it('should not call onLogin with empty fields', async () => {
      render(<LoginForm onLogin={mockOnLogin} />);

      const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
      
      // HTML5 validation should prevent submission
      fireEvent.submit(form);

      expect(mockOnLogin).not.toHaveBeenCalled();
    });

    it('should not include password in onLogin callback', async () => {
      const user = userEvent.setup();
      render(<LoginForm onLogin={mockOnLogin} />);

      await user.type(screen.getByLabelText(/username/i), 'admin');
      await user.type(screen.getByLabelText(/password/i), 'admin123');
      
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalled();
        const calledWith = mockOnLogin.mock.calls[0][0];
        expect(calledWith.password).toBeUndefined();
      }, { timeout: 2000 });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible form labels', () => {
      render(<LoginForm onLogin={mockOnLogin} />);

      const usernameInput = screen.getByLabelText(/username/i);
      const passwordInput = screen.getByLabelText(/password/i);

      expect(usernameInput).toHaveAttribute('id');
      expect(passwordInput).toHaveAttribute('id');
    });

    it('should have required attributes on inputs', () => {
      render(<LoginForm onLogin={mockOnLogin} />);

      expect(screen.getByLabelText(/username/i)).toBeRequired();
      expect(screen.getByLabelText(/password/i)).toBeRequired();
    });

    it('should have autocomplete attributes', () => {
      render(<LoginForm onLogin={mockOnLogin} />);

      expect(screen.getByLabelText(/username/i)).toHaveAttribute('autocomplete', 'username');
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('autocomplete', 'current-password');
    });
  });
});
