//! Profiles by kind of activity (7.4n): for the activities frequent in Romania, the modules that fit, the work
//! profile of the sidebar and the built-in document models that are most useful. Choosing one only proposes:
//! the person sees every module with the permissions it asks for, ticks what they want and enables it; nothing
//! is enabled on its own, and every module can still be enabled or disabled from the Catalog. When „Permise și
//! autorizații” is on, the picker then proposes the procedures of the catalog (D-088) tagged with the activity
//! (7.9c). The firm-specific modules (recycling, the owner's own ERP) are separate and are not part of these
//! profiles.

use serde::Serialize;

#[derive(Clone, Copy, Debug, Serialize)]
pub struct Activity {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    /// The modules proposed, in the order they are shown.
    pub modules: &'static [&'static str],
    /// The work profile set with it (`modules::PROFILES`).
    pub profile: &'static str,
    /// The keys of the built-in models of „Documente și modele” shown first.
    pub models: &'static [&'static str],
}

pub const ACTIVITIES: &[Activity] = &[
    Activity {
        id: "comert",
        name: "Comerț",
        description: "Magazin, distribuție, vânzare en-gros: stocuri, facturi, oferte, comenzi și livrări.",
        modules: &[
            "kgb.business",
            "kgb.vault",
            "kgb.docs",
            "kgb.pdf",
            "kgb.sheets",
            "kgb.extract",
            "kgb.permits",
            "kgb.planner",
            "kgb.calc",
        ],
        profile: "depozit",
        models: &[
            "pdf-nir",
            "pdf-oferta",
            "oferta",
            "pdf-contract-vanzare",
            "pdf-pv-predare-primire",
            "pdf-somatie-plata",
            "pdf-comanda-furnizor",
            "pdf-factura-proforma",
        ],
    },
    Activity {
        id: "constructii",
        name: "Construcții",
        description: "Șantiere și echipe: pontaj pe puncte de lucru, autorizații, recepții, proiecte cu termene.",
        modules: &[
            "kgb.business",
            "kgb.vault",
            "kgb.works",
            "kgb.maintenance",
            "kgb.team",
            "kgb.permits",
            "kgb.planner",
            "kgb.docs",
            "kgb.pdf",
            "kgb.sheets",
            "kgb.write",
        ],
        profile: "proiecte",
        models: &[
            "pdf-pv-receptie",
            "pv-receptie",
            "contract-servicii",
            "pdf-oferta",
            "pdf-pv-predare-primire",
            "pdf-cerere-institutie",
            "pdf-pv-lucrari-ascunse",
        ],
    },
    Activity {
        id: "transport",
        name: "Transport",
        description: "Parc auto și șoferi cu actele care expiră, livrări urmărite, comenzi.",
        modules: &[
            "kgb.business",
            "kgb.vault",
            "kgb.maintenance",
            "kgb.contracts",
            "kgb.team",
            "kgb.permits",
            "kgb.docs",
            "kgb.pdf",
            "kgb.planner",
            "kgb.sheets",
        ],
        profile: "management",
        models: &[
            "contract-servicii",
            "pdf-pv-predare-primire",
            "pdf-imputernicire",
            "pdf-oferta",
            "pdf-comanda-furnizor",
        ],
    },
    Activity {
        id: "horeca",
        name: "HoReCa",
        description: "Restaurant, cafenea, pensiune: stocuri, pontaj pe ture, autorizații (DSV, ISU, mediu).",
        modules: &[
            "kgb.business",
            "kgb.vault",
            "kgb.maintenance",
            "kgb.recipes",
            "kgb.appointments",
            "kgb.team",
            "kgb.permits",
            "kgb.docs",
            "kgb.pdf",
            "kgb.sheets",
            "kgb.calc",
        ],
        profile: "depozit",
        models: &[
            "pdf-nir",
            "pdf-contract-inchiriere",
            "adeverinta-salariat",
            "pdf-decizie",
            "pdf-cerere-institutie",
            "pdf-comanda-furnizor",
        ],
    },
    Activity {
        id: "servicii",
        name: "Servicii",
        description: "Consultanță, IT, reparații, firme de servicii: oferte, contracte, facturi, proiecte.",
        modules: &[
            "kgb.business",
            "kgb.vault",
            "kgb.works",
            "kgb.appointments",
            "kgb.contracts",
            "kgb.docs",
            "kgb.write",
            "kgb.pdf",
            "kgb.planner",
            "kgb.notes",
            "kgb.calc",
        ],
        profile: "birou",
        models: &[
            "contract-servicii",
            "oferta",
            "pdf-oferta",
            "pdf-pv-receptie",
            "pdf-somatie-plata",
            "cerere",
            "pdf-fisa-interventie-service",
        ],
    },
    Activity {
        id: "productie",
        name: "Producție",
        description: "Ateliere și fabrici: stocuri pe depozite, echipe în ture, autorizații, planificare.",
        modules: &[
            "kgb.business",
            "kgb.vault",
            "kgb.works",
            "kgb.maintenance",
            "kgb.recipes",
            "kgb.team",
            "kgb.planner",
            "kgb.permits",
            "kgb.docs",
            "kgb.sheets",
            "kgb.pdf",
            "kgb.calc",
        ],
        profile: "depozit",
        models: &[
            "pdf-nir",
            "pdf-pv-receptie",
            "pdf-decizie",
            "adeverinta-salariat",
            "pdf-comanda-furnizor",
        ],
    },
    Activity {
        id: "agricultura",
        name: "Agricultură",
        description: "Ferme și asociații: stocuri, autorizații și termene, calcule și foi de calcul.",
        modules: &[
            "kgb.business",
            "kgb.vault",
            "kgb.permits",
            "kgb.calc",
            "kgb.sheets",
            "kgb.docs",
            "kgb.pdf",
            "kgb.planner",
        ],
        profile: "management",
        models: &[
            "pdf-contract-vanzare",
            "pdf-contract-inchiriere",
            "pdf-nir",
            "cerere",
            "pdf-contract-arendare",
            "pdf-contract-comodat",
        ],
    },
    Activity {
        id: "cabinet",
        name: "Cabinete și clinici",
        description: "Cabinete medicale, de avocatură, contabilitate: programări, documente, echipa.",
        modules: &[
            "kgb.appointments",
            "kgb.planner",
            "kgb.docs",
            "kgb.write",
            "kgb.pdf",
            "kgb.team",
            "kgb.permits",
            "kgb.business",
            "kgb.vault",
        ],
        profile: "birou",
        models: &[
            "contract-servicii",
            "cerere",
            "adeverinta-salariat",
            "pdf-imputernicire",
            "pdf-informare-date-personale",
        ],
    },
    Activity {
        id: "birou",
        name: "Birou și uz personal",
        description: "Documente, PDF-uri, foi de calcul, note și planificare, fără evidența firmei.",
        modules: &[
            "kgb.notes",
            "kgb.pdf",
            "kgb.sheets",
            "kgb.write",
            "kgb.calc",
            "kgb.planner",
            "kgb.docs",
            "kgb.contracts",
        ],
        profile: "personal",
        models: &[
            "cerere",
            "pdf-imputernicire",
            "pdf-contract-inchiriere",
            "pdf-informare-date-personale",
            "pdf-fisa-postului",
        ],
    },
    Activity {
        id: "auto",
        name: "Service auto și vulcanizare",
        description: "Ateliere auto: fișe de intervenție, piese și stocuri, programări, echipa, autorizarea RAR și deșeurile.",
        modules: &[
            "kgb.autoservice",
            "kgb.business",
            "kgb.vault",
            "kgb.appointments",
            "kgb.maintenance",
            "kgb.team",
            "kgb.permits",
            "kgb.docs",
            "kgb.pdf",
            "kgb.calc",
        ],
        profile: "depozit",
        models: &[
            "pdf-fisa-interventie-service",
            "pdf-oferta",
            "pdf-factura-proforma",
            "pdf-pv-predare-primire",
            "pdf-comanda-furnizor",
        ],
    },
    Activity {
        id: "educatie",
        name: "Educație și training",
        description: "Cursuri, after-school, centre de formare: programări, contracte cu părinții sau cursanții, documente, autorizații.",
        modules: &[
            "kgb.courses",
            "kgb.appointments",
            "kgb.contracts",
            "kgb.business",
            "kgb.docs",
            "kgb.write",
            "kgb.pdf",
            "kgb.planner",
            "kgb.team",
            "kgb.permits",
            "kgb.notes",
        ],
        profile: "birou",
        models: &[
            "contract-servicii",
            "pdf-informare-date-personale",
            "pdf-cerere-institutie",
            "pdf-declaratie-proprie-raspundere",
            "adeverinta-salariat",
        ],
    },
    Activity {
        id: "imobiliare",
        name: "Imobiliare și administrare",
        description: "Închirieri de spații, administrarea clădirilor: contracte facturate lunar, mentenanța clădirii, acte și autorizații.",
        modules: &[
            "kgb.contracts",
            "kgb.business",
            "kgb.vault",
            "kgb.maintenance",
            "kgb.permits",
            "kgb.docs",
            "kgb.pdf",
            "kgb.planner",
            "kgb.sheets",
            "kgb.calc",
        ],
        profile: "management",
        models: &[
            "pdf-contract-inchiriere",
            "pdf-contract-comodat",
            "pdf-pv-predare-primire",
            "pdf-notificare",
            "pdf-somatie-plata",
        ],
    },
    Activity {
        id: "it",
        name: "IT și servicii digitale",
        description: "Dezvoltare software, suport, agenții: proiecte și taskuri, contracte de mentenanță, oferte, documente.",
        modules: &[
            "kgb.planner",
            "kgb.contracts",
            "kgb.business",
            "kgb.docs",
            "kgb.write",
            "kgb.pdf",
            "kgb.notes",
            "kgb.sheets",
            "kgb.vault",
            "kgb.calc",
        ],
        profile: "proiecte",
        models: &[
            "contract-servicii",
            "pdf-oferta",
            "pdf-pv-receptie",
            "pdf-informare-date-personale",
            "pdf-fisa-postului",
        ],
    },
    Activity {
        id: "ong",
        name: "Asociații și fundații",
        description: "ONG-uri, cluburi, asociații: ședințe și hotărâri, proiecte, contracte, documente și foi de calcul.",
        modules: &[
            "kgb.docs",
            "kgb.write",
            "kgb.pdf",
            "kgb.planner",
            "kgb.notes",
            "kgb.sheets",
            "kgb.contracts",
            "kgb.business",
            "kgb.vault",
            "kgb.calc",
        ],
        profile: "management",
        models: &[
            "pdf-pv-sedinta",
            "pdf-decizie",
            "pdf-adresa",
            "pdf-contract-comodat",
            "pdf-informare-date-personale",
        ],
    },
    Activity {
        id: "frumusete",
        name: "Saloane și îngrijire personală",
        description: "Coafură, cosmetică, manichiură, masaj: programări, produse în stoc, echipa, autorizația sanitară.",
        modules: &[
            "kgb.appointments",
            "kgb.business",
            "kgb.team",
            "kgb.vault",
            "kgb.permits",
            "kgb.docs",
            "kgb.pdf",
            "kgb.calc",
        ],
        profile: "birou",
        models: &[
            "pdf-informare-date-personale",
            "contract-servicii",
            "pdf-nir",
            "adeverinta-salariat",
            "pdf-cerere-concediu",
        ],
    },
];

pub fn find(id: &str) -> Option<&'static Activity> {
    ACTIVITIES.iter().find(|a| a.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_activity_is_complete_and_uses_known_profiles() {
        let profiles = crate::modules::profile_ids();
        let mut ids = std::collections::BTreeSet::new();
        for a in ACTIVITIES {
            assert!(ids.insert(a.id), "{} de două ori", a.id);
            assert!(!a.name.is_empty() && !a.description.is_empty() && !a.modules.is_empty() && !a.models.is_empty());
            assert!(profiles.contains(&a.profile), "{}: profilul {}", a.id, a.profile);
            let mut seen = std::collections::BTreeSet::new();
            assert!(
                a.modules.iter().all(|m| seen.insert(*m)),
                "{}: un modul de două ori",
                a.id
            );
        }
        assert!(find("comert").is_some() && find("necunoscut").is_none());
    }
}
