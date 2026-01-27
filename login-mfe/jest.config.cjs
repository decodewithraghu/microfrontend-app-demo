module.exports = {
  displayName: 'login-mfe',
  testEnvironment: 'jsdom',
  rootDir: '.',
  testMatch: ['<rootDir>/__tests__/**/*.test.{js,jsx}'],
  moduleFileExtensions: ['js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/main.jsx',
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
