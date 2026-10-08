import { useEffect, useRef } from 'react';

/** The calculator (CAS, graphics, geometry, 3D, tables, statistics, chemistry) is the same web page the iPad and Android
 * apps show. In the Windows app the main process shows it in a view over this slot; in a browser there is only a note. */
export function Calculator() {
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const api = window.api;
    const element = slot.current;
    if (!api || !element) return;
    const report = () => {
      const rect = element.getBoundingClientRect();
      api.calc.show({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
    };
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    window.addEventListener('resize', report);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', report);
      api.calc.hide();
    };
  }, []);

  return (
    <div className="page wide">
      <div ref={slot} className="calc-slot">
        {!window.api && <p className="muted" style={{ padding: 40 }}>Der Rechner läuft in der Windows-App. Im Browser öffnest du ihn unter /cas/mathe.html.</p>}
      </div>
    </div>
  );
}
