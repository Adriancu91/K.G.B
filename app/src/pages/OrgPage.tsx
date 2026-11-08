// Organization, people and roles (Etapa 6, step 6.1, D-056). Without an
// organization the workspace belongs to one person; creating one makes this
// PC the first administrator's device. Devices of other people join through
// invitations (step 6.2).
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ACCESS_LABEL, api, message, type Access, type Member, type OrgReply, type Role } from "../api";

const ACCESSES: Access[] = ["niciunul", "citire", "scriere"];

export function OrgPage({ onError, onChanged }: { onError: (e: string | null) => void; onChanged: () => void }) {
  const [org, setOrg] = useState<OrgReply | null>(null);

  const load = useCallback(async () => {
    try {
      setOrg(await api.org());
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);
  useEffect(() => {
    void load();
  }, [load]);

  const run = async (f: () => Promise<unknown>) => {
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    }
    await load();
    onChanged();
  };

  if (!org) return <p className="muted">Se încarcă…</p>;
  if (!org.organization) return <CreateOrg org={org} run={run} />;

  const admin = org.current?.role.admin ?? false;
  return (
    <div className="org-page">
      <OrgHeader org={org} admin={admin} run={run} />
      {!admin && <p className="muted">Doar un administrator poate schimba persoanele și rolurile.</p>}
      <Members org={org} admin={admin} run={run} />
      <Roles org={org} admin={admin} run={run} />
    </div>
  );
}

type Run = (f: () => Promise<unknown>) => Promise<void>;

function CreateOrg({ org, run }: { org: OrgReply; run: Run }) {
  const [name, setName] = useState("");
  const [admin, setAdmin] = useState(org.owner_name ?? "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.orgCreate(name, admin));
  };
  return (
    <div className="org-page">
      <p>
        Acum spațiul de lucru e al unei singure persoane, care poate face totul. Creează o organizație când vrei să lucrezi cu alți oameni: tu devii
        administrator, iar acest PC devine dispozitivul tău.
      </p>
      <form className="row wrap" onSubmit={submit} aria-label="Creează organizația">
        <label>
          Numele organizației <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Numele tău (administrator) <input value={admin} onChange={(e) => setAdmin(e.target.value)} required />
        </label>
        <button className="primary" type="submit">
          Creează organizația
        </button>
      </form>
      <p className="muted small">
        Alți oameni și calculatoarele lor se adaugă prin invitații (pasul următor al Etapei 6). Sincronizarea între PC-uri nu funcționează încă.
      </p>
    </div>
  );
}

function OrgHeader({ org, admin, run }: { org: OrgReply; admin: boolean; run: Run }) {
  const o = org.organization!;
  const [name, setName] = useState(o.name);
  useEffect(() => setName(o.name), [o.name]);
  return (
    <section>
      {admin ? (
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => api.orgRename(name, o.version));
          }}
        >
          <label>
            Organizația <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <button type="submit" disabled={name === o.name}>
            Redenumește
          </button>
        </form>
      ) : (
        <h2>{o.name}</h2>
      )}
      <p role="status" className="org-current">
        {org.current ? (
          <>
            Pe acest PC: <strong>{org.current.member.name}</strong>, rol <strong>{org.current.role.name}</strong>
          </>
        ) : (
          "Acest PC nu aparține nimănui din organizație: modulele nu se deschid."
        )}
        <span className="muted small"> · amprenta PC-ului: {org.fingerprint}</span>
      </p>
    </section>
  );
}

function Members({ org, admin, run }: { org: OrgReply; admin: boolean; run: Run }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(org.roles.find((r) => r.name === "Membru")?.id ?? org.roles[0]?.id ?? "");
  const roleName = (id: string) => org.roles.find((r) => r.id === id)?.name ?? "—";
  return (
    <section>
      <h3>Persoane</h3>
      <table className="audit members-table">
        <thead>
          <tr>
            <th>Nume</th>
            <th>Rol</th>
            <th>Dispozitive</th>
            {admin && <th></th>}
          </tr>
        </thead>
        <tbody>
          {org.members.map((m) => (
            <MemberRow key={m.id} m={m} org={org} admin={admin} roleName={roleName} run={run} />
          ))}
        </tbody>
      </table>
      {admin && (
        <form
          className="row wrap"
          aria-label="Adaugă o persoană"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.memberAdd(name, role);
              setName("");
            });
          }}
        >
          <input placeholder="Nume" value={name} onChange={(e) => setName(e.target.value)} required aria-label="Numele persoanei" />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rolul persoanei">
            {org.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button type="submit">Adaugă persoana</button>
        </form>
      )}
    </section>
  );
}

