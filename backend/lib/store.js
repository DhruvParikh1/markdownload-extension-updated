const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function deriveKey(secret) {
  return crypto.createHash('sha256').update(String(secret || 'marksnip-dev-store-key')).digest();
}

function encryptJson(value, secret) {
  const iv = crypto.randomBytes(12);
  const key = deriveKey(secret);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decryptJson(payload, secret) {
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final()
  ]);

  return JSON.parse(plaintext.toString('utf8'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

class ConnectionStore {
  constructor({ filePath, secret }) {
    this.filePath = filePath;
    this.secret = secret;
    this.records = [];
    this.load();
  }

  load() {
    if (!fs.existsSync(this.filePath)) {
      this.records = [];
      return;
    }

    const raw = fs.readFileSync(this.filePath, 'utf8');
    this.records = raw ? JSON.parse(raw) : [];
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.records, null, 2), 'utf8');
  }

  createConnectionToken() {
    return crypto.randomBytes(24).toString('base64url');
  }

  findByConnectionToken(connectionToken) {
    const tokenHash = sha256(connectionToken);
    return this.records.find(record => record.connectionTokenHash === tokenHash) || null;
  }

  getDecryptedCredentials(record) {
    if (!record?.encryptedCredentials) return null;
    return decryptJson(record.encryptedCredentials, this.secret);
  }

  findByBotId(botId) {
    return this.records.find(record => record.botId === botId) || null;
  }

  upsertConnection({ botId, workspace, credentials, existingConnectionToken }) {
    const existingRecord = this.findByBotId(botId)
      || (existingConnectionToken ? this.findByConnectionToken(existingConnectionToken) : null);
    const connectionToken = existingConnectionToken && existingRecord
      ? existingConnectionToken
      : this.createConnectionToken();
    const record = {
      id: existingRecord?.id || crypto.randomUUID(),
      botId,
      workspace,
      connectionTokenHash: sha256(connectionToken),
      encryptedCredentials: encryptJson(credentials, this.secret),
      updatedAt: new Date().toISOString()
    };

    this.records = this.records.filter(item => item.id !== existingRecord?.id && item.botId !== botId);
    this.records.push(record);
    this.save();

    return {
      connectionToken,
      record
    };
  }

  updateCredentials(connectionToken, credentials) {
    const record = this.findByConnectionToken(connectionToken);
    if (!record) return null;

    record.encryptedCredentials = encryptJson(credentials, this.secret);
    record.updatedAt = new Date().toISOString();
    this.save();
    return record;
  }

  deleteConnection(connectionToken) {
    const tokenHash = sha256(connectionToken);
    const originalLength = this.records.length;
    this.records = this.records.filter(record => record.connectionTokenHash !== tokenHash);
    this.save();
    return this.records.length !== originalLength;
  }
}

module.exports = {
  ConnectionStore,
  decryptJson,
  encryptJson,
  sha256
};
