package bridge

const (
	HostName         = "com.marksnip.bridge"
	HostVersion      = "0.1.0"
	DefaultChromeID  = "kcbaglhfgbkjdnpeokaamjjkddempipm"
	DefaultFirefoxID = "marksnip@dhruvparikh"
)

type Browser string

const (
	BrowserChrome  Browser = "chrome"
	BrowserFirefox Browser = "firefox"
)

type ClipResult struct {
	Markdown   string `json:"markdown"`
	Title      string `json:"title"`
	URL        string `json:"url"`
	Source     string `json:"source"`
	CapturedAt string `json:"capturedAt"`
	Browser    string `json:"browser"`
}

type NativeMessage struct {
	Type             string      `json:"type"`
	RequestID        string      `json:"requestId,omitempty"`
	Fresh            bool        `json:"fresh,omitempty"`
	Browser          string      `json:"browser,omitempty"`
	ExtensionID      string      `json:"extensionId,omitempty"`
	ExtensionVersion string      `json:"extensionVersion,omitempty"`
	ConnectedAt      string      `json:"connectedAt,omitempty"`
	HostVersion      string      `json:"hostVersion,omitempty"`
	Result           *ClipResult `json:"result,omitempty"`
	Error            string      `json:"error,omitempty"`
}

type SessionStatus struct {
	Browser     string `json:"browser"`
	Port        int    `json:"port"`
	Token       string `json:"token"`
	PID         int    `json:"pid"`
	HostVersion string `json:"hostVersion"`
	ConnectedAt string `json:"connectedAt"`
}

type StatusFile struct {
	Sessions map[string]SessionStatus `json:"sessions"`
}
