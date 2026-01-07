/**
 * Application constants
 * Centralizes numbers and configuration values for maintainability
 */

// SWAPANZA FEATURE CONSTANTS

export const SWAPANZA = {
  /** Number of seconds before a Swapanza invite expires */
  INVITE_TIMEOUT_SECONDS: 30,

  /** Maximum messages each user can send during a Swapanza session */
  MESSAGE_LIMIT: 2,

  /** Available duration options in minutes for Swapanza sessions */
  DURATION_OPTIONS: [5, 10, 15],

  /** Default duration in minutes when starting a new Swapanza */
  DEFAULT_DURATION_MINUTES: 5,
};

// POLLING & INTERVALS

export const INTERVALS = {
  /** How often to check if the auth token is expired (ms) */
  TOKEN_CHECK_MS: 30000,

  /** How often to poll for global Swapanza state changes (ms) */
  SWAPANZA_STATE_CHECK_MS: 5000,

  /** Interval for countdown timer updates (ms) */
  COUNTDOWN_TICK_MS: 1000,

  /** Maximum delay for WebSocket reconnection backoff (ms) */
  WS_MAX_RECONNECT_DELAY_MS: 30000,
};

// FILE UPLOAD CONSTRAINTS

export const FILE_UPLOAD = {
  /** Maximum file size for profile images in bytes (5MB) */
  MAX_PROFILE_IMAGE_SIZE_BYTES: 5 * 1024 * 1024,

  /** Allowed MIME types for profile images */
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
};

// UI CONSTANTS

export const UI = {
  /** Toast notification auto-close duration (ms) */
  TOAST_AUTO_CLOSE_MS: 4000,

  /** Debounce delay for search input (ms) */
  SEARCH_DEBOUNCE_MS: 300,
};

// API ENDPOINTS (relative to base URL)

export const API_ENDPOINTS = {
  TOKEN: '/api/token/',
  TOKEN_REFRESH: '/api/token/refresh/',
  USERS_CREATE: '/api/users/create/',
  PROFILE: '/api/profile/',
  CHATS: '/api/chats/',
  UNREAD_COUNTS: '/api/unread-counts/',
  SEARCH_USERS: '/api/users/',
  SWAPANZA_STATE: '/api/swapanza-state/',
};

// WEBSOCKET PATHS

export const WS_PATHS = {
  CHAT: (chatId, token) => `/ws/chat/${chatId}/?token=${token}`,
  NOTIFICATIONS: (token) => `/ws/notifications/?token=${token}`,
};

// WEBSOCKET CODES

export const WS_CODES = {
  /** Normal closure - connection closed cleanly */
  NORMAL_CLOSURE: 1000,

  /** Base multiplier for exponential backoff reconnect (ms) */
  RECONNECT_BASE_MS: 1000,
};
