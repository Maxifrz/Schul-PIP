import { useEffect, useMemo, useState } from 'react';
import { RemoteModel, checkEndpoint, curatedModels, defaultSelection, endpointMessage, fetchModels, keyPlaceholder, keyPortal, modelNote, modelListNeedsKey, providerName, providers, searchModels } from '../lib/llm';
import type { Provider } from '../lib/llm';
import { doFetch, openExternal, secrets } from '../lib/platform';
import { deleteKey, fail, keyAccount, saveKey, settingsStore } from '../store/app';
import { forgetServer, social } from '../store/social';
import { Caption, ConfirmDialog, Dialog, PageHeader } from '../ui/kit';

export function Settings() {
  const { selection, customUrl, providersWithKey } = settingsStore.use();
  const server = social.use().server;
  const [picking, setPicking] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const endpoint = checkEndpoint(customUrl);
  const hasKey = (p: Provider) => (p === 'custom' ? endpoint.kind === 'valid' : providersWithKey.includes(p));
  const label = curatedModels[selection.provider].find((m) => m.id === selection.model)?.name ?? (selection.model || 'Keins gewählt');

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <PageHeader caption={`Version ${window.api?.version ?? 'Entwicklung'}`} title="Einstellungen" />

      <Caption>KI für den Check im Tafelbild</Caption>
      <div className="tabs" style={{ margin: '10px 0 14px' }}>
        {providers.map((p) => (
          <button key={p} className={`pill ${p === selection.provider ? 'on' : ''}`} onClick={() => settingsStore.set({ selection: defaultSelection(p) })}>
            {providerName[p]}
          </button>
        ))}
      </div>
      <div className="card row">
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{label}</div>
          <div className="muted small">{selection.model || 'Wähl ein Modell oder tipp seine ID ein.'}</div>
        </div>
        <button className="btn outline small" onClick={() => setPicking(true)}>Modell wählen</button>
      </div>
      {!hasKey(selection.provider) && (
        <p className="small" style={{ color: 'var(--warn)' }}>
          {selection.provider === 'custom' ? 'Für die eigene API fehlt noch die Adresse (unten).' : `Für ${providerName[selection.provider]} ist noch kein API-Key hinterlegt (unten).`}
        </p>
      )}

      <h2 className="section"><Caption>API-Keys</Caption></h2>
      <div className="col">
        {providers.filter((p) => p !== 'custom').map((p) => (
          <KeyRow key={p} provider={p} stored={providersWithKey.includes(p)} />
        ))}
        <div className="card col">
          <div className="row">
            <strong className="grow">{providerName.custom}</strong>
            <span className="faint small">Server im Heimnetz, Ollama, Hugging Face …</span>
          </div>
          <input className="field" placeholder="https://router.huggingface.co/v1" value={customUrl} onChange={(e) => settingsStore.set({ customUrl: e.target.value })} />
          {endpointMessage(endpoint) && customUrl !== '' && <span className="small" style={{ color: 'var(--warn)' }}>{endpointMessage(endpoint)}</span>}
          <KeyRow provider="custom" stored={providersWithKey.includes('custom')} bare />
        </div>
      </div>
      <p className="faint small">Keys liegen nur auf diesem PC, verschlüsselt mit deinem Windows-Konto. Ein Claude-Pro-Abo enthält keinen API-Zugang.</p>

      <h2 className="section"><Caption>Kurse-Server</Caption></h2>
      <div className="card row">
        <div className="grow">
          <div style={{ fontWeight: 600 }}>{server ? 'Verbunden' : 'Nicht verbunden'}</div>
          <div className="muted small mono">{server?.url ?? 'Adresse und Schlüssel trägst du im Kurse-Tab ein.'}</div>
        </div>
        {server && <button className="btn outline small" onClick={() => setForgetting(true)}>Server entfernen</button>}
      </div>

      {picking && <ModelPicker onClose={() => setPicking(false)} />}
      {forgetting && <ConfirmDialog title="Server entfernen?" text="Du wirst abgemeldet. Die Daten auf dem Server bleiben." confirm="Entfernen" onConfirm={() => void forgetServer()} onClose={() => setForgetting(false)} />}
    </div>
  );
}

