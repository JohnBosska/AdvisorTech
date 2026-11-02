#!/usr/bin/env python3
"""Idempotently configure nginx-proxy-manager proxy hosts for Tech Adviser.

Runs as the one-shot `npm-setup` compose service on the shared network and talks to the
NPM admin API. Stdlib only. Safe to re-run: hosts are looked up by domain and updated.

  APP_DOMAIN   -> frontend:80 (serves the SPA and proxies /api to the backend)
  API_DOMAIN   -> api:8000    (optional; for Connector Agents and direct API access)
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("NPM_URL", "http://nginx-proxy-manager:81").rstrip("/")
DEFAULT_EMAIL, DEFAULT_PASSWORD = "admin@example.com", "changeme"
ADMIN_EMAIL = os.environ.get("NPM_ADMIN_EMAIL", "")
PASSWORD = os.environ.get("NPM_ADMIN_PASSWORD", "")
APP_DOMAIN = os.environ.get("APP_DOMAIN", "").strip()
API_DOMAIN = os.environ.get("API_DOMAIN", "").strip()
LE_EMAIL = os.environ.get("NPM_LETSENCRYPT_EMAIL", "").strip()
# NPM >= 2.13 uses the admin user's email as the Let's Encrypt contact, so the admin gets it.
EMAIL = LE_EMAIL or ADMIN_EMAIL


class NpmError(Exception):
    pass


def call(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(f"{BASE}/api{path}", data=data, method=method)
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        raise NpmError(f"{method} {path} -> {exc.code}: {detail}") from None


def wait_ready():
    """Return the API status document once NPM answers."""
    for _ in range(60):
        try:
            return call("GET", "/") or {}
        except NpmError:
            return {}  # it answered with an error status: the API is up
        except (urllib.error.URLError, OSError):
            time.sleep(3)
    raise SystemExit("nginx-proxy-manager did not become ready")


def create_first_admin():
    """Fresh NPM (>= 2.13) has no users until the first one is created without auth."""
    call(
        "POST",
        "/users",
        {"name": "Administrator", "nickname": "admin", "email": EMAIL, "roles": ["admin"],
         "is_disabled": False, "auth": {"type": "password", "secret": PASSWORD}},
    )
    print("nginx-proxy-manager: first admin created from NPM_ADMIN_EMAIL")


def login(email, password):
    return call("POST", "/tokens", {"identity": email, "secret": password})["token"]


def set_admin_email(token):
    me = call("GET", "/users/me", token=token)
    if me["email"] != EMAIL:
        call(
            "PUT",
            f"/users/{me['id']}",
            {"name": me.get("name") or "Administrator", "nickname": me.get("nickname") or "admin",
             "email": EMAIL, "roles": me.get("roles") or ["admin"], "is_disabled": False},
            token,
        )
        print("nginx-proxy-manager: admin email set to the Let's Encrypt contact")


def authenticate():
    """Log in as the admin; migrate an older admin email or the factory default if needed."""
    for identity, secret in ((EMAIL, PASSWORD), (ADMIN_EMAIL, PASSWORD)):
        try:
            token = login(identity, secret)
        except NpmError:
            continue
        set_admin_email(token)
        return login(EMAIL, PASSWORD)
    try:
        token = login(DEFAULT_EMAIL, DEFAULT_PASSWORD)
    except NpmError:
        raise SystemExit(
            "Cannot log in to nginx-proxy-manager with NPM_ADMIN_EMAIL/NPM_ADMIN_PASSWORD "
            "or with the factory default admin. Fix the credentials in .env."
        ) from None
    set_admin_email(token)
    me = call("GET", "/users/me", token=token)
    call(
        "PUT",
        f"/users/{me['id']}/auth",
        {"type": "password", "current": DEFAULT_PASSWORD, "secret": PASSWORD},
        token,
    )
    print("nginx-proxy-manager: default admin replaced")
    return login(EMAIL, PASSWORD)


def ensure_certificate(token, domain):
    if not LE_EMAIL:
        return 0
    for cert in call("GET", "/nginx/certificates", token=token):
        if domain in cert.get("domain_names", []):
            return cert["id"]
    print(f"requesting Let's Encrypt certificate for {domain}")
    cert = call(
        "POST",
        "/nginx/certificates",
        {"provider": "letsencrypt", "domain_names": [domain], "meta": {"dns_challenge": False}},
        token,
    )
    return cert["id"]


def ensure_proxy_host(token, domain, forward_host, forward_port):
    existing = next(
        (h for h in call("GET", "/nginx/proxy-hosts", token=token) if domain in h["domain_names"]),
        None,
    )
    certificate_id = 0
    try:
        certificate_id = ensure_certificate(token, domain)
    except NpmError as exc:
        # Typical cause: DNS does not point at this server yet. The host still works over HTTP.
        print(f"WARNING: certificate for {domain} not issued: {exc}", file=sys.stderr)
    body = {
        "domain_names": [domain],
        "forward_scheme": "http",
        "forward_host": forward_host,
        "forward_port": forward_port,
        "access_list_id": 0,
        "certificate_id": certificate_id,
        "ssl_forced": bool(certificate_id),
        "hsts_enabled": bool(certificate_id),
        "hsts_subdomains": False,
        "http2_support": bool(certificate_id),
        "block_exploits": True,
        "caching_enabled": False,
        "allow_websocket_upgrade": True,
        "advanced_config": "",
        "meta": {"dns_challenge": False},
        "locations": [],
    }
    if existing:
        call("PUT", f"/nginx/proxy-hosts/{existing['id']}", body, token)
        print(f"updated proxy host {domain} -> {forward_host}:{forward_port}")
    else:
        call("POST", "/nginx/proxy-hosts", body, token)
        print(f"created proxy host {domain} -> {forward_host}:{forward_port}")


def main():
    if not (APP_DOMAIN or API_DOMAIN):
        print("APP_DOMAIN/API_DOMAIN not set: skipping proxy host setup")
        return
    if not (EMAIL and PASSWORD):
        print("NPM_ADMIN_EMAIL/NPM_ADMIN_PASSWORD not set: skipping proxy host setup")
        return
    status = wait_ready()
    if status.get("setup") is False:
        create_first_admin()
    token = authenticate()
    if APP_DOMAIN:
        ensure_proxy_host(token, APP_DOMAIN, "frontend", 80)
    if API_DOMAIN:
        ensure_proxy_host(token, API_DOMAIN, "api", 8000)


if __name__ == "__main__":
    try:
        main()
    except NpmError as exc:
        raise SystemExit(f"nginx-proxy-manager setup failed: {exc}") from None
