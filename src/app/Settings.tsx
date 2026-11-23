import { useRef, useState } from 'react';
import { Link } from 'react-router';
import pkg from '../../package.json';
import { Screen } from '../components/Screen';
import { useSettings } from '../store/settings';

export function Settings() {
  const { devTools, setDevTools } = useSettings();
  const taps = useRef(0);
  const [msg, setMsg] = useState('');
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <Screen title="Settings">
      <div className="flex flex-col gap-4">
        <section className="glass rounded-2xl p-4 text-sm leading-relaxed">
          <div className="font-display uppercase tracking-wider text-base mb-2">How to install</div>
          {isIos ? (
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open this page in <b>Safari</b>.</li>
              <li>Tap the <b>Share</b> button (square with an arrow).</li>
              <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              <li>Always open ICEHG from the home-screen icon, so your games are kept.</li>
            </ol>
          ) : (
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open this page in <b>Chrome</b>.</li>
              <li>Tap the <b>⋮</b> menu, then <b>Install app</b> (or <b>Add to Home screen</b>).</li>
              <li>Open ICEHG from the new icon.</li>
            </ol>
          )}
        </section>

        {devTools && (
          <section className="glass rounded-2xl p-4">
            <div className="font-display uppercase tracking-wider text-base mb-2">Developer tools</div>
            <div className="flex flex-col gap-2">
              <Link className="btn btn-ghost" to="/lab">
                Event Lab
              </Link>
              <Link className="btn btn-ghost" to="/lab/stats">
                Sim stats
              </Link>
              <button className="btn btn-ghost text-sm text-mute" onClick={() => setDevTools(false)}>
                Hide developer tools
              </button>
            </div>
          </section>
        )}

        <button
          className="text-center text-xs text-mute py-4 select-none"
          onClick={() => {
            taps.current++;
            if (devTools) return;
            const left = 7 - taps.current;
            if (left <= 0) {
              setDevTools(true);
              setMsg('Developer tools unlocked.');
            } else if (left <= 3) setMsg(`${left} more…`);
          }}
        >
          I Could Eat a Horse Games · version {pkg.version}
          {msg && <div className="text-gold mt-1">{msg}</div>}
        </button>
      </div>
    </Screen>
  );
}
