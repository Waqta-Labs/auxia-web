import { Link } from 'react-router-dom';
import './breadcrumb.css';

// Migas de pan: items = [{ label, to? }]; el último es la pantalla actual (sin enlace).
export default function Breadcrumb({ label, items }) {
  return (
    <nav className="bc" aria-label={label}>
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.label}>
              {last || !item.to ? <span aria-current={last ? 'page' : undefined}>{item.label}</span> : <Link to={item.to}>{item.label}</Link>}
              {!last && <span className="bc__sep" aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
