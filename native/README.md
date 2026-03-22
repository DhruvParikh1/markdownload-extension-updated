# MarkSnip Agent Bridge

Desktop companion binaries for the MarkSnip browser extension.

Files:

- Windows: `marksnip.exe` and `marksnip-native-host.exe`
- macOS/Linux: `marksnip` and `marksnip-native-host`

Typical setup:

**Windows**

```powershell
.\marksnip.exe install-host
```

**macOS/Linux**

```bash
./marksnip install-host
```

Typical usage:

**Windows**

```powershell
.\marksnip.exe status
.\marksnip.exe clip
.\marksnip.exe clip --json
.\marksnip.exe clip --fresh
```

**macOS/Linux**

```bash
./marksnip status
./marksnip clip
./marksnip clip --json
./marksnip clip --fresh
```
