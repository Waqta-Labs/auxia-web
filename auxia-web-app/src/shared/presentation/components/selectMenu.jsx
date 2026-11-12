import { useEffect, useId, useRef, useState } from 'react';
import './selectMenu.css';

// Menú desplegable propio (reemplaza al <select> nativo): mismo estilo en todos los navegadores, con teclado y lector de pantalla.
//  options = [{ value, label }]  ·  onChange(value)  ·  label = nombre accesible del campo
export default function SelectMenu({ value, options, onChange, label, className = '' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const id = useId();

  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const current = options[selectedIndex];

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const openMenu = () => { setActive(selectedIndex); setOpen(true); };
  const choose = (index) => {
    onChange(options[index].value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); openMenu(); }
      return;
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(options.length - 1, index + 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
    else if (event.key === 'Home') { event.preventDefault(); setActive(0); }
    else if (event.key === 'End') { event.preventDefault(); setActive(options.length - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
    else if (event.key === 'Tab') setOpen(false);
  };

  return (
    <div className={'sm ' + className} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="sm__button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        aria-activedescendant={open ? id + '-' + active : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="sm__value">{current?.label}</span>
        <svg className="sm__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <ul id={id} className="sm__list" role="listbox" aria-label={label}>
          {options.map((option, index) => (
            <li
              key={option.value}
              id={id + '-' + index}
              role="option"
              aria-selected={index === selectedIndex}
              className={'sm__option' + (index === active ? ' is-active' : '')}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {index === selectedIndex && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
