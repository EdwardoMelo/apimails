#!/usr/bin/env python3
"""Upload nginx site config and enable it on the VPS (does not touch other sites)."""
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    import paramiko
except ImportError:
    print("pip install paramiko python-dotenv")
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

SITE_NAME = "www.apiemail.eduardomelodev.com"
LOCAL_CONF = ROOT / "infra" / "nginx" / f"{SITE_NAME}.conf"
REMOTE_AVAILABLE = f"/etc/nginx/sites-available/{SITE_NAME}"
REMOTE_ENABLED = f"/etc/nginx/sites-enabled/{SITE_NAME}"

host = os.getenv("VPS_HOST")
user = os.getenv("VPS_USER")
pwd = os.getenv("VPS_PASSWORD")
port = int(os.getenv("VPS_PORT", "22"))

if not LOCAL_CONF.exists():
    print(f"Missing {LOCAL_CONF}")
    sys.exit(1)

conf_body = LOCAL_CONF.read_text(encoding="utf-8")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    hostname=host,
    port=port,
    username=user,
    password=pwd,
    timeout=30,
    allow_agent=False,
    look_for_keys=False,
)

sftp = client.open_sftp()
with sftp.file(REMOTE_AVAILABLE, "w") as remote:
    remote.write(conf_body)
sftp.close()
print(f"Uploaded {REMOTE_AVAILABLE}")

commands = [
    f"test ! -e {REMOTE_ENABLED} || test -L {REMOTE_ENABLED}",
    f"ln -sf {REMOTE_AVAILABLE} {REMOTE_ENABLED}",
    "nginx -t",
    "systemctl reload nginx",
]
for cmd in commands:
    print(f"$ {cmd}")
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print(err, file=sys.stderr)
    if code != 0:
        print(f"Failed ({code}): {cmd}")
        client.close()
        sys.exit(code)

client.close()
print("Nginx site enabled and reloaded.")
