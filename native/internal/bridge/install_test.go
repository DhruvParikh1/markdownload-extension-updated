package bridge

import "testing"

func TestBuildChromeManifest(t *testing.T) {
	manifest := BuildChromeManifest(`C:\MarkSnip\marksnip-native-host.exe`, DefaultChromeID)
	origins := manifest["allowed_origins"].([]string)
	if len(origins) != 1 || origins[0] != "chrome-extension://"+DefaultChromeID+"/" {
		t.Fatalf("unexpected allowed origins: %#v", origins)
	}
}

func TestSelectSessionRequiresBrowserWhenMultipleSessionsExist(t *testing.T) {
	status := StatusFile{
		Sessions: map[string]SessionStatus{
			string(BrowserChrome):  {Browser: string(BrowserChrome), Port: 1},
			string(BrowserFirefox): {Browser: string(BrowserFirefox), Port: 2},
		},
	}

	if _, err := SelectSession(status, ""); err == nil {
		t.Fatal("expected SelectSession to fail when multiple browsers are connected without an explicit selector")
	}
}
