# MarkSnip Notion Backend

This service is the companion backend required for MarkSnip's public Notion integration. It performs secure OAuth token exchange, token refresh/revoke, destination search, data-source schema retrieval, and page creation with markdown upload.

## Requirements

- Node.js 20+
- A Notion public integration with the required capabilities
- Redirect URIs for the extension builds added in the Notion integration settings

## Environment

```bash
NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
MARKSNIP_NOTION_STORE_KEY=...
MARKSNIP_ALLOWED_REDIRECT_URIS=https://<chrome-extension-id>.chromiumapp.org/notion,https://<firefox-extension-id>.extensions.allizom.org/
PORT=8787
```

`MARKSNIP_NOTION_STORE_KEY` is used to encrypt stored Notion credentials at rest.

## Run

```bash
cd backend
npm start
```

The extension defaults to `http://localhost:8787` as the Notion backend URL.
