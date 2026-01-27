// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn((key) => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock CustomEvent
global.CustomEvent = class CustomEvent extends Event {
  constructor(type, { detail } = {}) {
    super(type);
    this.detail = detail;
  }
};

// Clear mocks before each test
beforeEach(() => {
  sessionStorageMock.clear();
  jest.clearAllMocks();
});
