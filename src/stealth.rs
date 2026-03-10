use headless_chrome::protocol::cdp::Fetch;
use headless_chrome::{Browser, LaunchOptions, Tab};
use rand::Rng;
use std::ffi::OsStr;
use std::sync::Arc;
use std::time::Duration;
use url::Url;

const USER_AGENTS: &[&str] = &[
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];

const VIEWPORTS: &[(u32, u32)] = &[
    (1920, 1080),
    (1366, 768),
    (1536, 864),
    (1440, 900),
];

#[derive(Clone, Debug)]
pub struct ProxyAuth {
    pub username: String,
    pub password: String,
}

pub struct StealthConfig {
    /// Proxy URL without credentials (protocol://host:port), used for --proxy-server
    pub proxy_server: Option<String>,
    /// Proxy credentials, handled separately via CDP Fetch domain
    pub proxy_auth: Option<ProxyAuth>,
    pub user_agent: Option<String>,
    pub viewport: Option<(u32, u32)>,
}

impl Default for StealthConfig {
    fn default() -> Self {
        Self {
            proxy_server: None,
            proxy_auth: None,
            user_agent: None,
            viewport: None,
        }
    }
}

impl StealthConfig {
    pub fn with_proxy(mut self, proxy: Option<String>) -> Self {
        if let Some(ref url_str) = proxy {
            if let Ok(parsed) = Url::parse(url_str) {
                let username = parsed.username();
                let password = parsed.password().unwrap_or("");
                if !username.is_empty() {
                    self.proxy_auth = Some(ProxyAuth {
                        username: username.to_string(),
                        password: password.to_string(),
                    });
                    let mut clean = parsed.clone();
                    clean.set_username("").ok();
                    clean.set_password(None).ok();
                    self.proxy_server = Some(clean.to_string().trim_end_matches('/').to_string());
                } else {
                    self.proxy_server = Some(url_str.clone());
                }
            } else {
                self.proxy_server = Some(url_str.clone());
            }
        }
        self
    }

    fn resolved_ua(&self) -> &str {
        if let Some(ref ua) = self.user_agent {
            ua.as_str()
        } else {
            let mut rng = rand::thread_rng();
            USER_AGENTS[rng.gen_range(0..USER_AGENTS.len())]
        }
    }

    fn resolved_viewport(&self) -> (u32, u32) {
        if let Some(vp) = self.viewport {
            vp
        } else {
            let mut rng = rand::thread_rng();
            VIEWPORTS[rng.gen_range(0..VIEWPORTS.len())]
        }
    }
}

pub fn launch_stealth_browser(config: &StealthConfig) -> Result<Browser, String> {
    let (w, h) = config.resolved_viewport();
    let window_size = format!("--window-size={},{}", w, h);

    let mut args: Vec<String> = vec![
        "--disable-blink-features=AutomationControlled".into(),
        "--disable-features=IsolateOrigins,site-per-process".into(),
        "--disable-infobars".into(),
        "--no-first-run".into(),
        "--no-default-browser-check".into(),
        window_size,
        "--disable-component-update".into(),
        "--disable-domain-reliability".into(),
        "--disable-features=AutofillServerCommunication".into(),
        "--disable-features=OptimizationHints".into(),
        "--disable-background-networking".into(),
        "--disable-gpu".into(),
        "--disable-software-rasterizer".into(),
        "--lang=en-US,en".into(),
        "--disable-hang-monitor".into(),
        "--disable-ipc-flooding-protection".into(),
        "--disable-popup-blocking".into(),
        "--disable-prompt-on-repost".into(),
        "--disable-renderer-backgrounding".into(),
        "--disable-sync".into(),
        "--metrics-recording-only".into(),
        "--no-service-autorun".into(),
        "--password-store=basic".into(),
        "--use-mock-keychain".into(),
    ];

    if let Some(ref proxy) = config.proxy_server {
        args.push(format!("--proxy-server={}", proxy));
    }

    let args_os: Vec<&OsStr> = args.iter().map(|s| OsStr::new(s.as_str())).collect();

    let options = LaunchOptions {
        headless: true,
        args: args_os,
        sandbox: false,
        idle_browser_timeout: Duration::from_secs(120),
        ..Default::default()
    };

    Browser::new(options).map_err(|e| format!("Failed to launch stealth browser: {}", e))
}

