import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

let confirmationPending = false;
export async function confirmAction({ title, text, confirmText = 'Confirm', danger = false }) {
  if (confirmationPending) return false;
  if (showingToast) { Swal.close(); }
  confirmationPending = true;
  try {
    const result = await Swal.fire({
      title, text, icon: danger ? 'warning' : 'question',
      showCancelButton: true, confirmButtonText: confirmText, cancelButtonText: 'Cancel',
      reverseButtons: true, focusCancel: danger, returnFocus: true,
      allowOutsideClick: false, stopKeydownPropagation: true, keydownListenerCapture: true,
      customClass: { popup: 'app-confirmation', confirmButton: danger ? 'app-confirm-danger' : 'app-confirm-primary' },
    });
    return result.isConfirmed;
  } finally {
    confirmationPending = false;
    drainToasts();
  }
}

// Queue notifications until the active confirmation has finished.
const toastQueue = [];
let showingToast = false;
export function showToast(message, icon = 'success') {
  if (!message) return;
  toastQueue.push({ message, icon });
  drainToasts();
}
async function drainToasts() {
  if (showingToast || confirmationPending || !toastQueue.length) return;
  showingToast = true;
  const { message, icon } = toastQueue.shift();
  await Swal.fire({ toast: true, position: 'top-end', icon, titleText: message,
    showConfirmButton: false, showCloseButton: true, timer: icon === 'error' ? 6500 : 4000,
    timerProgressBar: true, customClass: { popup: 'app-toast' },
    didOpen: (popup) => { popup.addEventListener('mouseenter', Swal.stopTimer); popup.addEventListener('mouseleave', Swal.resumeTimer); },
  });
  showingToast = false;
  drainToasts();
}
