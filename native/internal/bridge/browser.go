package bridge

import "strings"

func DetectBrowserFromArgs(args []string) Browser {
	for _, arg := range args {
		if strings.HasPrefix(arg, "chrome-extension://") {
			return BrowserChrome
		}
		if strings.Contains(arg, DefaultFirefoxID) || strings.Contains(arg, "@") {
			return BrowserFirefox
		}
	}
	return BrowserChrome
}
