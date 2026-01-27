// Root Jest Configuration for all MFEs
module.exports = {
  projects: [
    '<rootDir>/shared/jest.config.cjs',
    '<rootDir>/login-mfe/jest.config.cjs',
    '<rootDir>/weather-mfe/jest.config.cjs',
    '<rootDir>/population-mfe/jest.config.cjs',
  ],
  collectCoverageFrom: [
    '**/src/**/*.{js,jsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/src/main.jsx',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  verbose: true,
};
