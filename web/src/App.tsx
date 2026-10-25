import { Header } from './components/Header';
import { Wall } from './components/Wall';
import { useWall } from './hooks/useWall';

export function App() {
  const { data, loading, error, refresh } = useWall();

  return (
    <div className="app" data-testid="app">
      <Header onRefresh={refresh} loading={loading} />
      <Wall data={data} loading={loading} error={error} onRefresh={refresh} onExpire={refresh} />
      <footer className="app__footer">
        <p>Cada mensaje vive 24 horas.</p>
      </footer>
    </div>
  );
}
