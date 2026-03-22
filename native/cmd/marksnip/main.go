package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/DhruvParikh1/markdownload-extension-updated/native/internal/bridge"
)

type clipResponse struct {
	Result *bridge.ClipResult `json:"result,omitempty"`
	Error  string             `json:"error,omitempty"`
}

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(1)
	}

	switch os.Args[1] {
	case "clip":
		if err := runClip(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	case "status":
		if err := runStatus(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	case "install-host":
		if err := runInstallHost(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
	case "uninstall-host":
		if err := bridge.UninstallHost(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		fmt.Println("Removed MarkSnip native host manifests and registry keys.")
	default:
		usage()
		os.Exit(1)
	}
}

func usage() {
	prog := filepath.Base(os.Args[0])
	fmt.Fprintf(os.Stderr, "Usage: %s <clip|status|install-host|uninstall-host>\n", prog)
}

func runInstallHost(args []string) error {
	fs := flag.NewFlagSet("install-host", flag.ContinueOnError)
	chromeID := fs.String("chrome-extension-id", bridge.DefaultChromeID, "Override Chrome extension ID for unpacked development builds")
	if err := fs.Parse(args); err != nil {
		return err
	}

	exe, err := os.Executable()
	if err != nil {
		return err
	}

	result, err := bridge.InstallHost(exe, bridge.InstallOptions{
		ChromeExtensionID: *chromeID,
	})
	if err != nil {
		return err
	}

	fmt.Println("Installed MarkSnip native host manifests.")
	fmt.Printf("Chrome manifest: %s\n", result.ChromeManifestPath)
	fmt.Printf("Firefox manifest: %s\n", result.FirefoxManifestPath)
	return nil
}

func runStatus() error {
	status, err := bridge.ReadStatusFile()
	if err != nil {
		return err
	}

	if len(status.Sessions) == 0 {
		return errors.New("no MarkSnip bridge session is connected; open Chrome or Firefox with Agent Bridge enabled")
	}

	for _, browserName := range []string{string(bridge.BrowserChrome), string(bridge.BrowserFirefox)} {
		session, ok := status.Sessions[browserName]
		if !ok {
			continue
		}
		fmt.Printf("%s: connected on 127.0.0.1:%d (pid=%d, host=%s, since=%s)\n",
			session.Browser,
			session.Port,
			session.PID,
			session.HostVersion,
			session.ConnectedAt,
		)
	}
	return nil
}

func runClip(args []string) error {
	fs := flag.NewFlagSet("clip", flag.ContinueOnError)
	jsonOutput := fs.Bool("json", false, "Print JSON instead of raw Markdown")
	fresh := fs.Bool("fresh", false, "Bypass popup-edited cache and force a live capture")
	browserName := fs.String("browser", "", "Choose chrome or firefox when multiple sessions are connected")
	if err := fs.Parse(args); err != nil {
		return err
	}

	status, err := bridge.ReadStatusFile()
	if err != nil {
		return err
	}

	session, err := bridge.SelectSession(status, bridge.Browser(*browserName))
	if err != nil {
		return err
	}

	requestBody, err := json.Marshal(map[string]any{
		"fresh": *fresh,
	})
	if err != nil {
		return err
	}

	url := fmt.Sprintf("http://127.0.0.1:%d/clip", session.Port)
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(requestBody))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-MarkSnip-Token", session.Token)

	client := &http.Client{Timeout: 35 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to contact MarkSnip native host: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}

	var parsed clipResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return err
	}
	if resp.StatusCode >= 400 {
		if parsed.Error != "" {
			return errors.New(parsed.Error)
		}
		return fmt.Errorf("bridge request failed with HTTP %d", resp.StatusCode)
	}
	if parsed.Error != "" {
		return errors.New(parsed.Error)
	}
	if parsed.Result == nil {
		return errors.New("MarkSnip bridge returned no clip result")
	}

	if *jsonOutput {
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		return encoder.Encode(parsed.Result)
	}

	_, err = fmt.Fprint(os.Stdout, parsed.Result.Markdown)
	return err
}
