import React, { useState } from 'react';

// Demo users for authentication
const DEMO_USERS = [
  { id: 1, username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
  { id: 2, username: 'user', password: 'user123', name: 'John Doe', role: 'user' },
  { id: 3, username: 'guest', password: 'guest123', name: 'Guest User', role: 'guest' },
];

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const user = DEMO_USERS.find(
      u => u.username === username && u.password === password
    );

    if (user) {
      const { password: _, ...userWithoutPassword } = user;
      onLogin(userWithoutPassword);
    } else {
      setError('Invalid username or password');
    }

    setIsLoading(false);
  };

  return (
    <div className="login-form-container">
      <div className="mfe-header">
        <h2>🔐 Login</h2>
        <p>Sign in to access the application</p>
      </div>

      <form onSubmit={handleSubmit} className="login-form">
        {error && <div className="alert alert-error">{error}</div>}
        
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            required
            autoComplete="username"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="current-password"
          />
        </div>

        <button type="submit" className="btn-primary" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="demo-credentials">
        <h4>Demo Credentials:</h4>
        <ul>
          <li><strong>Admin:</strong> admin / admin123</li>
          <li><strong>User:</strong> user / user123</li>
          <li><strong>Guest:</strong> guest / guest123</li>
        </ul>
      </div>
    </div>
  );
}

export default LoginForm;
