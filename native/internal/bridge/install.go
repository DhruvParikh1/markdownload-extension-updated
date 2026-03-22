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

type installEnvironment struct {
	goos              string
	userConfigDir     func() (string, error)
	userHomeDir       func() (string, error)
	setRegistryValue  func(string, string) error
	deleteRegistryKey func(string) error
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

func defaultInstallEnvironment() installEnvironment {
	return installEnvironment{
		goos:              runtime.GOOS,
		userConfigDir:     os.UserConfigDir,
		userHomeDir:       os.UserHomeDir,
		setRegistryValue:  setRegistryValue,
		deleteRegistryKey: deleteRegistryKey,
	}
}

func normalizeInstallEnvironment(env installEnvironment) installEnvironment {
	if env.goos == "" {
		env.goos = runtime.GOOS
	}
	if env.userConfigDir == nil {
		env.userConfigDir = os.UserConfigDir
	}
	if env.userHomeDir == nil {
		env.userHomeDir = os.UserHomeDir
	}
	if env.setRegistryValue == nil {
		env.setRegistryValue = setRegistryValue
	}
	if env.deleteRegistryKey == nil {
		env.deleteRegistryKey = deleteRegistryKey
	}
	return env
}

func hostBinaryName(goos string) string {
	if goos == "windows" {
		return "marksnip-native-host.exe"
	}
	return "marksnip-native-host"
}

func HostExecutableForCLI(cliExecutable string) (string, error) {
	return hostExecutableForCLI(cliExecutable, runtime.GOOS)
}

func hostExecutableForCLI(cliExecutable, goos string) (string, error) {
	absCLIPath, err := filepath.Abs(cliExecutable)
	if err != nil {
		return "", err
	}

	hostPath := filepath.Join(filepath.Dir(absCLIPath), hostBinaryName(goos))
	if _, err := os.Stat(hostPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", fmt.Errorf("missing sibling host binary: %s", hostPath)
		}
		return "", err
	}
	return hostPath, nil
}

func ManifestPath(browser Browser) (string, error) {
	return manifestPath(defaultInstallEnvironment(), browser)
}

func manifestPath(env installEnvironment, browser Browser) (string, error) {
	env = normalizeInstallEnvironment(env)

	switch browser {
	case BrowserChrome, BrowserFirefox:
	default:
		return "", fmt.Errorf("unsupported browser: %s", browser)
	}

	switch env.goos {
	case "windows":
		configDir, err := env.userConfigDir()
		if err != nil {
			return "", err
		}
		if configDir == "" {
			return "", errors.New("user config directory is empty")
		}
		return filepath.Join(configDir, "MarkSnip", "NativeMessagingHosts", string(browser), HostName+".json"), nil
	case "darwin":
		configDir, err := env.userConfigDir()
		if err != nil {
			return "", err
		}
		if configDir == "" {
			return "", errors.New("user config directory is empty")
		}
		switch browser {
		case BrowserChrome:
			return filepath.Join(configDir, "Google", "Chrome", "NativeMessagingHosts", HostName+".json"), nil
		case BrowserFirefox:
			return filepath.Join(configDir, "Mozilla", "NativeMessagingHosts", HostName+".json"), nil
		}
	case "linux":
		switch browser {
		case BrowserChrome:
			configDir, err := env.userConfigDir()
			if err != nil {
				return "", err
			}
			if configDir == "" {
				return "", errors.New("user config directory is empty")
			}
			return filepath.Join(configDir, "google-chrome", "NativeMessagingHosts", HostName+".json"), nil
		case BrowserFirefox:
			homeDir, err := env.userHomeDir()
			if err != nil {
				return "", err
			}
			if homeDir == "" {
				return "", errors.New("user home directory is empty")
			}
			return filepath.Join(homeDir, ".mozilla", "native-messaging-hosts", HostName+".json"), nil
		}
	}

	return "", fmt.Errorf("MarkSnip native host install is not supported on %s", env.goos)
}

func writeManifest(browser Browser, payload map[string]any, env installEnvironment) (string, error) {
	path, err := manifestPath(env, browser)
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, append(data, '\n'), 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func InstallHost(cliExecutable string, options InstallOptions) (InstallResult, error) {
	return installHost(cliExecutable, options, defaultInstallEnvironment())
}

func installHost(cliExecutable string, options InstallOptions, env installEnvironment) (InstallResult, error) {
	env = normalizeInstallEnvironment(env)

	chromeID := options.ChromeExtensionID
	if chromeID == "" {
		chromeID = DefaultChromeID
	}

	hostPath, err := hostExecutableForCLI(cliExecutable, env.goos)
	if err != nil {
		return InstallResult{}, err
	}

	chromeManifestPath, err := writeManifest(BrowserChrome, BuildChromeManifest(hostPath, chromeID), env)
	if err != nil {
		return InstallResult{}, err
	}

	firefoxManifestPath, err := writeManifest(BrowserFirefox, BuildFirefoxManifest(hostPath), env)
	if err != nil {
		return InstallResult{}, err
	}

	if env.goos == "windows" {
		if err := env.setRegistryValue(`HKCU\Software\Google\Chrome\NativeMessagingHosts\`+HostName, chromeManifestPath); err != nil {
			return InstallResult{}, err
		}
		if err := env.setRegistryValue(`HKCU\Software\Mozilla\NativeMessagingHosts\`+HostName, firefoxManifestPath); err != nil {
			return InstallResult{}, err
		}
	}

	return InstallResult{
		ChromeManifestPath:  chromeManifestPath,
		FirefoxManifestPath: firefoxManifestPath,
	}, nil
}

func UninstallHost() error {
	return uninstallHost(defaultInstallEnvironment())
}

func uninstallHost(env installEnvironment) error {
	env = normalizeInstallEnvironment(env)

	if env.goos == "windows" {
		_ = env.deleteRegistryKey(`HKCU\Software\Google\Chrome\NativeMessagingHosts\` + HostName)
		_ = env.deleteRegistryKey(`HKCU\Software\Mozilla\NativeMessagingHosts\` + HostName)
	}

	chromeManifestPath, err := manifestPath(env, BrowserChrome)
	if err != nil {
		return err
	}
	firefoxManifestPath, err := manifestPath(env, BrowserFirefox)
	if err != nil {
		return err
	}

	if err := removeManifestFile(chromeManifestPath); err != nil {
		return err
	}
	if err := removeManifestFile(firefoxManifestPath); err != nil {
		return err
	}
	return nil
}

func removeManifestFile(path string) error {
	err := os.Remove(path)
	if err == nil || errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
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
