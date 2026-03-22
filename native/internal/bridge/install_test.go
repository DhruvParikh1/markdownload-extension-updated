package bridge

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestBuildChromeManifest(t *testing.T) {
	manifest := BuildChromeManifest(`C:\MarkSnip\marksnip-native-host.exe`, DefaultChromeID)
	origins := manifest["allowed_origins"].([]string)
	if len(origins) != 1 || origins[0] != "chrome-extension://"+DefaultChromeID+"/" {
		t.Fatalf("unexpected allowed origins: %#v", origins)
	}
}

func TestManifestPathByPlatform(t *testing.T) {
	t.Parallel()

	configDir := filepath.Join("test-root", "config")
	homeDir := filepath.Join("test-root", "home")

	cases := []struct {
		name    string
		goos    string
		browser Browser
		want    string
	}{
		{
			name:    "windows chrome",
			goos:    "windows",
			browser: BrowserChrome,
			want:    filepath.Join(configDir, "MarkSnip", "NativeMessagingHosts", "chrome", HostName+".json"),
		},
		{
			name:    "windows firefox",
			goos:    "windows",
			browser: BrowserFirefox,
			want:    filepath.Join(configDir, "MarkSnip", "NativeMessagingHosts", "firefox", HostName+".json"),
		},
		{
			name:    "darwin chrome",
			goos:    "darwin",
			browser: BrowserChrome,
			want:    filepath.Join(configDir, "Google", "Chrome", "NativeMessagingHosts", HostName+".json"),
		},
		{
			name:    "darwin firefox",
			goos:    "darwin",
			browser: BrowserFirefox,
			want:    filepath.Join(configDir, "Mozilla", "NativeMessagingHosts", HostName+".json"),
		},
		{
			name:    "linux chrome",
			goos:    "linux",
			browser: BrowserChrome,
			want:    filepath.Join(configDir, "google-chrome", "NativeMessagingHosts", HostName+".json"),
		},
		{
			name:    "linux firefox",
			goos:    "linux",
			browser: BrowserFirefox,
			want:    filepath.Join(homeDir, ".mozilla", "native-messaging-hosts", HostName+".json"),
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			env := installEnvironment{
				goos: tc.goos,
				userConfigDir: func() (string, error) {
					return configDir, nil
				},
				userHomeDir: func() (string, error) {
					return homeDir, nil
				},
			}

			got, err := manifestPath(env, tc.browser)
			if err != nil {
				t.Fatalf("manifestPath returned error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("manifestPath = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestHostExecutableForCLIByPlatform(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	unixHostPath := filepath.Join(tempDir, "marksnip-native-host")
	windowsHostPath := filepath.Join(tempDir, "marksnip-native-host.exe")

	if err := os.WriteFile(unixHostPath, []byte("unix"), 0o755); err != nil {
		t.Fatalf("WriteFile unix host: %v", err)
	}
	if err := os.WriteFile(windowsHostPath, []byte("windows"), 0o755); err != nil {
		t.Fatalf("WriteFile windows host: %v", err)
	}

	cases := []struct {
		name    string
		goos    string
		cliPath string
		want    string
	}{
		{
			name:    "windows",
			goos:    "windows",
			cliPath: filepath.Join(tempDir, "marksnip.exe"),
			want:    windowsHostPath,
		},
		{
			name:    "linux",
			goos:    "linux",
			cliPath: filepath.Join(tempDir, "marksnip"),
			want:    unixHostPath,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := hostExecutableForCLI(tc.cliPath, tc.goos)
			if err != nil {
				t.Fatalf("hostExecutableForCLI returned error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("hostExecutableForCLI = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestInstallAndUninstallHostAcrossPlatforms(t *testing.T) {
	cases := []struct {
		name              string
		goos              string
		cliName           string
		hostName          string
		expectedRegAdds   []string
		expectedRegDelete []string
	}{
		{
			name:     "windows",
			goos:     "windows",
			cliName:  "marksnip.exe",
			hostName: "marksnip-native-host.exe",
			expectedRegAdds: []string{
				`HKCU\Software\Google\Chrome\NativeMessagingHosts\` + HostName,
				`HKCU\Software\Mozilla\NativeMessagingHosts\` + HostName,
			},
			expectedRegDelete: []string{
				`HKCU\Software\Google\Chrome\NativeMessagingHosts\` + HostName,
				`HKCU\Software\Mozilla\NativeMessagingHosts\` + HostName,
			},
		},
		{
			name:     "darwin",
			goos:     "darwin",
			cliName:  "marksnip",
			hostName: "marksnip-native-host",
		},
		{
			name:     "linux",
			goos:     "linux",
			cliName:  "marksnip",
			hostName: "marksnip-native-host",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			tempDir := t.TempDir()
			configDir := filepath.Join(tempDir, "config")
			homeDir := filepath.Join(tempDir, "home")
			cliPath := filepath.Join(tempDir, tc.cliName)
			hostPath := filepath.Join(tempDir, tc.hostName)

			if err := os.MkdirAll(configDir, 0o755); err != nil {
				t.Fatalf("MkdirAll configDir: %v", err)
			}
			if err := os.MkdirAll(homeDir, 0o755); err != nil {
				t.Fatalf("MkdirAll homeDir: %v", err)
			}
			if err := os.WriteFile(hostPath, []byte("host"), 0o755); err != nil {
				t.Fatalf("WriteFile hostPath: %v", err)
			}

			var registryAdds []string
			var registryDeletes []string

			env := installEnvironment{
				goos: tc.goos,
				userConfigDir: func() (string, error) {
					return configDir, nil
				},
				userHomeDir: func() (string, error) {
					return homeDir, nil
				},
				setRegistryValue: func(keyPath, value string) error {
					registryAdds = append(registryAdds, keyPath+"="+value)
					return nil
				},
				deleteRegistryKey: func(keyPath string) error {
					registryDeletes = append(registryDeletes, keyPath)
					return nil
				},
			}

			result, err := installHost(cliPath, InstallOptions{ChromeExtensionID: "dev-extension-id"}, env)
			if err != nil {
				t.Fatalf("installHost returned error: %v", err)
			}

			if result.ChromeManifestPath == "" || result.FirefoxManifestPath == "" {
				t.Fatalf("installHost returned empty manifest paths: %#v", result)
			}

			assertManifestContainsPath(t, result.ChromeManifestPath, hostPath)
			assertManifestContainsPath(t, result.FirefoxManifestPath, hostPath)

			if err := uninstallHost(env); err != nil {
				t.Fatalf("uninstallHost returned error: %v", err)
			}

			if _, err := os.Stat(result.ChromeManifestPath); !os.IsNotExist(err) {
				t.Fatalf("chrome manifest still exists or stat failed: %v", err)
			}
			if _, err := os.Stat(result.FirefoxManifestPath); !os.IsNotExist(err) {
				t.Fatalf("firefox manifest still exists or stat failed: %v", err)
			}

			if tc.expectedRegAdds != nil {
				if !reflect.DeepEqual(extractRegistryKeys(registryAdds), tc.expectedRegAdds) {
					t.Fatalf("registry add keys = %#v, want %#v", extractRegistryKeys(registryAdds), tc.expectedRegAdds)
				}
			}
			if tc.expectedRegDelete != nil && !reflect.DeepEqual(registryDeletes, tc.expectedRegDelete) {
				t.Fatalf("registry delete keys = %#v, want %#v", registryDeletes, tc.expectedRegDelete)
			}
		})
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

func assertManifestContainsPath(t *testing.T, manifestPath, hostPath string) {
	t.Helper()

	data, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatalf("ReadFile(%q): %v", manifestPath, err)
	}

	var manifest map[string]any
	if err := json.Unmarshal(data, &manifest); err != nil {
		t.Fatalf("json.Unmarshal(%q): %v", manifestPath, err)
	}

	if got := manifest["path"]; got != hostPath {
		t.Fatalf("manifest path = %#v, want %q", got, hostPath)
	}
}

func extractRegistryKeys(entries []string) []string {
	keys := make([]string, 0, len(entries))
	for _, entry := range entries {
		for i := 0; i < len(entry); i++ {
			if entry[i] == '=' {
				keys = append(keys, entry[:i])
				break
			}
		}
	}
	return keys
}
