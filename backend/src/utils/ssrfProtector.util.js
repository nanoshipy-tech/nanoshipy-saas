'use strict';

const dns = require('dns').promises;
const net = require('net');

/**
 * Checks if an IPv4 address falls within private, loopback, or metadata ranges.
 */
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // invalid -> block
  }

  const [a, b] = parts;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private class A)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private class B: 172.16 - 172.31)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private class C)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local / AWS/GCP Metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;

  return false;
}

/**
 * Checks if an IPv6 address falls within private, loopback, or link-local ranges.
 */
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  // Loopback ::1
  if (lower === '::1' || lower === '0000:0000:0000:0000:0000:0000:0000:0001') return true;

  // fc00::/7 (Unique local)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

  // fe80::/10 (Link-local)
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;

  // IPv4-mapped IPv6 ::ffff:192.0.2.128
  if (lower.includes('::ffff:')) {
    const v4 = lower.split('::ffff:')[1];
    if (net.isIPv4(v4)) return isPrivateIPv4(v4);
  }

  return false;
}

/**
 * Validates target URL against SSRF vulnerabilities.
 * Resolves hostname and verifies that none of the returned IP addresses are private/reserved.
 * @param {string} targetUrl - URL to validate
 * @returns {Promise<{ isValid: boolean, error?: string, resolvedIp?: string }>}
 */
async function validateWebhookUrl(targetUrl) {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { isValid: false, error: 'Target URL is required' };
  }

  let parsed;
  try {
    parsed = new URL(targetUrl.trim());
  } catch {
    return { isValid: false, error: 'Invalid URL format' };
  }

  const isProd = process.env.NODE_ENV === 'production';

  // In production, strictly enforce HTTPS
  if (isProd && parsed.protocol !== 'https:') {
    return { isValid: false, error: 'Only HTTPS URLs are permitted in production' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { isValid: false, error: 'Protocol must be http: or https:' };
  }

  const hostname = parsed.hostname;

  // In development, allow localhost/127.0.0.1 for local testing
  if (!isProd && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')) {
    return { isValid: true, resolvedIp: '127.0.0.1' };
  }

  // Check direct IP addresses
  if (net.isIPv4(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return { isValid: false, error: `Access to private IP range (${hostname}) is blocked` };
    }
    return { isValid: true, resolvedIp: hostname };
  }

  if (net.isIPv6(hostname)) {
    if (isPrivateIPv6(hostname)) {
      return { isValid: false, error: `Access to private IPv6 range (${hostname}) is blocked` };
    }
    return { isValid: true, resolvedIp: hostname };
  }

  // Resolve hostname via DNS
  try {
    const lookupResult = await dns.lookup(hostname, { all: true });
    for (const record of lookupResult) {
      if (record.family === 4 && isPrivateIPv4(record.address)) {
        return { isValid: false, error: `Resolved host ${hostname} points to private IP range (${record.address})` };
      }
      if (record.family === 6 && isPrivateIPv6(record.address)) {
        return { isValid: false, error: `Resolved host ${hostname} points to private IPv6 range (${record.address})` };
      }
    }
    return { isValid: true, resolvedIp: lookupResult[0]?.address };
  } catch (dnsErr) {
    return { isValid: false, error: `DNS resolution failed for host ${hostname}: ${dnsErr.message}` };
  }
}

module.exports = {
  validateWebhookUrl,
  isPrivateIPv4,
  isPrivateIPv6,
};
