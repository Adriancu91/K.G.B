//! Errors of the core services. Messages are in Romanian because they reach
//! the user; they never contain record content or secrets.

use std::fmt;
use std::io;
use std::path::PathBuf;

#[derive(Debug)]
pub enum CoreError {
    Io(io::Error),
    Store(kgb_store::Error),
    /// Another K.G.B. window already has this workspace open.
    WorkspaceInUse(PathBuf),
    /// The workspace is inside a cloud-synchronised folder (OneDrive, Dropbox…).
    UnsafeLocation(PathBuf),
    /// `workspace.json` is unreadable. Nothing was changed or deleted.
    WorkspaceManifestCorrupt {
        path: PathBuf,
        detail: String,
    },
    /// The workspace was written by a newer K.G.B. version.
    WorkspaceTooNew {
        path: PathBuf,
        format: u32,
        supported: u32,
    },
    NotAWorkspace(PathBuf),
    AlreadyExists(PathBuf),
    ModuleNotFound(String),
    /// The module is shipped but withdrawn (status `disabled`).
    ModuleUnavailable(String),
    ModuleIncompatible {
        module: String,
        requires: String,
        core: String,
    },
    ModuleNotEnabled(String),
    /// A module tried something it was not granted. Always audited.
    PermissionDenied {
        module: String,
        permission: String,
        detail: String,
    },
    /// A value failed validation (settings, manifests, user input).
    Invalid {
        what: String,
        detail: String,
    },
}

pub type CoreResult<T> = Result<T, CoreError>;

impl CoreError {
    pub fn invalid(what: impl Into<String>, detail: impl Into<String>) -> CoreError {
        CoreError::Invalid {
            what: what.into(),
            detail: detail.into(),
        }
    }
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CoreError::Io(e) => write!(f, "eroare de fișier: {e}"),
            CoreError::Store(e) => write!(f, "eroare de stocare: {e}"),
            CoreError::WorkspaceInUse(p) => {
                write!(
                    f,
                    "spațiul de lucru {} este deja deschis în altă fereastră K.G.B.",
                    p.display()
                )
            }
            CoreError::UnsafeLocation(p) => write!(
                f,
                "spațiul de lucru {} este într-un folder sincronizat în cloud (OneDrive, Dropbox…); \
                 alege un folder local",
                p.display()
            ),
            CoreError::WorkspaceManifestCorrupt { path, detail } => write!(
                f,
                "fișierul {} este deteriorat ({detail}); nu a fost modificat și nimic nu a fost șters",
                path.display()
            ),
            CoreError::WorkspaceTooNew {
                path,
                format,
                supported,
            } => write!(
                f,
                "spațiul de lucru {} are formatul {format}, dar această versiune K.G.B. știe doar până la {supported}; \
                 actualizează aplicația",
                path.display()
            ),
            CoreError::NotAWorkspace(p) => write!(f, "{} nu este un spațiu de lucru K.G.B.", p.display()),
            CoreError::AlreadyExists(p) => write!(f, "{} există deja", p.display()),
            CoreError::ModuleNotFound(m) => write!(f, "modulul {m} nu există"),
            CoreError::ModuleUnavailable(m) => write!(f, "modulul {m} a fost retras și nu poate fi activat"),
            CoreError::ModuleIncompatible { module, requires, core } => write!(
                f,
                "modulul {module} cere nucleul {requires}, dar nucleul instalat este {core}"
            ),
            CoreError::ModuleNotEnabled(m) => write!(f, "modulul {m} nu este activat"),
            CoreError::PermissionDenied {
                module,
                permission,
                detail,
            } => {
                if permission == "rol" {
                    // The person's role (D-056), not a module permission.
                    write!(f, "{detail}")
                } else {
                    write!(f, "modulul {module} nu are permisiunea {permission}: {detail}")
                }
            }
            CoreError::Invalid { what, detail } => write!(f, "{what}: {detail}"),
        }
    }
}

impl std::error::Error for CoreError {}

impl From<io::Error> for CoreError {
    fn from(e: io::Error) -> Self {
        CoreError::Io(e)
    }
}

impl From<kgb_store::Error> for CoreError {
    fn from(e: kgb_store::Error) -> Self {
        match e {
            kgb_store::Error::Locked(p) => CoreError::WorkspaceInUse(p),
            kgb_store::Error::UnsafeLocation(p) => CoreError::UnsafeLocation(p),
            other => CoreError::Store(other),
        }
    }
}
