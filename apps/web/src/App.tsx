import { Navigate, Route, Routes } from 'react-router-dom';

import './App.css';
import { AppShell } from './components/AppShell';
import { HomePage } from './pages/HomePage';
import { LadderPage } from './pages/LadderPage';

const App = () => (
  <Routes>
    <Route element={<AppShell />}>
      <Route index element={<HomePage />} />
      <Route path="ladder/:callId" element={<LadderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  </Routes>
);

export default App;
