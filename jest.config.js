export default {
  testEnvironment: 'node',
  transform: {},
  testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
  setupFiles: ['./jest.setup.js'],

  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
  ],
};