function KeyRow({ provider, stored, bare }: { provider: Provider; stored: boolean; bare?: boolean }) {
  const [input, setInput] = useState('');
  const body = stored ? (
    <div className="row">
      <span className="grow">{bare ? 'Key gespeichert' : providerName[provider]}</span>
      <button className="link muted" onClick={() => void deleteKey(provider)}>Entfernen</button>
    </div>
  ) : (
    <div className="row">
      {!bare && <strong style={{ width: 110 }}>{providerName[provider]}</strong>}
      <input className="field" type="password" placeholder={keyPlaceholder[provider]} value={input} onChange={(e) => setInput(e.target.value)} />
      <button
        className="btn small"
        disabled={input.trim() === ''}
        onClick={async () => {
          if (await saveKey(provider, input)) setInput('');
          else fail(new Error('Der Key konnte nicht gespeichert werden.'));
        }}
      >
        Speichern
      </button>
      {!bare && keyPortal[provider] && <button className="link" onClick={() => void openExternal(keyPortal[provider]!)}>Key holen</button>}
    </div>
  );
  return bare ? body : <div className="card">{body}</div>;
}

/** The curated models first; typing searches everything the provider offers right now. */
function ModelPicker({ onClose }: { onClose: () => void }) {
  const { selection, customUrl } = settingsStore.use();
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<RemoteModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const searching = query.trim() !== '';
  const hits = useMemo(() => searchModels(remote, query).slice(0, 80), [remote, query]);

  const load = async () => {
    setRemote([]);
    setFailure(null);
    const provider = selection.provider;
    const key = (await secrets.get(keyAccount(provider))) ?? '';
    const endpoint = checkEndpoint(customUrl);
    if (modelListNeedsKey(provider) && key === '') return setFailure('Für die Modellsuche braucht dieser Anbieter einen API-Key. Trag ihn unten ein.');
    if (provider === 'custom' && endpoint.kind !== 'valid') return setFailure('Trag zuerst die Adresse der eigenen API ein.');
    setLoading(true);
    try {
      setRemote(await fetchModels(provider, key, endpoint.kind === 'valid' ? endpoint.url : undefined, doFetch));
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.provider]);

  const pick = (model: string) => {
    settingsStore.set({ selection: { ...selection, model } });
    onClose();
  };

  return (
    <Dialog onClose={onClose}>
      <div className="col">
        <Caption>Modell · {providerName[selection.provider]}</Caption>
        <input className="field" autoFocus placeholder="Alle Modelle durchsuchen" value={query} onChange={(e) => setQuery(e.target.value)} />
        {loading && <span className="faint small">Lade die Modellliste von {providerName[selection.provider]} …</span>}
        {failure && (
          <div className="row small" style={{ color: 'var(--warn)' }}>
            <span className="grow">{failure}</span>
            <button className="link" onClick={() => void load()}>Nochmal</button>
          </div>
        )}
        {!loading && !failure && remote.length > 0 && !searching && <span className="faint small">{remote.length} Modelle verfügbar. Tipp einen Namen, um sie zu durchsuchen.</span>}
        <div className="col gap-s" style={{ maxHeight: 380, overflow: 'auto' }}>
          {searching
            ? hits.map((m) => (
                <button key={m.id} className="item" onClick={() => pick(m.id)}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div className="mono faint" style={{ fontSize: 12 }}>{m.id}</div>
                  {modelNote(m) && <div className="faint small">{modelNote(m)}</div>}
                </button>
              ))
            : curatedModels[selection.provider].map((m) => (
                <button key={m.id} className={`item ${m.id === selection.model ? 'on' : ''}`} onClick={() => pick(m.id)}>
                  <div style={{ fontWeight: 600 }}>{m.name}</div>
                  <div className="faint small">{m.note}</div>
                </button>
              ))}
          {searching && hits.length === 0 && !loading && <span className="faint small">{remote.length === 0 ? 'Die Modellliste ist noch leer.' : `Kein Modell passt zu „${query}“.`}</span>}
        </div>
        {!searching && (
          <div className="col gap-s">
            <span className="small muted">Oder die Modell-ID selbst eintippen:</span>
            <input className="field mono" placeholder="z. B. meta-llama/Llama-3.3-70B-Instruct" defaultValue={selection.model} onKeyDown={(e) => e.key === 'Enter' && pick((e.target as HTMLInputElement).value.trim())} />
          </div>
        )}
      </div>
    </Dialog>
  );
}
