// Start page: what this workspace is and what works in this version.
import type { AppInfo, ModulesReply } from "../api";

export function Home(props: { info: AppInfo; modules: ModulesReply; onOpen: (id: string) => void }) {
  const { info, modules } = props;
  const enabled = modules.modules.filter((m) => m.enabled);
  return (
    <section>
      <p>
        Bun venit, <strong>{info.owner?.display_name}</strong>. Lucrezi în <strong>{info.workspace?.name}</strong>.
      </p>
      <div className="cards">
        <article className="card">
          <h3>Module active</h3>
          {enabled.length === 0 ? (
            <p className="muted">
              Niciun modul activat. Deschide <button className="link" onClick={() => props.onOpen("catalog")}>Catalogul de module</button>.
            </p>
          ) : (
            <ul className="plain">
              {enabled.map((m) => (
                <li key={m.id}>
                  <button className="link" onClick={() => props.onOpen(m.id)}>
                    {m.name}
                  </button>{" "}
                  <span className="muted">({m.records} înregistrări)</span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="card">
          <h3>Ce face această versiune</h3>
          <ul className="plain">
            <li>Salvează spațiul de lucru, setările și datele modulelor pe acest PC, fără bază de date și fără cloud.</li>
            <li>Activează și dezactivează module; datele rămân la dezactivare.</li>
            <li>Verifică permisiunile modulelor și notează refuzurile în jurnalul de audit.</li>
          </ul>
          <p className="muted">
            Documentele, taskurile, business-ul și sincronizarea între PC-uri vin în etapele următoare și apar în
            catalog ca „Neimplementat”.
          </p>
        </article>
      </div>
    </section>
  );
}
