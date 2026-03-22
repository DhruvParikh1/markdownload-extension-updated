# MarkSnip Agent Bridge

Windows companion binaries for the MarkSnip browser extension.

Files:

- `marksnip.exe` - local CLI
- `marksnip-native-host.exe` - browser native messaging host

Typical setup:

```powershell
.\marksnip.exe install-host
```

Typical usage:

```powershell
.\marksnip.exe status
.\marksnip.exe clip
.\marksnip.exe clip --json
.\marksnip.exe clip --fresh
```