fn build_stealth_js(viewport: (u32, u32)) -> String {
    format!(
        r#"
// Override navigator.webdriver
Object.defineProperty(navigator, 'webdriver', {{
    get: () => undefined,
}});

// Override navigator.plugins
Object.defineProperty(navigator, 'plugins', {{
    get: () => {{
        const plugins = [
            {{ name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }},
            {{ name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' }},
            {{ name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }},
        ];
        plugins.length = 3;
        return plugins;
    }},
}});

// Override navigator.languages
Object.defineProperty(navigator, 'languages', {{
    get: () => ['en-US', 'en'],
}});

// Override navigator.permissions.query
const originalQuery = window.navigator.permissions.query;
window.navigator.permissions.query = (parameters) => (
    parameters.name === 'notifications'
        ? Promise.resolve({{ state: Notification.permission }})
        : originalQuery(parameters)
);

// Chrome runtime mock
window.chrome = {{
    runtime: {{
        connect: () => {{}},
        sendMessage: () => {{}},
    }},
    loadTimes: () => ({{
        requestTime: Date.now() * 0.001,
        startLoadTime: Date.now() * 0.001,
        commitLoadTime: Date.now() * 0.001,
        finishDocumentLoadTime: Date.now() * 0.001,
        finishLoadTime: Date.now() * 0.001,
        firstPaintTime: Date.now() * 0.001,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: false,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2',
    }}),
    csi: () => ({{
        startE: Date.now(),
        onloadT: Date.now(),
        pageT: Date.now(),
        tran: 15,
    }}),
}};

// Hardware spoofing
Object.defineProperty(navigator, 'hardwareConcurrency', {{ get: () => 8 }});
Object.defineProperty(navigator, 'deviceMemory', {{ get: () => 8 }});

// Screen dimensions matching viewport
Object.defineProperty(screen, 'width', {{ get: () => {w} }});
Object.defineProperty(screen, 'height', {{ get: () => {h} }});
Object.defineProperty(screen, 'availWidth', {{ get: () => {w} }});
Object.defineProperty(screen, 'availHeight', {{ get: () => {h} - 40 }});

// CDP marker cleanup
try {{
    for (const key of Object.keys(window)) {{
        if (key.startsWith('cdc_') || key.startsWith('__webdriver')) {{
            delete window[key];
        }}
    }}
}} catch(e) {{}}

// Navigator connection mock
if (!navigator.connection) {{
    Object.defineProperty(navigator, 'connection', {{
        get: () => ({{
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false,
        }}),
    }});
}}

// Fix iframe contentWindow detection
const originalAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function() {{
    return originalAttachShadow.apply(this, arguments);
}};

// Override toString for patched functions
const nativeToString = Function.prototype.toString;
const spoofedFns = new Set();
const oldCall = Function.prototype.toString.call;
function spoof(fn) {{ spoofedFns.add(fn); }}
Function.prototype.toString = function() {{
    if (spoofedFns.has(this)) return 'function () {{ [native code] }}';
    return oldCall.call(nativeToString, this);
}};
spoof(Function.prototype.toString);

// WebGL vendor/renderer spoofing (both WebGL1 and WebGL2)
const getParam = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {{
    if (parameter === 37445) return 'Google Inc. (Intel)';
    if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)';
    return getParam.call(this, parameter);
}};
if (typeof WebGL2RenderingContext !== 'undefined') {{
    const getParam2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(parameter) {{
        if (parameter === 37445) return 'Google Inc. (Intel)';
        if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)';
        return getParam2.call(this, parameter);
    }};
}}

// Canvas fingerprint noise
const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(type) {{
    const ctx = this.getContext('2d');
    if (ctx) {{
        const style = ctx.fillStyle;
        ctx.fillStyle = 'rgba(0,0,1,0.01)';
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = style;
    }}
    return origToDataURL.apply(this, arguments);
}};

// AudioContext spoofing
if (typeof AudioContext !== 'undefined') {{
    const origGetFloatFreq = AnalyserNode.prototype.getFloatFrequencyData;
    AnalyserNode.prototype.getFloatFrequencyData = function(array) {{
        origGetFloatFreq.call(this, array);
        for (let i = 0; i < array.length; i++) {{
            array[i] += Math.random() * 0.0001;
        }}
    }};
}}
"#,
        w = viewport.0,
        h = viewport.1
    )
}

pub fn apply_stealth(tab: &Arc<Tab>, config: &StealthConfig) -> Result<(), String> {
    let viewport = config.resolved_viewport();
    let js = build_stealth_js(viewport);

    tab.evaluate(&js, false)
        .map_err(|e| format!("Failed to inject stealth JS: {}", e))?;

    tab.set_user_agent(config.resolved_ua(), None, None)
        .map_err(|e| format!("Failed to set user agent: {}", e))?;

    if let Some(ref auth) = config.proxy_auth {
        tab.enable_fetch(
            Some(&[Fetch::RequestPattern {
                url_pattern: Some("*".to_string()),
                resource_Type: None,
                request_stage: None,
            }]),
            Some(true),
        )
        .map_err(|e| format!("Failed to enable fetch for proxy auth: {}", e))?;

        tab.authenticate(
            Some(auth.username.clone()),
            Some(auth.password.clone()),
        )
        .map_err(|e| format!("Failed to set proxy auth: {}", e))?;
    }

    Ok(())
}

pub fn navigate_stealth(
    tab: &Arc<Tab>,
    url: &str,
    wait_secs: u64,
    config: &StealthConfig,
) -> Result<String, String> {
    let viewport = config.resolved_viewport();
    let js = build_stealth_js(viewport);

    tab.evaluate(&js, false)
        .map_err(|e| format!("Stealth JS inject failed: {}", e))?;

    tab.navigate_to(url)
        .map_err(|e| format!("Navigation failed: {}", e))?;

    tab.wait_until_navigated()
        .map_err(|e| format!("Wait navigation failed: {}", e))?;

    std::thread::sleep(Duration::from_secs(wait_secs));

    tab.wait_for_element("body")
        .map_err(|e| format!("No body element: {}", e))?;

    tab.get_content()
        .map_err(|e| format!("Failed to get content: {}", e))
}
