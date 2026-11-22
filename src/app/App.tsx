import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { Home } from './Home';
import { ModeSelect } from '../features/setup/ModeSelect';
import { CreateScreen } from '../features/setup/CreateScreen';
import { GameScreen } from '../features/feed/GameScreen';
import { Settings } from './Settings';
const EventLab = lazy(() => import('../features/lab/EventLab').then((m) => ({ default: m.EventLab })));
const SimStatsScreen = lazy(() => import('../features/lab/SimStatsScreen').then((m) => ({ default: m.SimStatsScreen })));

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="p-8 text-mute">Loading…</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<ModeSelect />} />
        <Route path="/create" element={<CreateScreen />} />
        <Route path="/game/:id" element={<GameScreen />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/lab" element={<EventLab />} />
        <Route path="/lab/stats" element={<SimStatsScreen />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
