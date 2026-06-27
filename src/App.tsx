import {
  Activity,
  Bone,
  Brain,
  ChevronDown,
  CircleUserRound,
  Coins,
  Download,
  Eye,
  Gauge,
  Handshake,
  HeartPulse,
  Map as MapIcon,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Send,
  ShieldAlert,
  StepForward,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ActivityPanel, type ActivityTab, LeftPanel, type LeftTab, WorldSummary } from './components/DashboardPanels';
import { CityScene } from './components/CityScene';
import { CountryFocusPanel } from './components/CountryFocusPanel';
import { WorldScene } from './components/WorldScene';
import { api } from './lib/api';
import type { AnatomyMode, OverlayMode, SimulationMode, WorldState } from './lib/types';

const scenarios = [
  { id: 'gold-rush', label: 'Gold rush', description: 'Scarce reserves and competitive sovereign buying', icon: Coins },
  { id: 'currency-crisis', label: 'Fiat crisis', description: 'Inflation, bank stress, and exchange-rate pressure', icon: Activity },
  { id: 'market-crash', label: 'Credit crash', description: 'Output, employment, and banking contraction', icon: Gauge },
  { id: 'resource-shock', label: 'Resource shock', description: 'Food, energy, climate, and commodity disruption', icon: HeartPulse },
  { id: 'rival-blocs', label: 'Rival blocs', description: 'Alliance, technology, military, and reserve competition', icon: Handshake },
  { id: 'deterrence', label: 'Deterrence test', description: 'Extreme fictional conflict with staged consequence review', icon: ShieldAlert },
  { id: 'recovery', label: 'Recovery compact', description: 'Ceasefire, aid, reconstruction, and financial stabilization', icon: RefreshCw }
];

function LoadingScreen({ error }: { error?: string }) {
  return (
    <div className="loading-screen">
      <div className="loading-mark"><span /><span /><span /><span /></div>
      <h1>COMMUNION</h1>
      <p>{error ?? 'Initializing the contained model civilization…'}</p>
    </div>
  );
}

