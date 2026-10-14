import { useEffect, useRef } from 'react';
import { Icon } from './Brand.jsx';

export function Modal({ title, onClose, children, wide = false }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (document.querySelector('.swal2-container:not(.swal2-toast-shown) .app-confirmation')) return;
      if (event.key === 'Escape') onCloseRef.current();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className={`modal-card${wide ? ' modal-card-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><Icon name="close" size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