function MemberRow(props: { m: Member; org: OrgReply; admin: boolean; roleName: (id: string) => string; run: Run }) {
  const { m, org, admin, run } = props;
  const here = m.devices.includes(org.fingerprint);
  return (
    <tr>
      <td>
        {m.name}
        {here && <span className="muted small"> (acest PC)</span>}
      </td>
      <td>
        {admin ? (
          <select
            value={m.role}
            aria-label={`Rolul lui ${m.name}`}
            onChange={(e) => void run(() => api.memberUpdate(m.id, m.name, e.target.value, m.version))}
          >
            {org.roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          props.roleName(m.role)
        )}
      </td>
      <td className="num">{m.devices.length === 0 ? <span className="muted">niciunul încă</span> : m.devices.length}</td>
      {admin && (
        <td>
          {!here && (
            <button
              className="link"
              onClick={() => {
                if (window.confirm(`Scoți pe ${m.name} din organizație? Dispozitivele lui nu mai pot deschide modulele.`))
                  void run(() => api.memberRemove(m.id, m.version));
              }}
            >
              scoate
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

function Roles({ org, admin, run }: { org: OrgReply; admin: boolean; run: Run }) {
  const [newName, setNewName] = useState("");
  return (
    <section>
      <h3>Roluri și acces la module</h3>
      <div className="table-scroll">
        <table className="audit roles-table">
          <thead>
            <tr>
              <th>Modul</th>
              {org.roles.map((r) => (
                <th key={r.id}>
                  {r.name}
                  {admin && !r.builtin && (
                    <>
                      {" · "}
                      <button className="link small" onClick={() => void run(() => api.roleDelete(r.id))} aria-label={`Șterge rolul ${r.name}`}>
                        șterge
                      </button>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Organizația (persoane, roluri, module)</td>
              {org.roles.map((r) => (
                <td key={r.id}>{r.admin ? "da" : "nu"}</td>
              ))}
            </tr>
            {org.modules.map(([id, name]) => (
              <tr key={id}>
                <td>{name}</td>
                {org.roles.map((r) => (
                  <td key={r.id}>
                    <AccessCell role={r} module={id} editable={admin && !r.admin} run={run} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {admin && (
        <form
          className="row wrap"
          aria-label="Rol nou"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api.roleSave({ name: newName, default: "niciunul", modules: {}, version: 0 });
              setNewName("");
            });
          }}
        >
          <input placeholder="Rol nou (de ex. Contabil)" value={newName} onChange={(e) => setNewName(e.target.value)} required aria-label="Numele rolului nou" />
          <button type="submit">Adaugă rolul</button>
          <span className="muted small">Un rol nou pornește fără acces; alege apoi accesul pe fiecare modul.</span>
        </form>
      )}
    </section>
  );
}

function AccessCell({ role, module, editable, run }: { role: Role; module: string; editable: boolean; run: Run }) {
  const value: Access = role.admin ? "scriere" : (role.modules[module] ?? role.default);
  if (!editable) return <>{ACCESS_LABEL[value]}</>;
  return (
    <select
      value={value}
      aria-label={`${role.name}: ${module}`}
      onChange={(e) =>
        void run(() =>
          api.roleSave({
            id: role.id,
            name: role.name,
            default: role.default,
            modules: { ...role.modules, [module]: e.target.value as Access },
            version: role.version,
          }),
        )
      }
    >
      {ACCESSES.map((a) => (
        <option key={a} value={a}>
          {ACCESS_LABEL[a]}
        </option>
      ))}
    </select>
  );
}