export default function App() {
  const [world, setWorld] = useState<WorldState | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [leftTab, setLeftTab] = useState<LeftTab>('nations');
  const [activityTab, setActivityTab] = useState<ActivityTab>('thoughts');
  const [anatomyMode, setAnatomyMode] = useState<AnatomyMode>('exterior');
  const [overlay, setOverlay] = useState<OverlayMode>('political');
  const [selectedNationId, setSelectedNationId] = useState('nation-axiom');
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    let active = true;
    api.state().then((state) => active && setWorld(state)).catch((reason) => active && setError(reason instanceof Error ? reason.message : String(reason)));
    const stream = new EventSource('/api/stream');
    stream.addEventListener('state', (event) => {
      if (!active) return;
      try {
        setWorld(JSON.parse((event as MessageEvent).data) as WorldState);
        setError(undefined);
      } catch {
        // Ignore malformed network frames and keep the last valid snapshot.
      }
    });
    stream.onerror = () => setError('Live stream reconnecting…');
    return () => {
      active = false;
      stream.close();
    };
  }, []);

  const selectedNation = useMemo(
    () => world?.nations.find((nation) => nation.id === selectedNationId) ?? world?.nations[0],
    [selectedNationId, world]
  );

  const selectedCity = useMemo(() => {
    if (!selectedCityId || !world) return null;
    for (const nation of world.nations) {
      const settlement = nation.settlements?.find((item) => item.id === selectedCityId);
      if (settlement) return { settlement, nation };
    }
    return null;
  }, [selectedCityId, world]);

  async function control(action: 'run' | 'pause' | 'step' | 'reset' | 'speed', speed?: number) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await api.control(action, speed);
      setWorld(response.state);
      if (action === 'reset') {
        setSelectedNationId('nation-axiom');
        setSelectedCityId(null);
      }
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function setMode(mode: SimulationMode) {
    if (busy || mode === world?.mode) return;
    setBusy(true);
    try {
      const response = await api.mode(mode);
      setWorld(response.state);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function applyScenario(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await api.scenario(id);
      setWorld(response.state);
      setScenarioOpen(false);
      if (id === 'deterrence') {
        setLeftTab('conflict');
        setOverlay('conflict');
      }
      if (id === 'gold-rush' || id === 'currency-crisis' || id === 'market-crash') {
        setLeftTab('economy');
        setOverlay('gold');
      }
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function submitPrompt(event: FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const response = await api.prompt(text);
      setWorld(response.state);
      setPrompt('');
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!world) return <LoadingScreen error={error} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><span /><span /><span /><span /></div>
          <div><h1>COMMUNION</h1><p>Multi-model civilization laboratory</p></div>
        </div>

        <div className="simulation-meta">
          <span className={`live-dot ${world.running ? 'running' : ''}`} />
          <div><strong>{world.running ? 'LIVE AI FLOW ACTIVE' : 'LIVE AI FLOW PAUSED'}</strong><small>YEAR {world.year} · DAY {world.day} · FLOW {world.turn}</small></div>
        </div>

        <div className="provider-strip">
          {world.providerStatus.map((provider) => (
            <div className={`provider-pill ${provider.lastCall ?? provider.mode}`} key={provider.provider} title={provider.lastError || `${provider.model}${provider.latencyMs ? ` · ${provider.latencyMs}ms` : ''}`}>
              <span />
              <b>{provider.provider === 'google' ? 'GEMINI' : provider.provider.toUpperCase()}</b>
              <small>{provider.lastCall ?? provider.mode}</small>
            </div>
          ))}
        </div>

        <div className="top-controls">
          <button className="icon-button" onClick={() => void control(world.running ? 'pause' : 'run')} disabled={busy} title={world.running ? 'Pause' : 'Run'}>
            {world.running ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button className="icon-button" onClick={() => void control('step')} disabled={busy || world.running} title="Inject one autonomy frame"><StepForward size={17} /></button>
          <div className={`mode-control mode-${world.mode}`} title={world.mode === 'live' ? 'Strict live: unavailable providers block instead of falling back' : world.mode === 'hybrid' ? 'Hybrid: live providers act, unavailable providers use deterministic fallback' : 'Mock lab: deterministic local delegates'}>
            <Brain size={15} />
            <select value={world.mode} onChange={(event) => void setMode(event.target.value as SimulationMode)} disabled={busy}>
              <option value="hybrid">Hybrid flow</option>
              <option value="live">Strict live</option>
              <option value="mock">Mock lab</option>
            </select>
          </div>
          <div className="speed-control" title="Simulation speed">
            <Gauge size={15} />
            <select value={world.speed} onChange={(event) => void control('speed', Number(event.target.value))}>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
              <option value={8}>8×</option>
            </select>
          </div>
          <div className="scenario-control">
            <button className="scenario-button" onClick={() => setScenarioOpen((value) => !value)}><ShieldAlert size={15} /> Scenarios <ChevronDown size={14} /></button>
            {scenarioOpen && (
              <div className="scenario-menu">
                <header><strong>Contained stress tests</strong><button onClick={() => setScenarioOpen(false)}><X size={14} /></button></header>
                {scenarios.map((scenario) => {
                  const Icon = scenario.icon;
                  return <button key={scenario.id} onClick={() => void applyScenario(scenario.id)}><Icon size={17} /><div><strong>{scenario.label}</strong><small>{scenario.description}</small></div></button>;
                })}
              </div>
            )}
          </div>
          <button className="icon-button" onClick={() => void control('reset')} disabled={busy} title="Reset world"><RotateCcw size={17} /></button>
          <button className="icon-button" onClick={() => { window.location.href = '/api/export'; }} title="Export state"><Download size={17} /></button>
        </div>
      </header>

      <WorldSummary world={world} />

      <main className="workspace">
        <LeftPanel
          world={world}
          tab={leftTab}
          onTab={setLeftTab}
          selectedNationId={selectedNation?.id ?? world.nations[0].id}
          onSelectNation={setSelectedNationId}
        />

        <section className="world-viewport">
          <WorldScene
            world={world}
            anatomyMode={anatomyMode}
            overlay={overlay}
            selectedNationId={selectedNation?.id ?? world.nations[0].id}
            onSelectNation={setSelectedNationId}
          />

          <div className="viewport-title">
            <span className="nation-swatch" style={{ background: selectedNation?.color }} />
            <div><strong>{selectedNation?.name}</strong><small>{world.scenario}</small></div>
          </div>

          {selectedNation?.settlements?.length ? (
            <div className="city-strip glass-toolbar">
              <span><MapIcon size={15} /> CITIES</span>
              {selectedNation.settlements.slice(0, 6).map((settlement) => (
                <button key={settlement.id} onClick={() => setSelectedCityId(settlement.id)} title={`Dive into ${settlement.name}`}>
                  {settlement.name}
                </button>
              ))}
            </div>
          ) : null}

          {selectedNation && (
            <CountryFocusPanel
              world={world}
              nation={selectedNation}
              onSelectCity={setSelectedCityId}
            />
          )}

          <div className="anatomy-toolbar glass-toolbar">
            <span><CircleUserRound size={15} /> AVATAR</span>
            <button className={anatomyMode === 'exterior' ? 'active' : ''} onClick={() => setAnatomyMode('exterior')} title="Exterior"><Eye size={15} /> Exterior</button>
            <button className={anatomyMode === 'skeleton' ? 'active' : ''} onClick={() => setAnatomyMode('skeleton')} title="Skeleton"><Bone size={15} /> Skeleton</button>
            <button className={anatomyMode === 'organs' ? 'active' : ''} onClick={() => setAnatomyMode('organs')} title="Organs"><HeartPulse size={15} /> Organs</button>
            <button className={anatomyMode === 'xray' ? 'active' : ''} onClick={() => setAnatomyMode('xray')} title="X-ray"><ScanLine size={15} /> X-ray</button>
          </div>

          <div className="overlay-toolbar glass-toolbar">
            <span><MapIcon size={15} /> OVERLAY</span>
            <button className={overlay === 'political' ? 'active' : ''} onClick={() => setOverlay('political')}>Political</button>
            <button className={overlay === 'economy' ? 'active' : ''} onClick={() => setOverlay('economy')}>Growth</button>
            <button className={overlay === 'gold' ? 'active' : ''} onClick={() => setOverlay('gold')}>Gold</button>
            <button className={overlay === 'diplomacy' ? 'active' : ''} onClick={() => setOverlay('diplomacy')}>Diplomacy</button>
            <button className={overlay === 'conflict' ? 'active' : ''} onClick={() => setOverlay('conflict')}>Conflict</button>
          </div>

          <form className="observer-prompt" onSubmit={(event) => void submitPrompt(event)}>
            <div><Eye size={15} /><span>NONBINDING OBSERVER CHANNEL</span></div>
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Introduce a public question or scenario constraint…" maxLength={1200} />
            <button disabled={!prompt.trim() || busy} title="Send observer prompt"><Send size={15} /></button>
          </form>
        </section>

        <ActivityPanel world={world} tab={activityTab} onTab={setActivityTab} />
      </main>

      {selectedCity && (
        <CityScene settlement={selectedCity.settlement} nation={selectedCity.nation} world={world} onClose={() => setSelectedCityId(null)} />
      )}

      <footer className="statusbar">
        <div><span className="status-indicator" />Contained simulation: no external tools or authority</div>
        <div>Fiat and gold markets · institutional hierarchy · aggregate conflict effects · append-only audit</div>
        <div>{error ? <span className="error-text">{error}</span> : `Last state ${new Date(world.lastUpdated).toLocaleTimeString()}`}</div>
      </footer>
    </div>
  );
}
