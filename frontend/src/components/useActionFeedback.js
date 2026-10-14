import { useEffect, useRef } from 'react';
import { showToast } from '../services/alerts.js';

export function useActionFeedback(message, error) {
  const previous = useRef({ message: '', error: '' });
  useEffect(() => {
    if (message && message !== previous.current.message) showToast(message);
    if (error && error !== previous.current.error) showToast(error, 'error');
    previous.current = { message, error };
  }, [message, error]);
}
