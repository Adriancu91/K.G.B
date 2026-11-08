//! "Ce se aude acum" on the start page (Etapa 7, step 7.4e): the player that
//! Windows shows in its own media controls (Spotify, a browser, any player
//! on this PC), with play/pause, next and previous. It goes through the
//! Windows media controls only: no Spotify account, nothing sent anywhere,
//! nothing saved, nothing synchronised to other PCs.

use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct NowPlaying {
    /// The player, as Windows names it (e.g. "Spotify").
    pub aplicatie: String,
    pub titlu: String,
    pub artist: String,
    pub canta: bool,
}

/// A readable player name from Windows' app id
/// ("Spotify.exe" → "Spotify", "Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic" → "ZuneMusic").
pub fn app_name(id: &str) -> String {
    let base = id.rsplit(['!', '\\']).next().unwrap_or(id);
    let base = base.strip_suffix(".exe").or_else(|| base.strip_suffix(".EXE")).unwrap_or(base);
    let base = base.rsplit('.').next().unwrap_or(base);
    let base = base.split('_').next().unwrap_or(base);
    if base.is_empty() { id.to_string() } else { base.to_string() }
}

#[cfg(windows)]
mod imp {
    use super::{NowPlaying, app_name};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };

    fn e(err: windows::core::Error) -> String {
        format!("comenzile media ale Windows nu răspund ({})", err.message())
    }

    fn session() -> Result<Option<Session>, String> {
        let m = Manager::RequestAsync().map_err(e)?.join().map_err(e)?;
        // No player open is not an error.
        Ok(m.GetCurrentSession().ok())
    }

    pub fn now() -> Result<Option<NowPlaying>, String> {
        let Some(s) = session()? else { return Ok(None) };
        let props = s.TryGetMediaPropertiesAsync().map_err(e)?.join().map_err(e)?;
        let canta = s
            .GetPlaybackInfo()
            .and_then(|p| p.PlaybackStatus())
            .map(|st| st == Status::Playing)
            .unwrap_or(false);
        Ok(Some(NowPlaying {
            aplicatie: app_name(&s.SourceAppUserModelId().map(|h| h.to_string()).unwrap_or_default()),
            titlu: props.Title().map(|h| h.to_string()).unwrap_or_default(),
            artist: props.Artist().map(|h| h.to_string()).unwrap_or_default(),
            canta,
        }))
    }

    pub fn control(action: &str) -> Result<bool, String> {
        let Some(s) = session()? else { return Ok(false) };
        let op = match action {
            "play_pause" => s.TryTogglePlayPauseAsync(),
            "next" => s.TrySkipNextAsync(),
            "previous" => s.TrySkipPreviousAsync(),
            _ => return Err("comandă necunoscută".into()),
        };
        op.map_err(e)?.join().map_err(e)
    }
}

#[cfg(not(windows))]
mod imp {
    use super::NowPlaying;
    pub fn now() -> Result<Option<NowPlaying>, String> {
        Ok(None)
    }
    pub fn control(_: &str) -> Result<bool, String> {
        Ok(false)
    }
}

pub use imp::{control, now};

#[cfg(test)]
mod tests {
    use super::app_name;
    #[test]
    fn player_names() {
        assert_eq!(app_name("Spotify.exe"), "Spotify");
        assert_eq!(app_name("Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic"), "ZuneMusic");
        assert_eq!(app_name("MSEdge"), "MSEdge");
        assert_eq!(app_name("C:\\Program Files\\VLC\\vlc.exe"), "vlc");
    }
}
