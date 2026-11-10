import { Outlet } from 'react-router-dom';
import Sidebar from './sidebar.jsx';
import Topbar from './topbar.jsx';
import './commandCenter.css';

export default function CommandCenterLayout() {
  return (
    <div className="cc">
      <Sidebar />
      <div className="cc__main">
        <Topbar />
        <main className="cc__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
