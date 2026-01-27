module.exports = {
  displayName: 'shared',
  testEnvironment: 'jsdom',
  rootDir: '.',
  testMatch: ['<rootDir>/__tests__/**/*.test.js'],
  moduleFileExtensions: ['js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};
