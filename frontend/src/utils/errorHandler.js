import { toast } from 'react-toastify';

const ERROR_MESSAGES = {
  NETWORK: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Session expired. Please log in again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER: 'Server error. Please try again later.',
  UNKNOWN: 'An unexpected error occurred.',
};

export function handleApiError(error, options = {}) {
  const { silent = false, redirect = true } = options;

  let message = ERROR_MESSAGES.UNKNOWN;
  let shouldRedirect = false;

  if (!error.response) {
    message = ERROR_MESSAGES.NETWORK;
  } else {
    const status = error.response.status;

    switch (status) {
      case 401:
        message = ERROR_MESSAGES.UNAUTHORIZED;
        if (redirect) {
          shouldRedirect = true;
          localStorage.clear();
        }
        break;
      case 403:
        message = ERROR_MESSAGES.FORBIDDEN;
        break;
      case 404:
        message = ERROR_MESSAGES.NOT_FOUND;
        break;
      case 500:
      case 502:
      case 503:
        message = ERROR_MESSAGES.SERVER;
        break;
      default:
        message =
          error.response.data?.detail || error.response.data?.message || ERROR_MESSAGES.UNKNOWN;
    }
  }

  if (!silent) {
    toast.error(message);
  }

  if (shouldRedirect) {
    window.location.href = '/login';
  }

  return { message, status: error.response?.status };
}

export function handleWebSocketError(error, options = {}) {
  const { silent = false } = options;

  if (!silent) {
    toast.error('Connection lost. Attempting to reconnect...');
  }
}

export default { handleApiError, handleWebSocketError };
