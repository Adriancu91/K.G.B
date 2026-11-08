// Invitations and device approval (Etapa 6, step 6.2, D-058). The codes
// travel however people choose (message, e-mail, USB) until the network
// transport arrives (step 6.5). Nothing secret is in them: an invitation has
// a one-time token with an expiry, a request has the new PC's public key.
import { useState } from "react";
import { api, type JoinRequest, type Member, type OrgReply } from "../api";

type Run = (f: () => Promise<unknown>) => Promise<void>;

const when = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function CodeBox({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code-box">
      <textarea readOnly value={code} aria-label={label} rows={4} onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(code).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }
      >
        {copied ? "Copiat" : "Copiază"}
      </button>
    </div>
  );
}

/** Administrator: invite a person (shows the code once). */
export function InviteButton({ member, run }: { member: Member; run: Run }) {
  const [hours, setHours] = useState(72);
  const [open, setOpen] = useState(false);
  const [made, setMade] = useState<{ code: string; expires_ms: number } | null>(null);
  if (!open)
    return (
      <button className="link" onClick={() => setOpen(true)}>
        invită un PC
      </button>
    );
  return (
    <div className="invite-box" role="dialog" aria-label={`Invitație pentru ${member.name}`}>
      {made ? (
        <>
          <p>
            Trimite acest cod lui <strong>{member.name}</strong> (mesaj, e-mail, stick). E valabil până la {when(made.expires_ms)} și se poate folosi
            o singură dată. Nu conține parole sau chei secrete.
          </p>
          <CodeBox code={made.code} label="Codul invitației" />
        </>
      ) : (
        <div className="row wrap">
          <label>
            Valabilă{" "}
            <select value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Valabilitatea invitației">
              <option value={1}>1 oră</option>
              <option value={24}>1 zi</option>
              <option value={72}>3 zile</option>
              <option value={168}>7 zile</option>
            </select>
          </label>
          <button
            className="primary"
            onClick={() =>
              void run(async () => {
                const r = await api.inviteCreate(member.id, hours);
                setMade(r);
              })
            }
          >
            Creează invitația
          </button>
        </div>
      )}
      <button
        className="link"
        onClick={() => {
          setOpen(false);
          setMade(null);
        }}
      >
        închide
      </button>
    </div>
  );
}

/** Administrator: receive requests, compare fingerprints, approve or refuse. */
export function Requests({ org, run }: { org: OrgReply; run: Run }) {
  const [code, setCode] = useState("");
  return (
    <section>
      <h3>Calculatoare noi</h3>
      <form
        className="row wrap"
        aria-label="Primește o cerere"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api.requestReceive(code);
            setCode("");
          });
        }}
      >
        <textarea
          placeholder="Lipește aici codul de cerere primit de la calculatorul nou (începe cu KGB-CERERE-1:)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Codul cererii"
          rows={2}
          required
        />
        <button type="submit">Primește cererea</button>
      </form>
      {org.pending.length > 0 && (
        <table className="audit pending-table">
          <thead>
            <tr>
              <th>Persoana</th>
              <th>Calculatorul</th>
              <th>Amprenta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {org.pending.map((p) => (
              <tr key={p.id}>
                <td>{p.member}</td>
                <td>{p.label}</td>
                <td className="fingerprint">{p.fingerprint}</td>
                <td>
                  <button
                    className="primary"
                    onClick={() => {
                      if (window.confirm(`Pe calculatorul lui ${p.member} scrie aceeași amprentă, ${p.fingerprint}? Aprobă doar dacă e identică.`))
                        void run(() => api.requestApprove(p.id));
                    }}
                  >
                    Aprobă
                  </button>{" "}
                  <button className="link" onClick={() => void run(() => api.requestRefuse(p.id))}>
                    refuză
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {org.invites.length > 0 && (
        <>
          <h4>Invitații</h4>
          <table className="audit invites-table">
            <thead>
              <tr>
                <th>Pentru</th>
                <th>Valabilă până la</th>
                <th>Stare</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {org.invites.map((i) => (
                <tr key={i.id}>
                  <td>{i.member}</td>
                  <td>{when(i.expires_ms)}</td>
                  <td>{i.stare}</td>
                  <td>
                    {i.stare === "activă" && (
                      <button className="link" onClick={() => void run(() => api.inviteCancel(i.id))}>
                        anulează
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

/** New PC (no organization here): answer an invitation. */
export function JoinOrg({ run }: { run: Run }) {
  const [code, setCode] = useState("");
  const [answer, setAnswer] = useState<JoinRequest | null>(null);
  return (
    <section>
      <h3>Ai primit o invitație?</h3>
      <form
        className="row wrap"
        aria-label="Răspunde la invitație"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => setAnswer(await api.inviteAnswer(code)));
        }}
      >
        <textarea
          placeholder="Lipește aici codul invitației (începe cu KGB-INVITATIE-1:)"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-label="Codul invitației primite"
          rows={2}
          required
        />
        <button type="submit">Verifică invitația</button>
      </form>
      {answer && (
        <div className="join-answer" role="status">
          <p>
            Invitație valabilă de la <strong>{answer.info.org_name}</strong>, pentru <strong>{answer.info.member}</strong> (semnată de calculatorul cu
            amprenta {answer.info.admin_fingerprint}).
          </p>
          <p>Trimite înapoi administratorului acest cod de cerere:</p>
          <CodeBox code={answer.code} label="Codul cererii" />
          <p>
            Amprenta acestui calculator: <strong className="fingerprint">{answer.fingerprint}</strong>. Administratorul trebuie să vadă exact aceeași
            amprentă înainte să aprobe.
          </p>
          <p className="muted small">
            După aprobare, datele organizației ajung pe acest calculator prin sincronizare, care se construiește în pașii următori ai Etapei 6.
          </p>
        </div>
      )}
    </section>
  );
}
