package bridge

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

type InstallOptions struct {
	ChromeExtensionID string
}

type InstallResult struct {
	ChromeManifestPath  string
	FirefoxManifestPath string
}

func BuildChromeManifest(hostPath, extensionID string) map[string]any {
	return map[string]any{
		"name":            HostName,
		"description":     "MarkSnip native host",
		"path":            hostPath,
		"type":            "stdio",
		"allowed_origins": []string{fmt.Sprintf("chrome-extension://%s/", extensionID)},
	}
}

func BuildFirefoxManifest(hostPath string) map[string]any {
	return map[string]any{
		"name":               HostName,
		"description":        "MarkSnip native host",
		"path":               hostPath,
		"type":               "stdio",
		"allowed_extensions": []string{DefaultFirefoxID},
	}
}

func writeManifest(browser Browser, payload map[string]any) (string, error) {
	dir, err := ManifestDir(browser)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}

	path := filepath.Join(dir, HostName+".json")
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func HostExecutableForCLI(cliExecutable string) (string, error) {
	hostPath := filepath.Join(filepath.Dir(cliExecutable), "marksnip-native-host.exe")
	if _, err := os.Stat(hostPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("missing sibling host binary: %s", hostPath)
		}
		return "", err
	}
	return hostPath, nil
}

func ensureWindows() error {
	if runtime.GOOS != "windows" {
		return errors.New("MarkSnip native host install is supported on Windows only in v1")
	}
	return nil
}

func InstallHost(cliExecutable string, options InstallOptions) (InstallResult, error) {
	if err := ensureWindows(); err != nil {
		return InstallResult{}, err
	}

	chromeID := options.ChromeExtensionID
	if chromeID == "" {
		chromeID = DefaultChromeID
	}

	hostPath, err := HostExecutableForCLI(cliExecutable)
	if err != nil {
		return InstallResult{}, err
	}

	chromeManifestPath, err := writeManifest(BrowserChrome, BuildChromeManifest(hostPath, chromeID))
	if err != nil {
		return InstallResult{}, err
	}

	firefoxManifestPath, err := writeManifest(BrowserFirefox, BuildFirefoxManifest(hostPath))
	if err != nil {
		return InstallResult{}, err
	}

	if err := setRegistryValue(`HKCU\Software\Google\Chrome\NativeMessagingHosts\`+HostName, chromeManifestPath); err != nil {
		return InstallResult{}, err
	}
	if err := setRegistryValue(`HKCU\Software\Mozilla\NativeMessagingHosts\`+HostName, firefoxManifestPath); err != nil {
		return InstallResult{}, err
	}

	return InstallResult{
		ChromeManifestPath:  chromeManifestPath,
		FirefoxManifestPath: firefoxManifestPath,
	}, nil
}

func UninstallHost() error {
	if err := ensureWindows(); err != nil {
		return err
	}

	_ = deleteRegistryKey(`HKCU\Software\Google\Chrome\NativeMessagingHosts\` + HostName)
	_ = deleteRegistryKey(`HKCU\Software\Mozilla\NativeMessagingHosts\` + HostName)

	chromeManifestPath, _ := ManifestPath(BrowserChrome)
	firefoxManifestPath, _ := ManifestPath(BrowserFirefox)
	if chromeManifestPath != "" {
		_ = os.Remove(chromeManifestPath)
	}
	if firefoxManifestPath != "" {
		_ = os.Remove(firefoxManifestPath)
	}
	return nil
}

func setRegistryValue(keyPath, value string) error {
	cmd := exec.Command("reg", "add", keyPath, "/ve", "/t", "REG_SZ", "/d", value, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("reg add failed: %w (%s)", err, string(output))
	}
	return nil
}

func deleteRegistryKey(keyPath string) error {
	cmd := exec.Command("reg", "delete", keyPath, "/f")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("reg delete failed: %w (%s)", err, string(output))
	}
	return nil
}
