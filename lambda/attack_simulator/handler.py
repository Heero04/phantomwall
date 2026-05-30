import json
import random
import socket
import time
from urllib import request

import boto3

_ec2 = boto3.client("ec2")

ATTACK_PORTS = {
    "reconnaissance": [22, 23, 53, 80, 443, 8080, 8443],
    "brute_force": [22, 23],
    "web_exploit": [80, 443, 8080],
    "full_spectrum": [22, 23, 53, 80, 443, 3306, 8080, 8443],
}

WEB_PAYLOADS = [
    "/?id=1%27%20OR%201=1--",
    "/admin.php?user=admin%27%20--",
    "/search?q=<script>alert(1)</script>",
    "/../../../../etc/passwd",
    "/wp-login.php",
    "/.env",
]


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body),
    }


def _instance_ip(instance_id):
    response = _ec2.describe_instances(InstanceIds=[instance_id])
    reservations = response.get("Reservations", [])
    if not reservations or not reservations[0].get("Instances"):
        return None
    instance = reservations[0]["Instances"][0]
    return instance.get("PublicIpAddress")


def _tcp_probe(ip, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(0.6)
    try:
        sock.connect((ip, port))
    except Exception:
        pass
    finally:
        sock.close()


def _http_probe(ip):
    path = random.choice(WEB_PAYLOADS)
    url = f"http://{ip}{path}"
    req = request.Request(url, method="GET")
    req.add_header("User-Agent", "PhantomWall-Attack-Simulator/1.0")
    try:
        request.urlopen(req, timeout=1.2)
    except Exception:
        pass


def handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    if method == "OPTIONS":
        return _response(200, {"message": "OK"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON body"})

    instance_id = (body.get("instance_id") or "").strip()
    if not instance_id:
        return _response(400, {"error": "instance_id is required"})

    attack_profile = (body.get("attack_profile") or "full_spectrum").strip().lower()
    if attack_profile not in ATTACK_PORTS:
        return _response(400, {"error": f"Unsupported attack_profile '{attack_profile}'"})

    duration_seconds = int(body.get("duration_seconds") or 30)
    duration_seconds = min(max(duration_seconds, 5), 120)

    ip = _instance_ip(instance_id)
    if not ip:
        return _response(404, {"error": f"Could not resolve public IP for {instance_id}"})

    attack_id = f"atk-{int(time.time())}-{random.randint(1000, 9999)}"
    end_time = time.time() + duration_seconds
    attempts = 0

    while time.time() < end_time:
        for port in ATTACK_PORTS[attack_profile]:
            _tcp_probe(ip, port)
            attempts += 1

        if attack_profile in {"web_exploit", "full_spectrum"}:
            for _ in range(3):
                _http_probe(ip)
                attempts += 1

    return _response(
        202,
        {
            "status": "completed",
            "attack_id": attack_id,
            "instance_id": instance_id,
            "target_ip": ip,
            "attack_profile": attack_profile,
            "duration_seconds": duration_seconds,
            "attempts": attempts,
            "message": f"Attack simulation completed for {instance_id}. Alerts should appear within seconds.",
        },
    )
