#!/usr/bin/env python3
"""Run a single remote command on the VPS (reads api-emails/.env)."""
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

host = os.getenv("VPS_HOST")
user = os.getenv("VPS_USER")
pwd = os.getenv("VPS_PASSWORD")
port = int(os.getenv("VPS_PORT", "22"))

cmd = sys.argv[1] if len(sys.argv) > 1 else "echo 'usage: vps_run.py <command>'"

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
_, stdout, stderr = client.exec_command(cmd, get_pty=True)
while True:
    line = stdout.readline()
    if not line:
        break
    sys.stdout.buffer.write(line.encode("utf-8", errors="replace"))
    sys.stdout.buffer.flush()
err = stderr.read().decode("utf-8", errors="replace")
if err:
    sys.stderr.write(err)
exit_code = stdout.channel.recv_exit_status()
client.close()
sys.exit(exit_code)
