import { RouterProvider } from 'react-router-dom';
import AppProviders from '@app/providers/appProviders.jsx';
import router from '@app/router/index.jsx';

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
